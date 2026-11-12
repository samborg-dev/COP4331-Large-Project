export {};
import mongoose from 'mongoose';

const countriesSchema = new mongoose.Schema({
  type: { type: String, required: true },
  features: [{
    type: { type: String, required: true },
    geometry: {
      type: { type: String, required: true },
      coordinates: { type: [Number], required: true }
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
export default Country;