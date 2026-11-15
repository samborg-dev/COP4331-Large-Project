import { Router } from 'express';
import { ObjectId } from 'mongodb';
import { getDb } from '../db.js';
import type { GameDoc } from '../models/game.js';
import type { AuthenticatedRequest } from '../middleware/requireAuth.js';

const router = Router();
const MAX_GUESSES = 10;
const DIRECTIONS = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'] as const;

type NormalizedCountry = {
  id: string;
  mongoId: string;
  iso2: string;
  iso3: string;
  name: string;
  lat: number;
  lng: number;
};

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

function calculateDirection(lat1: number, lon1: number, lat2: number, lon2: number): string {
  const toRadians = (degrees: number) => (degrees * Math.PI) / 180;
  const dLon = toRadians(lon2 - lon1);
  const latitude1 = toRadians(lat1);
  const latitude2 = toRadians(lat2);
  const y = Math.sin(dLon) * Math.cos(latitude2);
  const x =
    Math.cos(latitude1) * Math.sin(latitude2) -
    Math.sin(latitude1) * Math.cos(latitude2) * Math.cos(dLon);
  const bearing = (Math.atan2(y, x) * 180) / Math.PI;
  const normalizedBearing = (bearing + 360) % 360;
  return DIRECTIONS[Math.round(normalizedBearing / 45) % DIRECTIONS.length]!;
}

// Helper to normalize countries whether stored as GeoJSON features or flat CSV documents
async function getAllNormalizedCountries(): Promise<NormalizedCountry[]> {
  const db = getDb();
  const docs = await db.collection('countries').find({}).toArray();

  const normalized: NormalizedCountry[] = [];

  for (const doc of docs as any[]) {
    const mongoId = String(doc._id ?? '');
    if (Array.isArray(doc.features)) {
      for (const f of doc.features) {
        const [lng, lat] = f?.geometry?.coordinates ?? [0, 0];
        const iso2 = String(f?.properties?.ISO ?? f?.properties?.ISO_A2 ?? '');
        const iso3 = String(f?.properties?.ISO_A3 ?? f?.properties?.iso3 ?? iso2);
        const name = String(f?.properties?.COUNTRY ?? f?.properties?.name ?? 'Unknown');
        normalized.push({
          id: mongoId || iso2 || name,
          mongoId,
          iso2,
          iso3,
          name,
          lat: Number(lat) || 0,
          lng: Number(lng) || 0,
        });
      }
    } else {
      const coords = doc?.geometry?.coordinates;
      const lng = Array.isArray(coords)
        ? coords[0]
        : (doc.lng ?? doc.longitude ?? doc.LON ?? doc.lon ?? doc.LONGITUDE ?? 0);
      const lat = Array.isArray(coords)
        ? coords[1]
        : (doc.lat ?? doc.latitude ?? doc.LAT ?? doc.LATITUDE ?? 0);
      const iso2 = String(doc.ISO ?? doc.iso ?? doc.iso2 ?? doc.ISO_A2 ?? '');
      const iso3 = String(doc.ISO_A3 ?? doc.iso3 ?? iso2);
      const name = String(doc.COUNTRY ?? doc.name ?? doc?.properties?.COUNTRY ?? 'Unknown');
      normalized.push({
        id: mongoId || iso2 || name,
        mongoId,
        iso2,
        iso3,
        name,
        lat: Number(lat) || 0,
        lng: Number(lng) || 0,
      });
    }
  }

  return normalized;
}

function mapStatusToContract(status: GameDoc['status']): 'active' | 'won' | 'lost' {
  if (status === 'WON') return 'won';
  if (status === 'LOST') return 'lost';
  return 'active';
}

// 1. POST /api/games - Start a new game session
router.post('/', async (req: AuthenticatedRequest, res) => {
  try {
    const db = getDb();
    const rawUserId = req.userId ?? (req as any).user?.userId ?? req.body?.userId;
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
      targetIso: randomCountry.iso2 || randomCountry.id,
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

// 2. GET /api/games/:id - Resume a round
router.get('/:id', async (req: AuthenticatedRequest, res) => {
  try {
    const { id } = req.params;
    if (typeof id !== 'string' || !ObjectId.isValid(id)) {
      return res.status(404).json({ error: 'Game not found' });
    }

    const db = getDb();
    const game = await db.collection<GameDoc>('games').findOne({ _id: new ObjectId(id) });

    if (!game) {
      return res.status(404).json({ error: 'Game not found' });
    }

    if (game.userId && req.userId && game.userId.toString() !== req.userId) {
      return res.status(403).json({ error: "Cannot access another user's game" });
    }

    return res.status(200).json({
      gameId: game._id.toString(),
      status: mapStatusToContract(game.status),
      guesses: game.guesses.map((g) => ({
        countryId: g.countryId ?? g.guessName,
        country: g.guessName,
        range: g.range ?? '< 500 km',
        distance: g.distance ?? calculateDistance(g.lat, g.lng, game.targetLat, game.targetLng),
        direction:
          g.direction ??
          (g.range === 'Correct'
            ? 'Correct'
            : calculateDirection(g.lat, g.lng, game.targetLat, game.targetLng)),
        at: (g.createdAt instanceof Date ? g.createdAt : new Date(g.createdAt)).toISOString(),
      })),
      maxGuesses: MAX_GUESSES,
      guessesUsed: game.guesses.length,
      pointsEarned: game.pointsEarned ?? 0,
      surrendered: game.surrendered ?? false,
      ...(game.status !== 'IN_PROGRESS' ? { answer: game.targetCountry } : {}),
    });
  } catch (error) {
    console.error('Get game error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// 3. POST /api/games/:id/give-up - End an active game without awarding points
router.post('/:id/give-up', async (req: AuthenticatedRequest, res) => {
  try {
    const { id } = req.params;
    if (typeof id !== 'string' || !ObjectId.isValid(id)) {
      return res.status(404).json({ error: 'Game not found' });
    }

    const db = getDb();
    const game = await db.collection<GameDoc>('games').findOne({ _id: new ObjectId(id) });
    if (!game) {
      return res.status(404).json({ error: 'Game not found' });
    }
    if (game.userId && game.userId.toString() !== req.userId) {
      return res.status(403).json({ error: "Cannot give up another user's game" });
    }
    if (game.status !== 'IN_PROGRESS') {
      return res.status(400).json({ error: 'Game is already finished' });
    }

    const ended = await db.collection<GameDoc>('games').updateOne(
      { _id: game._id, status: 'IN_PROGRESS' },
      { $set: { status: 'LOST', pointsEarned: 0, surrendered: true } },
    );
    if (ended.modifiedCount !== 1) {
      return res.status(400).json({ error: 'Game is already finished' });
    }

    if (game.userId) {
      await db.collection('users').updateOne(
        { _id: game.userId },
        { $inc: { gamesPlayed: 1 } },
      );
    }

    return res.status(200).json({ gameId: game._id.toString() });
  } catch (error) {
    console.error('Give up game error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// 4. POST /api/games/:id/guesses - Submit a guess for an active game
router.post('/:id/guesses', async (req: AuthenticatedRequest, res) => {
  try {
    const { id } = req.params;
    console.log('[DEBUG GUESS] gameId:', id, 'body:', req.body);

    if (typeof id !== 'string' || !ObjectId.isValid(id)) {
      return res.status(404).json({ error: 'Game not found' });
    }

    const db = getDb();
    const game = await db.collection<GameDoc>('games').findOne({ _id: new ObjectId(id) });

    if (!game) {
      return res.status(404).json({ error: 'Game not found' });
    }

    if (game.userId && req.userId && game.userId.toString() !== req.userId) {
      return res.status(403).json({ error: "Cannot guess on another user's game" });
    }

    if (game.status !== 'IN_PROGRESS') {
      return res.status(400).json({ error: 'Game is already finished' });
    }

    const { countryId, country, id: bodyId, name: bodyName, guessLat, guessLng, guessName } = req.body ?? {};
    const rawLookup = String(countryId ?? country ?? bodyId ?? bodyName ?? guessName ?? '').trim();

    let resolvedId = rawLookup || undefined;
    let resolvedName = guessName || country || bodyName || 'Unknown';
    let resolvedLat = guessLat;
    let resolvedLng = guessLng;

    if (rawLookup && (resolvedLat === undefined || resolvedLng === undefined)) {
      const countries = await getAllNormalizedCountries();
      const targetLower = rawLookup.toLowerCase();
      let matched = countries.find(
        (c) =>
          c.id.toLowerCase() === targetLower ||
          c.mongoId.toLowerCase() === targetLower ||
          c.iso2.toLowerCase() === targetLower ||
          c.iso3.toLowerCase() === targetLower ||
          c.name.toLowerCase() === targetLower
      );

      if (!matched && ObjectId.isValid(rawLookup)) {
        const rawDoc: any = await db.collection('countries').findOne({ _id: new ObjectId(rawLookup) });
        if (rawDoc) {
          const coords = rawDoc?.geometry?.coordinates;
          const lng = Array.isArray(coords)
            ? coords[0]
            : (rawDoc.lng ?? rawDoc.longitude ?? rawDoc.LON ?? rawDoc.lon ?? rawDoc.LONGITUDE ?? 0);
          const lat = Array.isArray(coords)
            ? coords[1]
            : (rawDoc.lat ?? rawDoc.latitude ?? rawDoc.LAT ?? rawDoc.LATITUDE ?? 0);
          const iso2 = String(rawDoc.ISO ?? rawDoc.iso ?? rawDoc.iso2 ?? rawDoc.ISO_A2 ?? '');
          const name = String(rawDoc.COUNTRY ?? rawDoc.name ?? rawDoc?.properties?.COUNTRY ?? 'Unknown');
          matched = {
            id: String(rawDoc._id),
            mongoId: String(rawDoc._id),
            iso2,
            iso3: String(rawDoc.ISO_A3 ?? rawDoc.iso3 ?? iso2),
            name,
            lat: Number(lat) || 0,
            lng: Number(lng) || 0,
          };
        }
      }

      if (!matched) {
        console.log('[DEBUG GUESS] Country not found for:', rawLookup);
        return res.status(404).json({ error: 'Guessed country not found' });
      }
      resolvedId = matched.id;
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
      (resolvedId && game.targetIso && resolvedId.toLowerCase() === game.targetIso.toLowerCase());
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
    const direction = solved
      ? 'Correct'
      : calculateDirection(resolvedLat, resolvedLng, game.targetLat, game.targetLng);

    game.guesses.push({
      countryId: resolvedId,
      guessName: resolvedName,
      lat: resolvedLat,
      lng: resolvedLng,
      distance,
      range: solved ? 'Correct' : range,
      direction,
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
      distance,
      direction,
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