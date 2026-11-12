

import mongoose from 'mongoose';
import countries from '/root/apps/api/search/countriesModel.js';
import csv from 'csv-parser';
import fs from 'node:fs';
import { MongoClient } from 'mongodb';

const ATLAS_URI = "mongodb+srv://Large_Project_User:Cop4331C@cluster0.jlixyxr.mongodb.net/Large_Project_DB?retryWrit>

async function CountryImport() {
  try {

    await mongoose.connect(ATLAS_URI);
    const newCountry = new countries

    const operations = [];
    const batchSize = 1000;
    let totalProcessed = 0;

    const stream = fs.createReadStream('./Large_Project_DB_Countries.csv').pipe(csv());

    for await (const row of stream) {

    const uniqueFilter = { COUNTRY: row.COUNTRY };

    operations.push({
      updateOne: {
        filter: uniqueFilter,
        update: { $set: row },
        upsert: true,
      },
    });


    if (operations.length >= batchSize) {
      await xountries.bulkWrite(operations);
      totalProcessed += operations.length;
      operations.length = 0;
    }
  }


  if (operations.length > 0) {
    await countries.bulkWrite(operations);
    totalProcessed += operations.length;
  }

  } catch (error) {
    console.error("Error:", error);
  } finally {
    mongoose.disconnect();
  }
}

CountryImport();
