export {};
import mongoose from 'mongoose';

const guessSchema = new mongoose.Schema({
  guessName: { type: String, required: true },
  lat: { type: Number, required: true },
  lng: { type: Number, required: true },
  distance: { type: Number, required: true },
  createdAt: { type: Date, default: Date.now }
});

const gameSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  targetCountry: { type: String, required: true },
  targetLat: { type: Number, required: true },
  targetLng: { type: Number, required: true },
  guesses: [guessSchema],
  status: { type: String, enum: ['IN_PROGRESS', 'WON', 'LOST'], default: 'IN_PROGRESS' },
  createdAt: { type: Date, default: Date.now }
});

const Game = mongoose.model('Game', gameSchema);
export default Game;