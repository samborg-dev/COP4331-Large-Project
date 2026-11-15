
import mongoose from 'mongoose';
import countries from '/root/apps/api/search/countriesModel.js';
import csv from 'csv-parser';
import fs from 'node:fs';
import { MongoClient } from 'mongodb';



async function CountryImport(URI,filePath) {
  try {

    await mongoose.connect(URI);
    const newCountry = new countries

    const operations = [];
    const batchSize = 1000;
    let totalProcessed = 0;

    const stream = fs.createReadStream(filePath).pipe(csv());

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

