import mongoose from 'mongoose';
import User from './usersModel.js';

const ATLAS_URI = "mongodb+srv://FakeDB:FakePw@cluster0.jlixyxr.mongodb.net/Large_Project_DB?retryWrites=true&w=majority";

async function run() {
  try {
    
    await mongoose.connect(ATLAS_URI);
    console.log("Connected to MongoDB Atlas!");

    
    const newUser = new User({
    email: "Jam@example.com",
    firstName: "Jam",
    lastName: "mar",
    passwordHash: "$2a$10$Tk/3KIYESE8glgQCGug1BuJhAdZvVOmzEPAEQUbUMQtfHDuBM77P2",
    emailVerified: "true",
    totalPoints: 400,
    gamesPlayed: 11,
    gamesWon: 8,
    createdAt: new Date("2026-04-10"),
    });

    await newUser.save(); 
    console.log("Document uploaded successfully!");
  } catch (error) {
    console.error("Error:", error);
  } finally {
    mongoose.disconnect();
  }
}

run();
