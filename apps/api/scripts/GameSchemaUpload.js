import dotenv from 'dotenv';
import express from 'express';
import mongoose from 'mongoose';
import Game from './gameModel.js';

dotenv.config({path:'../../../.env'});
const ATLAS_URI = process.env.MONGO_URI;

export async function GameUpload(ID,status,guesses,maxGuesses,start,end) {
  try {

    await mongoose.connect(ATLAS_URI);
    console.log("Connected to MongoDB Atlas!");

    const newGame = new Game({
    userID: ID,
    status: status,
    guesses: guesses,
    maxGuesses: maxGuesses,
    startedAt: start,
    endedAt: end,
    });

    await newGame.save(); 
    console.log("Document uploaded successfully!");
  } catch (error) {
    console.error("Error:", error);
  } finally {
    mongoose.disconnect();
  }
}

