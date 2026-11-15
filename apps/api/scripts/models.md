Country Model (This will likely be heavily edited):

const mongoose = require('mongoose');


const countriesSchema = new mongoose.Schema({
  type: {
    type: String,
    required: true
  },
  features: [{
    type: {
      type: String,
      required: true
    },
    geometry: {
      type: {
        type: String,
        required: true
      },
      coordinates: {
        type: [Number],
        required: true
      }
    },
    properties: {
      AFF_ISO: { type: String, required: true },
      COUNTRY: { type: String, required: true },
      COUNTRYAFF: { type: String, required: true },
      ISO: { type: String, required: true }
    }
  }]
});




const Country = mongoose.model('Country', countriesSchema);


module.exports = Country;



User Model:

import mongoose from 'mongoose';

const userSchema = new mongoose.Schema({
  email: String,
  firstName: String,
  lastName: String,
  passwordHash: String,
  emailVerified: String,
  totalPoints: Number,
  gamesPlayed: Number,
  gamesWon: Number,
  createdAt: Date 
});



const User = mongoose.model('User', userSchema);
export default User;


Token Model:

import mongoose from 'mongoose';

const tokenSchema = new mongoose.Schema({
  userID: Number, 
  type: String,
  tokenHash: String,
  expiresAt: Date,
});

const Token = mongoose.model('Token', tokenSchema);

export default Token;









Game Model:

import mongoose from 'mongoose';

const tokenSchema = new mongoose.Schema({
  userID: Number, 
  type: String,
  tokenHash: String,
  expiresAt: Date,
});

const Token = mongoose.model('Token', tokenSchema);

export default Token;
