import mongoose from 'mongoose';

const countriesSchema = new mongoose.Schema({
  longitude: Number,
  latitude: Number,
  COUNTRY: String,
  ISO: String,
  COUNTRYAFF: String,
  AFF_ISO: String
});


const countries = mongoose.model('countries', countriesSchema);

export default countries;


