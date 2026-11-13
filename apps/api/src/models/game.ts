import { ObjectId } from 'mongodb';

export interface GuessEntry {
  countryId?: string;
  guessName: string;
  lat: number;
  lng: number;
  distance: number;
  range?: string;
  createdAt: Date;
}

export interface GameDoc {
  _id?: ObjectId;
  userId: ObjectId | null;
  targetCountry: string;
  targetIso?: string;
  targetLat: number;
  targetLng: number;
  guesses: GuessEntry[];
  status: 'IN_PROGRESS' | 'WON' | 'LOST';
  pointsEarned?: number;
  createdAt: Date;
}