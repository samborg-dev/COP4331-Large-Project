import dotenv from 'dotenv';
import express from 'express';
import mongoose from 'mongoose';
import countries from './countriesModel.js';
dotenv.config({path:'../../../.env'});
const ATLAS_URI = process.env.MONGO_URI;

export async function CountrySearch(countryName) {
  try {
   console.log(ATLAS_URI);

    await mongoose.connect(ATLAS_URI);
   
    const pipeline = [
  {
    $search: {
      index: "name",
      autocomplete: {
        query: countryName,
        path: "COUNTRY",
      },
    },
  },
]

  const fullResults = await countries.aggregate(pipeline);
  const results = fullResults.slice(0,10);
  return results;




   
  } catch (error) {
    console.error("Error:", error);
  } finally {
    mongoose.disconnect();
  }
}

