import { MongoClient, Db } from 'mongodb';
import dotenv from 'dotenv';

dotenv.config();

let client: MongoClient | null = null;
let dbInstance: Db | null = null;

export async function connectDB(): Promise<Db> {
  if (dbInstance) return dbInstance;
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    throw new Error('MONGODB_URI is not set in environment');
  }
  client = new MongoClient(uri);
  await client.connect();
  dbInstance = client.db();
  return dbInstance;
}

export function getDb(): Db {
  if (!dbInstance) {
    throw new Error('Database not connected. Call connectDB() first.');
  }
  return dbInstance;
}
