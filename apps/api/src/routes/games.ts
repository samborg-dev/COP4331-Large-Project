import { Router } from 'express';
import Game from '../models/game';
import Country from '../models/country';
import { ObjectId } from 'mongodb';

const router = Router();

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

// POST /api/games - Start a new game session
router.post('/', async (req, res) => {
  try {
    const { userId } = req.body;

    // Pull from the team's GeoJSON Country model
    const countryDocs = await Country.find({});
    const allFeatures = countryDocs.flatMap((doc: any) => doc.features || []);

    if (allFeatures.length === 0) {
      return res.status(500).json({ error: 'No country data loaded in database' });
    }

const randomFeature = allFeatures[Math.floor(Math.random() * allFeatures.length)];
    const countryName = randomFeature?.properties?.COUNTRY ?? 'Unknown';
    const [lng, lat] = randomFeature?.geometry?.coordinates ?? [0, 0];

    const gameSession = new Game({
      userId: userId ? new ObjectId(userId) : null,
      targetCountry: countryName,
      targetLat: lat,
      targetLng: lng,
      guesses: [],
      status: 'IN_PROGRESS'
    });

    const savedGame = await gameSession.save();

    return res.status(201).json({
      gameId: savedGame._id,
      message: 'New game started',
      maxGuesses: 6
    });
  } catch (error) {
    console.error('Start game error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/games/:id/guesses - Submit a guess for an active game
router.post('/:id/guesses', async (req, res) => {
  try {
    const { id } = req.params;
    const { guessLat, guessLng, guessName } = req.body;

    if (guessLat === undefined || guessLng === undefined) {
      return res.status(400).json({ error: 'Guess latitude and longitude are required' });
    }

    const game = await Game.findById(id);

    if (!game) {
      return res.status(404).json({ error: 'Game session not found' });
    }

    if (game.status !== 'IN_PROGRESS') {
      return res.status(400).json({ error: 'Game session is already completed' });
    }

    const distance = calculateDistance(guessLat, guessLng, game.targetLat, game.targetLng);
    const isWon = distance <= 50; // Within 50km counts as correct
    const newGuessesCount = game.guesses.length + 1;
    const isLost = !isWon && newGuessesCount >= 6;

    const newStatus = isWon ? 'WON' : isLost ? 'LOST' : 'IN_PROGRESS';

    game.guesses.push({
      guessName: guessName || 'Unknown',
      lat: guessLat,
      lng: guessLng,
      distance
    });
    game.status = newStatus;

    await game.save();

    return res.json({
      distance,
      isWon,
      isLost,
      targetCountry: isWon || isLost ? game.targetCountry : undefined,
      attemptsRemaining: Math.max(0, 6 - newGuessesCount)
    });
  } catch (error) {
    console.error('Submit guess error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;