import dotenv from 'dotenv';
import express from 'express';
import mongoose from 'mongoose';
import User from './usersModel.js';
dotenv.config({path:'../../../.env'});
const ATLAS_URI = process.env.MONGO_URI;

export async function userUpload(userEmail,user,userPasswordHash,emailVerification,total,played,won,date) {
  try {
    
    await mongoose.connect(ATLAS_URI);
    console.log("Connected to MongoDB Atlas!");

    
    const newUser = new User({
    email: userEmail,
    username: user,
    passwordHash: userPasswordHash,
    emailVerified: emailVerification,
    totalPoints: total,
    gamesPlayed: played,
    gamesWon: won,
    createdAt: date,
    });

    await newUser.save(); 
    console.log("Document uploaded successfully!");
  } catch (error) {
    console.error("Error:", error);
  } finally {
    mongoose.disconnect();
  }
}


