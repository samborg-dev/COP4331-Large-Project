// Shared test harness: swaps the real MongoDB, email sender and rate limiter for fakes,
// then loads the real Express app. Import this file FIRST in every API test file.
import { vi } from 'vitest';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { ObjectId } from 'mongodb';
import { FakeDb } from './fakeDb.js';

export const db = new FakeDb();
export const sentMail: { kind: 'verify' | 'reset'; to: string; token: string }[] = [];

process.env.NODE_ENV = 'test';
process.env.ACCESS_TOKEN_SECRET = 'test-secret-test-secret-test-secret';

vi.mock('../src/db.js', () => ({
  connectDB: async () => db,
  getDb: () => db,
}));

vi.mock('../src/mail.js', () => ({
  sendVerificationEmail: async (to: string, token: string) => {
    sentMail.push({ kind: 'verify', to, token });
  },
  sendPasswordResetEmail: async (to: string, token: string) => {
    sentMail.push({ kind: 'reset', to, token });
  },
}));

// 25 requests / 15 min would trip the suite; the limiter has its own test file
vi.mock('../src/middleware/rateLimit.js', () => ({
  authRateLimiter: (_req: unknown, _res: unknown, next: () => void) => next(),
}));

export const { default: app } = await import('../src/index.js');

export const COUNTRIES = [
  { _id: new ObjectId(), name: 'France', iso: 'FR', lat: 46.6, lng: 2.2 },
  { _id: new ObjectId(), name: 'Germany', iso: 'DE', lat: 51.1, lng: 10.4 },
  { _id: new ObjectId(), name: 'Japan', iso: 'JP', lat: 36.2, lng: 138.2 },
  { _id: new ObjectId(), name: 'Central African Republic', iso: 'CF', lat: 6.6, lng: 20.9 },
];

export function resetData() {
  db.reset();
  sentMail.length = 0;
  for (const c of COUNTRIES) db.collection('countries').rows.push({ ...c });
}

export async function createUser(
  overrides: Partial<{ email: string; password: string; emailVerified: boolean; totalPoints: number }> = {},
) {
  const email = overrides.email ?? 'player@example.com';
  const { insertedId } = await db.collection('users').insertOne({
    firstName: 'Test',
    lastName: 'Player',
    email,
    passwordHash: await bcrypt.hash(overrides.password ?? 'password123', 4),
    emailVerified: overrides.emailVerified ?? true,
    totalPoints: overrides.totalPoints ?? 0,
    gamesPlayed: 0,
    gamesWon: 0,
    createdAt: new Date(),
  });
  return { id: insertedId.toString(), _id: insertedId, email };
}

export const tokenFor = (userId: string, opts: jwt.SignOptions = { expiresIn: '5m' }) =>
  jwt.sign({ userId }, process.env.ACCESS_TOKEN_SECRET!, opts);

export const bearer = (userId: string) => ({ Authorization: `Bearer ${tokenFor(userId)}` });
