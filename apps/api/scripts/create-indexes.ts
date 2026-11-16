// Creates every index the app relies on. Safe to re-run (createIndex is idempotent).
//   pnpm --filter @cop4331/api db:indexes
import { MongoClient } from 'mongodb';
import { config } from 'dotenv';

config({ path: new URL('../../../.env', import.meta.url) });

const uri = process.env.MONGODB_URI;
if (!uri) throw new Error('MONGODB_URI is not set (see .env.example)');

const client = new MongoClient(uri);
try {
  await client.connect();
  const db = client.db();

  await db.collection('users').createIndex({ email: 1 }, { unique: true });
  await db.collection('users').createIndex({ totalPoints: -1, gamesWon: -1 }); // leaderboard
  // Expired verify/reset tokens are deleted by MongoDB itself
  await db.collection('tokens').createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 });
  await db.collection('tokens').createIndex({ tokenHash: 1 });
  await db.collection('games').createIndex({ userId: 1, status: 1 });

  console.log('Indexes ready: users(email unique, totalPoints), tokens(TTL expiresAt, tokenHash), games(userId, status)');
} finally {
  await client.close();
}
