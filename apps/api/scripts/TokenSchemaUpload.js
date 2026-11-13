import dotenv from 'dotenv';
import express from 'express';
import mongoose from 'mongoose';
import Token from './tokensModel.js';
dotenv.config({path:'../../../.env'});
const ATLAS_URI = process.env.MONGO_URI;


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


