import mongoose from 'mongoose';
import Token from './tokensModel.js';

const ATLAS_URI = "FakeURI";

export async function TokenUpload(ID,TokenType,Hash,expiration) {
  try {
    
    await mongoose.connect(ATLAS_URI);
    console.log("Connected to MongoDB Atlas!");

    
    const newToken = new Token({
    userID: ID, 
    type: TokenType,
    tokenHash: Hash,
    expiresAt: expiration,
    });

    await newToken.save(); 
    console.log("Document uploaded successfully!");
  } catch (error) {
    console.error("Error:", error);
  } finally {
    mongoose.disconnect();
  }
}


