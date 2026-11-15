import mongoose from 'mongoose';

const tokenSchema = new mongoose.Schema({
  userID: String, 
  type: String,
  tokenHash: String,
  expiresAt: Date,
});

const Token = mongoose.model('Token', tokenSchema);

export default Token;
