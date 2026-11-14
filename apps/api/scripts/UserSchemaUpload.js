import mongoose from 'mongoose';
import User from './usersModel.js';

const ATLAS_URI = "mongodb+srv://Large_Project_User:Cop4331C@cluster0.jlixyxr.mongodb.net/Large_Project_DB?retryWrites=true&w=majority";

export async function userUpload(userEmail,user,userPasswordHash,emailVerification,total,played,won,date) {
  try {
    
    await mongoose.connect(ATLAS_URI);
    console.log("Connected to MongoDB Atlas!");

    
    const newUser = new User({
    email: userEmail,
    firstName: first ,
    lastName: last ,
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


