import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { connectDB } from './db';
import authRouter from './routes/auth';

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

app.get('/health', (_req, res) => {
  res.status(200).json({ status: 'ok' });
});

app.use('/api/auth', authRouter);

const PORT = process.env.PORT || 5000;

if (process.env.NODE_ENV !== 'test') {
  connectDB()
    .then(() => {
      app.listen(PORT, () => {
        console.log(`API listening on port ${PORT}`);
      });
    })
    .catch((err) => {
      console.error('MongoDB connection failed:', err);
      process.exit(1);
    });
}

export default app;
