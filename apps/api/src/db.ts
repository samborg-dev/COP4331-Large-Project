import { MongoClient } from 'mongodb';
import { env } from './env.js';

export const client = new MongoClient(env.MONGODB_URI);

export async function connectDb(): Promise<void> {
  await client.connect();
  console.log('MongoDB connected');
}

// uses the database named in the connection string
export const db = () => client.db();
