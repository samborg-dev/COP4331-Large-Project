import mongoose from 'mongoose';

const userSchema = new mongoose.Schema({
  email: String,
  username: String,
  passwordHash: String,
  emailVerified: String,
  totalPoints: Number,
  gamesPlayed: Number,
  gamesWon: Number,
  createdAt: Date 
});



const User = mongoose.model('User', userSchema);
export default User;
