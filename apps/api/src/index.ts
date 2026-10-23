import cors from 'cors';
import express from 'express';
import { setApp } from './api.js';
import { connectDb } from './db.js';
import { env } from './env.js';

const app = express();
app.use(cors());
app.use(express.json());

app.get('/health', (_req, res) => {
  res.json({ ok: true });
});

setApp(app);

connectDb().catch((err) => console.error('MongoDB connection failed:', err.message));

app.listen(env.PORT, () => {
  console.log(`API listening on port ${env.PORT}`);
});
