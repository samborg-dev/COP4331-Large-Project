import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { ObjectId } from 'mongodb';
import { connectDB, getDb } from './db.js';
import authRouter from './routes/auth.js';
import gamesRouter from './routes/games.js';
import { requireAuth, type AuthenticatedRequest } from './middleware/requireAuth.js';
import { countryNameMatches } from './utils/countryName.js';

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

// GET /api/users/me (Bearer Auth)
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

    return res.status(200).json({
      id: user._id.toString(),
      firstName: (user.firstName as string) ?? (user.username as string) ?? '',
      lastName: (user.lastName as string) ?? '',
      email: (user.email as string) ?? '',
      totalPoints: (user.totalPoints as number) ?? 0,
      gamesPlayed: (user.gamesPlayed as number) ?? 0,
      gamesWon: (user.gamesWon as number) ?? 0,
    });
  } catch (error) {
    console.error('Get current user error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/countries/search?q=fra&limit=10 (Bearer Auth)
// Returns top-level array: [{ id, name, iso2, iso3, continent }] matching any part of a
// country name, including accent-insensitive names.
app.get('/api/countries/search', requireAuth, async (req, res) => {
  try {
    const q = typeof req.query.q === 'string' ? req.query.q.trim() : '';
    const limit = Math.min(50, Math.max(1, Number(req.query.limit) || 10));

    if (!q) {
      return res.status(400).json({ error: 'Search query parameter "q" is required' });
    }

    const escaped = q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const wildcardQuery = q.replace(/[\\*?]/g, '\\$&');
    const db = getDb();

    // 1. Try MongoDB Atlas Search index "name" for partial matches first
    try {
      const atlasResults = await db
        .collection('countries')
        .aggregate([
          {
            $search: {
              index: 'name',
              wildcard: {
                query: `*${wildcardQuery}*`,
                path: 'COUNTRY',
                allowAnalyzedField: true,
              },
            },
          },
          {
            $match: {
              COUNTRY: { $regex: escaped, $options: 'i' },
            },
          },
          { $limit: limit },
        ])
        .toArray();

      if (atlasResults.length > 0) {
        return res.status(200).json(
          atlasResults.map((doc: any) => {
            const iso2 = String(doc.ISO ?? doc.iso2 ?? doc.ISO_A2 ?? '');
            const iso3 = String(doc.ISO_A3 ?? doc.iso3 ?? iso2);
            return {
              id: String(doc._id ?? iso2),
              name: String(doc.COUNTRY ?? doc.name ?? 'Unknown'),
              iso2,
              iso3,
              continent: String(doc.CONTINENT ?? doc.continent ?? ''),
            };
          })
        );
      }
    } catch {
      // Fallback to collection scan below if Atlas Search index is unavailable
    }

    // 2. Fallback partial regex over countries collection
    const docs = await db.collection('countries').find({}).toArray();
    const matches: Array<{
      id: string;
      name: string;
      iso2: string;
      iso3: string;
      continent: string;
    }> = [];

    for (const doc of docs as any[]) {
      if (Array.isArray(doc.features)) {
        for (const f of doc.features) {
          const name = String(f?.properties?.COUNTRY ?? f?.properties?.name ?? '');
          if (countryNameMatches(name, q)) {
            const iso2 = String(f?.properties?.ISO ?? f?.properties?.ISO_A2 ?? '');
            const iso3 = String(f?.properties?.ISO_A3 ?? f?.properties?.iso3 ?? iso2);
            matches.push({
              id: String(f?.properties?.ISO ?? doc._id),
              name,
              iso2,
              iso3,
              continent: String(f?.properties?.CONTINENT ?? f?.properties?.continent ?? ''),
            });
            if (matches.length >= limit) break;
          }
        }
      } else {
        const name = String(doc.COUNTRY ?? doc.name ?? doc?.properties?.COUNTRY ?? '');
        if (countryNameMatches(name, q)) {
          const iso2 = String(doc.ISO ?? doc.iso ?? doc.iso2 ?? '');
          const iso3 = String(doc.ISO_A3 ?? doc.iso3 ?? iso2);
          matches.push({
            id: String(doc._id ?? iso2),
            name,
            iso2,
            iso3,
            continent: String(doc.CONTINENT ?? doc.continent ?? ''),
          });
        }
      }
      if (matches.length >= limit) break;
    }

    return res.status(200).json(matches);
  } catch (error) {
    console.error('Country search error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/leaderboard?page=1&limit=20 (Bearer Auth)
// Returns { entries: [{ rank, userId, firstName, lastName, totalPoints, gamesWon }], page, limit, total }
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

    const entries = users.map((u: any, idx: number) => ({
      rank: skip + idx + 1,
      userId: u._id.toString(),
      firstName: String(u.firstName ?? u.username ?? 'Player'),
      lastName: String(u.lastName ?? ''),
      totalPoints: Number(u.totalPoints ?? 0),
      gamesWon: Number(u.gamesWon ?? 0),
    }));

    return res.status(200).json({
      entries,
      page,
      limit,
      total,
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