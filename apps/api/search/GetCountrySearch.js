import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import express from 'express';
import cors from 'cors';
import mongoose from 'mongoose';
import countries from './countriesModel.js';

// Resolve .env relative to this specific file
dotenv.config({ path: '../../../.env' });

const ATLAS_URI = process.env.MONGO_URI;
const app = express();
const port = 80;

//app.use(cors()); // Allows browser requests from other ports

app.get('/countries', async (req, res) => {
  const countryName = req.query.name;

  if (!countryName) {
    return res.status(400).json({ error: 'Please provide a country name query parameter (?name=...)' });
  }

  try {
    const pipeline = [
      {
        $search: {
          index: 'name',
          autocomplete: {
            query: countryName,
            path: 'COUNTRY',
          },
        },
      },
      { $limit: 10 },
    ];

    const results = await countries.aggregate(pipeline);
    return res.status(200).json(results);
  } catch (error) {
    console.error('Search error:', error);
    return res.status(500).json({ error: error.message });
  }
});

// Only start listening once MongoDB is connected
if (!ATLAS_URI) {
  console.error('FATAL: MONGO_URI is undefined. Check your .env path.');
  process.exit(1);
}

mongoose.connect(ATLAS_URI)
  .then(() => {
    console.log('Connected to MongoDB');
    app.listen(port, () => {
      console.log(`Server running on port ${port}`);
    });
  })
  .catch((err) => console.error('MongoDB connection error:', err));
