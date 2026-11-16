import { beforeEach, describe, expect, it } from 'vitest';
import request from 'supertest';
import jwt from 'jsonwebtoken';
import { app, bearer, createUser, db, resetData, sentMail } from './setup.js';
import { hashToken } from '../src/tokens.js';

const valid = { firstName: 'Ada', lastName: 'Lovelace', email: 'ada@example.com', password: 'password123' };

async function registerAndGetToken() {
  await request(app).post('/api/auth/register').send(valid).expect(201);
  return sentMail.at(-1)!.token;
}

beforeEach(resetData);

describe('POST /api/auth/register', () => {
  it('creates an unverified account, stores only a token hash, and emails the raw token', async () => {
    const res = await request(app).post('/api/auth/register').send(valid);
    expect(res.status).toBe(201);

    const user = await db.collection('users').findOne({ email: valid.email });
    expect(user?.emailVerified).toBe(false);
    expect(user?.passwordHash).not.toBe(valid.password); // bcrypt, never plaintext

    expect(sentMail).toHaveLength(1);
    expect(sentMail[0]).toMatchObject({ kind: 'verify', to: valid.email });
    const stored = await db.collection('tokens').findOne({ userId: user?._id });
    expect(stored?.type).toBe('verify');
    expect(stored?.tokenHash).toBe(hashToken(sentMail[0]!.token));
    expect(stored?.tokenHash).not.toBe(sentMail[0]!.token);
  });

  it('rejects a duplicate email with 409, ignoring case', async () => {
    await request(app).post('/api/auth/register').send(valid).expect(201);
    const res = await request(app)
      .post('/api/auth/register')
      .send({ ...valid, email: 'ADA@example.com' });
    expect(res.status).toBe(409);
    expect(res.body.error).toBe('Email already registered');
  });

  it.each([
    ['short password', { password: 'short' }],
    ['bad email', { email: 'not-an-email' }],
    ['missing first name', { firstName: '' }],
  ])('returns 400 for %s', async (_label, patch) => {
    const res = await request(app).post('/api/auth/register').send({ ...valid, ...patch });
    expect(res.status).toBe(400);
    expect(typeof res.body.error).toBe('string');
  });
});

describe('POST /api/auth/verify-email', () => {
  it('verifies the account once, then rejects the reused token', async () => {
    const token = await registerAndGetToken();
    const ok = await request(app).post('/api/auth/verify-email').send({ token });
    expect(ok.status).toBe(200);
    expect((await db.collection('users').findOne({ email: valid.email }))?.emailVerified).toBe(true);

    const again = await request(app).post('/api/auth/verify-email').send({ token });
    expect(again.status).toBe(400);
    expect(again.body.error).toMatch(/invalid or expired/i);
  });

  it('rejects an expired token', async () => {
    const user = await createUser({ emailVerified: false });
    await db.collection('tokens').insertOne({
      userId: user._id,
      type: 'verify',
      tokenHash: hashToken('old-token'),
      expiresAt: new Date(Date.now() - 1000),
    });
    const res = await request(app).post('/api/auth/verify-email').send({ token: 'old-token' });
    expect(res.status).toBe(400);
  });

  it('rejects a missing or made-up token', async () => {
    await request(app).post('/api/auth/verify-email').send({}).expect(400);
    await request(app).post('/api/auth/verify-email').send({ token: 'nope' }).expect(400);
  });
});

describe('POST /api/auth/resend-verification', () => {
  it('sends a fresh link to an unverified user and replaces the old token', async () => {
    const first = await registerAndGetToken();
    const res = await request(app).post('/api/auth/resend-verification').send({ email: valid.email });
    expect(res.status).toBe(200);
    const second = sentMail.at(-1)!.token;
    expect(second).not.toBe(first);

    await request(app).post('/api/auth/verify-email').send({ token: first }).expect(400);
    await request(app).post('/api/auth/verify-email').send({ token: second }).expect(200);
  });

  it('answers 200 without sending anything for unknown or already verified emails', async () => {
    await createUser({ email: 'done@example.com', emailVerified: true });
    await request(app).post('/api/auth/resend-verification').send({ email: 'nobody@example.com' }).expect(200);
    await request(app).post('/api/auth/resend-verification').send({ email: 'done@example.com' }).expect(200);
    expect(sentMail).toHaveLength(0);
  });
});

describe('POST /api/auth/login', () => {
  it('blocks an unverified account with 403', async () => {
    await createUser({ emailVerified: false });
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'player@example.com', password: 'password123' });
    expect(res.status).toBe(403);
    expect(res.body.accessToken).toBeUndefined();
  });

  it('gives the same 401 for a wrong password and an unknown email', async () => {
    await createUser();
    const wrongPw = await request(app)
      .post('/api/auth/login')
      .send({ email: 'player@example.com', password: 'wrong-password' });
    const noUser = await request(app)
      .post('/api/auth/login')
      .send({ email: 'ghost@example.com', password: 'password123' });
    expect(wrongPw.status).toBe(401);
    expect(noUser.status).toBe(401);
    expect(wrongPw.body).toEqual(noUser.body);
  });

  it('returns a signed JWT and the user after registering and verifying', async () => {
    const token = await registerAndGetToken();
    await request(app).post('/api/auth/verify-email').send({ token }).expect(200);

    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: valid.email, password: valid.password });
    expect(res.status).toBe(200);
    expect(res.body.user).toMatchObject({ firstName: 'Ada', email: valid.email, totalPoints: 0 });

    const payload = jwt.verify(res.body.accessToken, process.env.ACCESS_TOKEN_SECRET!) as jwt.JwtPayload;
    expect(payload.userId).toBe(res.body.user.id);
    expect(payload.exp).toBeGreaterThan(Date.now() / 1000);
  });
});

describe('password recovery', () => {
  it('answers 200 for unknown emails without sending mail (no account enumeration)', async () => {
    const res = await request(app).post('/api/auth/forgot-password').send({ email: 'ghost@example.com' });
    expect(res.status).toBe(200);
    expect(sentMail).toHaveLength(0);
  });

  it('resets the password with a one-time token', async () => {
    await createUser({ password: 'old-password-1' });
    await request(app).post('/api/auth/forgot-password').send({ email: 'player@example.com' }).expect(200);
    const mail = sentMail.at(-1)!;
    expect(mail.kind).toBe('reset');

    const reset = await request(app)
      .post('/api/auth/reset-password')
      .send({ token: mail.token, password: 'brand-new-pass' });
    expect(reset.status).toBe(200);

    const reused = await request(app)
      .post('/api/auth/reset-password')
      .send({ token: mail.token, password: 'another-pass-1' });
    expect(reused.status).toBe(400);

    await request(app)
      .post('/api/auth/login')
      .send({ email: 'player@example.com', password: 'old-password-1' })
      .expect(401);
    await request(app)
      .post('/api/auth/login')
      .send({ email: 'player@example.com', password: 'brand-new-pass' })
      .expect(200);
  });

  it('rejects a too-short new password and an expired reset token', async () => {
    const user = await createUser();
    await db.collection('tokens').insertOne({
      userId: user._id,
      type: 'reset',
      tokenHash: hashToken('stale'),
      expiresAt: new Date(Date.now() - 1000),
    });
    await request(app).post('/api/auth/reset-password').send({ token: 'stale', password: 'long-enough-1' }).expect(400);
    await request(app).post('/api/auth/reset-password').send({ token: 'stale', password: 'short' }).expect(400);
  });
});

describe('requireAuth', () => {
  it('rejects missing, malformed, tampered and expired tokens with 401', async () => {
    const user = await createUser();
    await request(app).get('/api/users/me').expect(401);
    await request(app).get('/api/users/me').set('Authorization', 'Bearer not-a-jwt').expect(401);

    const forged = jwt.sign({ userId: user.id }, 'some-other-secret-some-other-secret');
    await request(app).get('/api/users/me').set('Authorization', `Bearer ${forged}`).expect(401);

    const expired = jwt.sign({ userId: user.id }, process.env.ACCESS_TOKEN_SECRET!, { expiresIn: -10 });
    await request(app).get('/api/users/me').set('Authorization', `Bearer ${expired}`).expect(401);

    await request(app).get('/api/users/me').set(bearer(user.id)).expect(200);
  });
});
