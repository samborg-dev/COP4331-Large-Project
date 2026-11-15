import mongoose from 'mongoose';

const gameSchema = new mongoose.Schema({
  userID: String,
  status: String,
  guesses: [String], 
  maxGuesses: Number, 
  startedAt: Date,
  endedAt: Date,
});


const Game = mongoose.model('Game', gameSchema); 

export default Game;
