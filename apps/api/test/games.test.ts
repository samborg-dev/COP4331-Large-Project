import { beforeEach, describe, expect, it } from 'vitest';
import request from 'supertest';
import { ObjectId } from 'mongodb';
import { app, bearer, COUNTRIES, createUser, db, resetData } from './setup.js';

const [FRANCE, GERMANY, JAPAN] = COUNTRIES as [(typeof COUNTRIES)[0], (typeof COUNTRIES)[0], (typeof COUNTRIES)[0]];
const idOf = (c: (typeof COUNTRIES)[0]) => c._id.toString();

let me: Awaited<ReturnType<typeof createUser>>;
let auth: Record<string, string>;

// Starts a round whose secret target is France, so results are deterministic
async function newRound(userId: ObjectId | null = me._id) {
  const { insertedId } = await db.collection('games').insertOne({
    userId,
    targetCountry: 'France',
    targetIso: 'FR',
    targetLat: FRANCE.lat,
    targetLng: FRANCE.lng,
    guesses: [],
    status: 'IN_PROGRESS',
    createdAt: new Date(),
  });
  return insertedId.toString();
}

const guess = (gameId: string, country: (typeof COUNTRIES)[0], headers = auth) =>
  request(app).post(`/api/games/${gameId}/guesses`).set(headers).send({ countryId: idOf(country) });

const myStats = async () => db.collection('users').findOne({ _id: me._id });

beforeEach(async () => {
  resetData();
  me = await createUser();
  auth = bearer(me.id);
});

describe('POST /api/games', () => {
  it('requires a bearer token', async () => {
    await request(app).post('/api/games').expect(401);
  });

  it('starts a round and never reveals the target', async () => {
    const res = await request(app).post('/api/games').set(auth);
    expect(res.status).toBe(201);
    expect(res.body).toEqual({ gameId: expect.any(String), maxGuesses: 10 });
    expect(JSON.stringify(res.body)).not.toMatch(/target|answer|lat|lng/i);

    const saved = await db.collection('games').findOne({ _id: new ObjectId(res.body.gameId) });
    expect(saved?.userId.toString()).toBe(me.id);
    expect(saved?.status).toBe('IN_PROGRESS');
    expect(typeof saved?.targetCountry).toBe('string'); // stored server-side only
  });
});

describe('GET /api/games/:id (resume)', () => {
  it('returns progress so far and omits the answer while the round is active', async () => {
    const id = await newRound();
    await guess(id, GERMANY).expect(200);

    const res = await request(app).get(`/api/games/${id}`).set(auth);
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ gameId: id, status: 'active', guessesUsed: 1, maxGuesses: 10 });
    expect(res.body.guesses[0]).toMatchObject({ country: 'Germany' });
    expect(res.body.answer).toBeUndefined();
  });

  it('returns 404 for unknown or malformed ids', async () => {
    await request(app).get(`/api/games/${new ObjectId()}`).set(auth).expect(404);
    await request(app).get('/api/games/not-an-id').set(auth).expect(404);
  });
});

describe('POST /api/games/:id/guesses', () => {
  it('returns a distance range for a wrong guess and awards nothing', async () => {
    const id = await newRound();
    const res = await guess(id, JAPAN);
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ country: 'Japan', range: '> 6,000 km', solved: false, guessesUsed: 1 });
    expect(res.body.pointsEarned).toBeUndefined();
    expect(res.body.distance).toBeGreaterThan(9000);
    expect(res.body.direction).toMatch(/^(N|NE|E|SE|S|SW|W|NW)$/);
    expect((await myStats())?.totalPoints).toBe(0);
  });

  it('buckets a nearby country into the "500–1,500 km" range', async () => {
    const res = await guess(await newRound(), GERMANY);
    expect(res.body.range).toBe('500–1,500 km');
  });

  it('scores a first-guess win at 100 and updates the account atomically', async () => {
    const res = await guess(await newRound(), FRANCE);
    expect(res.body).toMatchObject({ solved: true, range: 'Correct', pointsEarned: 100, guessesUsed: 1 });
    expect(await myStats()).toMatchObject({ totalPoints: 100, gamesPlayed: 1, gamesWon: 1 });
  });

  it('loses 10 points per extra guess', async () => {
    const id = await newRound();
    await guess(id, JAPAN);
    await guess(id, GERMANY);
    const res = await guess(id, FRANCE); // third guess
    expect(res.body.pointsEarned).toBe(80);
    expect((await myStats())?.totalPoints).toBe(80);
  });

  it('never scores below 10 points', async () => {
    const id = await newRound();
    for (let i = 0; i < 9; i++) await guess(id, JAPAN).expect(200);
    const res = await guess(id, FRANCE); // tenth guess
    expect(res.body).toMatchObject({ solved: true, pointsEarned: 10 });
  });

  it('ends the round as lost after 10 wrong guesses and then reveals the answer', async () => {
    const id = await newRound();
    for (let i = 0; i < 10; i++) await guess(id, JAPAN).expect(200);

    const after = await request(app).get(`/api/games/${id}`).set(auth);
    expect(after.body).toMatchObject({ status: 'lost', answer: 'France', pointsEarned: 0 });
    expect(await myStats()).toMatchObject({ totalPoints: 0, gamesPlayed: 1, gamesWon: 0 });

    const extra = await guess(id, FRANCE);
    expect(extra.status).toBe(400);
  });

  it('rejects guesses on a finished round without scoring twice', async () => {
    const id = await newRound();
    await guess(id, FRANCE).expect(200);
    const again = await guess(id, FRANCE);
    expect(again.status).toBe(400);
    expect((await myStats())?.totalPoints).toBe(100);
  });

  it("can't touch another player's round", async () => {
    const other = await createUser({ email: 'other@example.com' });
    const id = await newRound(other._id);

    expect((await guess(id, FRANCE)).status).toBe(403);
    expect((await request(app).get(`/api/games/${id}`).set(auth)).status).toBe(403);
    expect((await request(app).post(`/api/games/${id}/give-up`).set(auth)).status).toBe(403);
    expect((await db.collection('games').findOne({ _id: new ObjectId(id) }))?.guesses).toHaveLength(0);
  });

  it('ignores points sent by the client', async () => {
    const id = await newRound();
    await request(app)
      .post(`/api/games/${id}/guesses`)
      .set(auth)
      .send({ countryId: idOf(JAPAN), pointsEarned: 9999, totalPoints: 9999 })
      .expect(200);
    expect((await myStats())?.totalPoints).toBe(0);
  });

  it('returns 404 for an unknown country or round, and 401 without a token', async () => {
    const id = await newRound();
    const res = await request(app).post(`/api/games/${id}/guesses`).set(auth).send({ countryId: 'Atlantis' });
    expect(res.status).toBe(404);
    expect((await guess(String(new ObjectId()), FRANCE)).status).toBe(404);
    await request(app).post(`/api/games/${id}/guesses`).send({ countryId: idOf(FRANCE) }).expect(401);
  });
});

describe('POST /api/games/:id/give-up', () => {
  it('ends the round with zero points and reveals the answer', async () => {
    const id = await newRound();
    const res = await request(app).post(`/api/games/${id}/give-up`).set(auth).send({});
    expect(res.status).toBe(200);

    const after = await request(app).get(`/api/games/${id}`).set(auth);
    expect(after.body).toMatchObject({ status: 'lost', surrendered: true, answer: 'France', pointsEarned: 0 });
    expect(await myStats()).toMatchObject({ totalPoints: 0, gamesPlayed: 1 });
  });

  it('cannot be repeated to bump statistics', async () => {
    const id = await newRound();
    await request(app).post(`/api/games/${id}/give-up`).set(auth).send({}).expect(200);
    await request(app).post(`/api/games/${id}/give-up`).set(auth).send({}).expect(400);
    expect((await myStats())?.gamesPlayed).toBe(1);
  });

  it('is refused after the round was already won', async () => {
    const id = await newRound();
    await guess(id, FRANCE).expect(200);
    await request(app).post(`/api/games/${id}/give-up`).set(auth).send({}).expect(400);
    expect(await myStats()).toMatchObject({ totalPoints: 100, gamesPlayed: 1, gamesWon: 1 });
  });
});
