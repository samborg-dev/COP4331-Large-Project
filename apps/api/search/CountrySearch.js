import mongoose from 'mongoose';
import countries from './countriesModel.js';

const ATLAS_URI = "FakeURI";

function escapeRegex(string) {
    return string.replace(/[/\-\\^$*+?.()|[\]{}]/g, '\\$&');
}



export async function CountrySearch(countryName) {
  try {
    
    await mongoose.connect(ATLAS_URI);
    console.log("Connected to MongoDB Atlas!");
   const input = escapeRegex(countryName);
    const pipeline = [
  {
    $search: {
      index: "name",
      autocomplete: {
        query: input,
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
