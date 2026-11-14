import { Router } from 'express';
import { ObjectId } from 'mongodb';
import { getDb } from '../db.js';
import type { GameDoc } from '../models/game.js';

const router = Router();
const MAX_GUESSES = 6;

// Haversine formula to calculate distance in kilometers between two lat/lng points
function calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371; // Earth's radius in km
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Math.round(R * c);
}

// Helper to normalize countries whether stored as GeoJSON features or flat documents
async function getAllNormalizedCountries() {
  const db = getDb();
  const docs = await db.collection('countries').find({}).toArray();

  const normalized: Array<{ id: string; name: string; lat: number; lng: number }> = [];

  for (const doc of docs as any[]) {
    if (Array.isArray(doc.features)) {
      for (const f of doc.features) {
        const [lng, lat] = f?.geometry?.coordinates ?? [0, 0];
        normalized.push({
          id: f?.properties?.ISO ?? f?.properties?.COUNTRY ?? String(doc._id),
          name: f?.properties?.COUNTRY ?? 'Unknown',
          lat: Number(lat) || 0,
          lng: Number(lng) || 0,
        });
      }
    } else {
      const [lng, lat] = doc?.geometry?.coordinates ?? [doc.lng ?? 0, doc.lat ?? 0];
      normalized.push({
        id: String(doc.iso ?? doc.ISO ?? doc._id),
        name: doc.name ?? doc.COUNTRY ?? doc?.properties?.COUNTRY ?? 'Unknown',
        lat: Number(lat) || 0,
        lng: Number(lng) || 0,
      });
    }
  }

  return normalized;
}

// POST /api/games - Start a new game session (never returns target)
router.post('/', async (req, res) => {
  try {
    const db = getDb();
    const rawUserId = (req as any).userId ?? (req as any).user?.userId ?? req.body?.userId;
    const userId =
      rawUserId && ObjectId.isValid(String(rawUserId))
        ? new ObjectId(String(rawUserId))
        : null;

    const countries = await getAllNormalizedCountries();
    if (countries.length === 0) {
      return res.status(500).json({ error: 'No country data loaded in database' });
    }

    const randomCountry = countries[Math.floor(Math.random() * countries.length)]!;

    const newGame: GameDoc = {
      userId,
      targetCountry: randomCountry.name,
      targetIso: randomCountry.id,
      targetLat: randomCountry.lat,
      targetLng: randomCountry.lng,
      guesses: [],
      status: 'IN_PROGRESS',
      createdAt: new Date(),
    };

    const result = await db.collection<GameDoc>('games').insertOne(newGame);

    return res.status(201).json({
      gameId: result.insertedId.toString(),
      maxGuesses: MAX_GUESSES,
    });
  } catch (error) {
    console.error('Start game error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/games/:id - Resume a round (guesses so far, status, never target while IN_PROGRESS)
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    if (!ObjectId.isValid(id)) {
      return res.status(400).json({ error: 'Invalid game ID' });
    }

    const db = getDb();
    const game = await db.collection<GameDoc>('games').findOne({ _id: new ObjectId(id) });

    if (!game) {
      return res.status(404).json({ error: 'Game session not found' });
    }

    return res.status(200).json({
      gameId: game._id.toString(),
      status: game.status,
      maxGuesses: MAX_GUESSES,
      guessesUsed: game.guesses.length,
      guesses: game.guesses,
      targetCountry: game.status !== 'IN_PROGRESS' ? game.targetCountry : undefined,
      pointsEarned: game.pointsEarned,
    });
  } catch (error) {
    console.error('Get game error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/games/:id/guesses - Submit a guess for an active game
router.post('/:id/guesses', async (req, res) => {
  try {
    const { id } = req.params;
    if (!ObjectId.isValid(id)) {
      return res.status(400).json({ error: 'Invalid game ID' });
    }

    const db = getDb();
    const game = await db.collection<GameDoc>('games').findOne({ _id: new ObjectId(id) });

    if (!game) {
      return res.status(404).json({ error: 'Game session not found' });
    }

    if (game.status !== 'IN_PROGRESS') {
      return res.status(400).json({ error: 'Game session is already completed' });
    }

    const { countryId, guessLat, guessLng, guessName } = req.body;
    let resolvedName = guessName || 'Unknown';
    let resolvedLat = guessLat;
    let resolvedLng = guessLng;

    // If the client sends { countryId } per API contract, look up its coordinates
    if (countryId && (resolvedLat === undefined || resolvedLng === undefined)) {
      const countries = await getAllNormalizedCountries();
      const matched = countries.find(
        (c) =>
          c.id.toLowerCase() === String(countryId).toLowerCase() ||
          c.name.toLowerCase() === String(countryId).toLowerCase()
      );
      if (!matched) {
        return res.status(404).json({ error: 'Guessed country not found' });
      }
      resolvedName = matched.name;
      resolvedLat = matched.lat;
      resolvedLng = matched.lng;
    }

    if (typeof resolvedLat !== 'number' || typeof resolvedLng !== 'number') {
      return res.status(400).json({ error: 'Valid countryId or guess coordinates are required' });
    }

    const distance = calculateDistance(resolvedLat, resolvedLng, game.targetLat, game.targetLng);
    const isSameCountry =
      resolvedName.toLowerCase() === game.targetCountry.toLowerCase() ||
      (countryId && game.targetIso && String(countryId).toLowerCase() === game.targetIso.toLowerCase());
    const solved = Boolean(isSameCountry || distance <= 50);

    const guessesUsed = game.guesses.length + 1;
    const isLost = !solved && guessesUsed >= MAX_GUESSES;
    const newStatus: GameDoc['status'] = solved ? 'WON' : isLost ? 'LOST' : 'IN_PROGRESS';

    const range =
      distance < 500
        ? '< 500 km'
        : distance <= 1500
          ? '500–1,500 km'
          : distance <= 3000
            ? '1,500–3,000 km'
            : distance <= 6000
              ? '3,000–6,000 km'
              : '> 6,000 km';
    const pointsEarned = solved ? Math.max(10, 100 - (guessesUsed - 1) * 10) : undefined;

    game.guesses.push({
      countryId: countryId ? String(countryId) : undefined,
      guessName: resolvedName,
      lat: resolvedLat,
      lng: resolvedLng,
      distance,
      range,
      createdAt: new Date(),
    });
    game.status = newStatus;
    if (pointsEarned !== undefined) {
      game.pointsEarned = pointsEarned;
    }

    await db.collection<GameDoc>('games').replaceOne({ _id: game._id }, game);
    
    if ((solved || isLost) && game.userId) {
      await db.collection('users').updateOne(
        { _id: game.userId },
        {
          $inc: {
            gamesPlayed: 1,
            gamesWon: solved ? 1 : 0,
            totalPoints: pointsEarned ?? 0,
          },
        }
      );
    }

    return res.status(200).json({
      country: resolvedName,
      range: solved ? 'Correct' : range,
      solved,
      guessesUsed,
      ...(pointsEarned !== undefined ? { pointsEarned } : {}),
    });
  } catch (error) {
    console.error('Submit guess error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;