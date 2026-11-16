import { beforeEach, describe, expect, it } from 'vitest';
import { ObjectId } from 'mongodb';
import request from 'supertest';
import { app, bearer, createUser, db, resetData } from './setup.js';

let auth: Record<string, string>;

beforeEach(async () => {
  resetData();
  const user = await createUser();
  auth = bearer(user.id);
});

const search = (q: string, extra = '') => request(app).get(`/api/countries/search?q=${encodeURIComponent(q)}${extra}`).set(auth);

describe('GET /api/countries/search (server-side partial match)', () => {
  it('requires a bearer token', async () => {
    await request(app).get('/api/countries/search?q=fra').expect(401);
  });

  it('matches a prefix', async () => {
    const res = await search('fra');
    expect(res.status).toBe(200);
    expect(res.body.map((c: any) => c.name)).toEqual(['France']);
  });

  it('matches in the middle of a name', async () => {
    const res = await search('afric');
    expect(res.body.map((c: any) => c.name)).toEqual(['Central African Republic']);
  });

  it('is case-insensitive', async () => {
    const res = await search('JAPAN');
    expect(res.body.map((c: any) => c.name)).toEqual(['Japan']);
  });

  it('matches accented country names when the query omits accents', async () => {
    db.collection('countries').rows.push(
      { _id: new ObjectId(), name: "Côte d'Ivoire", iso: 'CI' },
      { _id: new ObjectId(), name: 'São Tomé and Príncipe', iso: 'ST' },
    );

    const cote = await search('cote');
    const sao = await search('sao');

    expect(cote.body.map((c: any) => c.name)).toEqual(["Côte d'Ivoire"]);
    expect(sao.body.map((c: any) => c.name)).toEqual(['São Tomé and Príncipe']);
  });

  it('returns id, name and iso codes for each result', async () => {
    const [france] = (await search('france')).body;
    expect(france).toMatchObject({ name: 'France', iso2: 'FR' });
    expect(typeof france.id).toBe('string');
  });

  it('returns an empty array when nothing matches', async () => {
    const res = await search('atlantis');
    expect(res.status).toBe(200);
    expect(res.body).toEqual([]);
  });

  it('rejects an empty query with 400', async () => {
    await request(app).get('/api/countries/search?q=').set(auth).expect(400);
    await request(app).get('/api/countries/search').set(auth).expect(400);
  });

  it('treats regex characters literally instead of as a pattern', async () => {
    for (const q of ['(', '.*', '[a-z', 'fr|ja', '\\']) {
      const res = await search(q);
      expect(res.status).toBe(200);
      expect(res.body).toEqual([]);
    }
  });

  it('honours the limit parameter', async () => {
    const res = await search('a', '&limit=2');
    expect(res.body).toHaveLength(2);
  });
});

describe('GET /api/users/me', () => {
  it("returns the signed-in user's profile without secrets", async () => {
    const res = await request(app).get('/api/users/me').set(auth);
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ email: 'player@example.com', totalPoints: 0, gamesPlayed: 0, gamesWon: 0 });
    expect(res.body.passwordHash).toBeUndefined();
  });
});

describe('GET /api/leaderboard', () => {
  it('ranks players by points and paginates', async () => {
    await db.collection('users').rows.splice(0); // drop the default user
    for (const [i, points] of [50, 300, 120].entries()) {
      await createUser({ email: `p${i}@example.com`, totalPoints: points });
    }

    const first = await request(app).get('/api/leaderboard?page=1&limit=2').set(auth);
    expect(first.status).toBe(200);
    expect(first.body).toMatchObject({ page: 1, limit: 2, total: 3 });
    expect(first.body.entries.map((e: any) => [e.rank, e.totalPoints])).toEqual([
      [1, 300],
      [2, 120],
    ]);

    const second = await request(app).get('/api/leaderboard?page=2&limit=2').set(auth);
    expect(second.body.entries.map((e: any) => [e.rank, e.totalPoints])).toEqual([[3, 50]]);
  });

  it('requires a bearer token', async () => {
    await request(app).get('/api/leaderboard').expect(401);
  });
});
