import { ObjectId } from 'mongodb';

export interface CountryFeature {
  type: string;
  geometry: {
    type: string;
    coordinates: [number, number]; // [lng, lat]
  };
  properties: {
    AFF_ISO: string;
    COUNTRY: string;
    COUNTRYAFF: string;
    ISO: string;
  };
}

export interface CountryDoc {
  _id?: ObjectId;
  type?: string;
  features?: CountryFeature[];
  // Supports flat country documents if imported via idempotentImport.js
  name?: string;
  iso?: string;
  lat?: number;
  lng?: number;
}