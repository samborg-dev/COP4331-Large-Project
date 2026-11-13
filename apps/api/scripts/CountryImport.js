import express from 'express';
import mongoose from 'mongoose';
import csv from 'csv-parser';
import fs from 'node:fs';
import countries from '/root/apps/api/search/countriesModel.js';

const app = express();
app.use(express.json());

app.post('/api/countries/import', async (req, res) => {
  const {uri}  = req.body;
  const filePath = './Large_Project_DB_Countries.csv';
  // 1. Validate inputs
  if (!uri) {
    return res.status(400).json({ error: 'MongoDB URI is required in the request body.' });
  }

  if (!fs.existsSync(filePath)) {
    return res.status(404).json({ error: `CSV file not found at path: ${filePath}` });
  }

  let connection;

  try {
    // 2. Use createConnection() instead of mongoose.connect() so it doesn't 
    // hijack or disconnect your main app's default database connection.
    connection = await mongoose.createConnection(uri).asPromise();
    const CountryModel = connection.model('countries', countries.schema);

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
        await CountryModel.bulkWrite(operations);
        totalProcessed += operations.length;
        operations.length = 0;
      }
    }

    // Flush any remaining records
    if (operations.length > 0) {
      await CountryModel.bulkWrite(operations);
      totalProcessed += operations.length;
    }

    return res.status(200).json({
      message: 'Countries imported successfully.',
      totalProcessed,
    });

  } catch (error) {
    console.error('Import Error:', error);
    return res.status(500).json({
      error: 'Failed to import countries.',
      details: error.message,
    });

  } finally {
    // 3. Safely close only this specific dynamic connection
    if (connection) {
      await connection.close();
    }
  }
});

const PORT = 80;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
