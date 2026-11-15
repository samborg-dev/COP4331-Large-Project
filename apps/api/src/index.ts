import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { ObjectId } from 'mongodb';
import { connectDB, getDb } from './db.js';
import authRouter from './routes/auth.js';
import gamesRouter from './routes/games.js';
import { requireAuth, type AuthenticatedRequest } from './middleware/requireAuth.js';

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

app.get('/health', (_req, res) => {
  res.status(200).json({ status: 'ok' });
});

// Public auth routes
app.use('/api/auth', authRouter);

// Protected game routes
app.use('/api/games', requireAuth, gamesRouter);

// GET /api/users/me (Protected)
app.get('/api/users/me', requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    if (!req.userId || !ObjectId.isValid(req.userId)) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const db = getDb();
    const user = await db.collection('users').findOne({ _id: new ObjectId(req.userId) });
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    const name =
      user.username ??
      ([user.firstName, user.lastName].filter(Boolean).join(' ') || user.email);

    return res.status(200).json({
      id: user._id.toString(),
      name,
      firstName: user.firstName,
      lastName: user.lastName,
      email: user.email,
      totalPoints: user.totalPoints ?? 0,
      gamesPlayed: user.gamesPlayed ?? 0,
      gamesWon: user.gamesWon ?? 0,
    });
  } catch (error) {
    console.error('Get current user error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/countries/search?q=fra&limit=10 (Protected)
app.get('/api/countries/search', requireAuth, async (req, res) => {
  try {
    const q = typeof req.query.q === 'string' ? req.query.q.trim() : '';
    const limit = Math.min(50, Math.max(1, Number(req.query.limit) || 10));

    if (!q) {
      return res.status(400).json({ error: 'Search query parameter "q" is required' });
    }

    const escaped = q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const db = getDb();

    // Try Atlas Search index "name" on path "COUNTRY" first, fallback to regex
    try {
      const atlasResults = await db
        .collection('countries')
        .aggregate([
          {
            $search: {
              index: 'name',
              autocomplete: {
                query: escaped,
                path: 'COUNTRY',
              },
            },
          },
          { $limit: limit },
        ])
        .toArray();

      if (atlasResults.length > 0) {
        return res.status(200).json({
          countries: atlasResults.map((doc: any) => ({
            id: String(doc.ISO ?? doc.iso ?? doc._id),
            name: doc.COUNTRY ?? doc.name ?? 'Unknown',
          })),
        });
      }
    } catch {
      // Fallback to standard regex query below if Atlas Search index is unavailable
    }

    const regex = new RegExp(escaped, 'i');
    const docs = await db.collection('countries').find({}).toArray();
    const matches: Array<{ id: string; name: string }> = [];

    for (const doc of docs as any[]) {
      if (Array.isArray(doc.features)) {
        for (const f of doc.features) {
          const name = f?.properties?.COUNTRY ?? '';
          if (regex.test(name)) {
            matches.push({
              id: String(f?.properties?.ISO ?? f?.properties?.COUNTRY ?? doc._id),
              name,
            });
            if (matches.length >= limit) break;
          }
        }
      } else {
        const name = doc.COUNTRY ?? doc.name ?? doc?.properties?.COUNTRY ?? '';
        if (regex.test(name)) {
          matches.push({
            id: String(doc.ISO ?? doc.iso ?? doc._id),
            name,
          });
        }
      }
      if (matches.length >= limit) break;
    }

    return res.status(200).json({ countries: matches });
  } catch (error) {
    console.error('Country search error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/leaderboard?page=1&limit=20 (Protected)
app.get('/api/leaderboard', requireAuth, async (req, res) => {
  try {
    const page = Math.max(1, Number(req.query.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 20));
    const skip = (page - 1) * limit;

    const db = getDb();
    const usersCol = db.collection('users');

    const [users, total] = await Promise.all([
      usersCol
        .find({})
        .sort({ totalPoints: -1, gamesWon: -1 })
        .skip(skip)
        .limit(limit)
        .toArray(),
      usersCol.countDocuments({}),
    ]);

    const leaderboard = users.map((u: any, idx: number) => ({
      rank: skip + idx + 1,
      userId: u._id.toString(),
      name: u.username ?? ([u.firstName, u.lastName].filter(Boolean).join(' ') || u.email),
      totalPoints: u.totalPoints ?? 0,
      gamesPlayed: u.gamesPlayed ?? 0,
      gamesWon: u.gamesWon ?? 0,
    }));

    return res.status(200).json({
      page,
      limit,
      total,
      leaderboard,
    });
  } catch (error) {
    console.error('Leaderboard error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

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