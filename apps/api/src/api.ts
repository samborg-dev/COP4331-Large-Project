import type { Express } from 'express';
import type {
  AddCardResponse,
  LoginResponse,
  SearchCardsResponse,
} from '@cop4331/shared';
import {
  addCardRequestSchema,
  loginRequestSchema,
  searchCardsRequestSchema,
} from '@cop4331/shared';
import { createToken, isExpired, refresh } from './createJWT.js';
import { getDb } from './db.js';
import gamesRouter from './routes/games';


const INVALID_JWT = 'The JWT is no longer valid';
const BAD_REQUEST = 'Invalid request body';

const escapeRegex = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

export function setApp(app: Express): void {
  app.use('/api/games', gamesRouter);
  app.post('/api/login', async (req, res) => {
    const parsed = loginRequestSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(200).json({ error: BAD_REQUEST } satisfies LoginResponse);
      return;
    }
    const { login, password } = parsed.data;

    try {
      const db = getDb();
      const user = await db.collection('Users').findOne({ Login: login, Password: password });

      if (!user) {
        res.status(200).json({ error: 'Login/Password incorrect' } satisfies LoginResponse);
        return;
      }

      const ret = createToken({
        userId: user.UserId,
        firstName: user.FirstName,
        lastName: user.LastName,
      });
      res.status(200).json(ret satisfies LoginResponse);
    } catch (e) {
      res.status(200).json({ error: (e as Error).message } satisfies LoginResponse);
    }
  });

  app.post('/api/addcard', async (req, res) => {
    const parsed = addCardRequestSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(200).json({ error: BAD_REQUEST, jwtToken: null } satisfies AddCardResponse);
      return;
    }
    const { userId, card, jwtToken } = parsed.data;

    if (isExpired(jwtToken)) {
      res.status(200).json({ error: INVALID_JWT, jwtToken: null } satisfies AddCardResponse);
      return;
    }

    let error = '';
    try {
      const db = getDb();
      await db.collection('Cards').insertOne({ Card: card, UserId: userId });
    } catch (e) {
      error = (e as Error).message;
    }

    res.status(200).json({ error, jwtToken: refresh(jwtToken) } satisfies AddCardResponse);
  });

  app.post('/api/searchcards', async (req, res) => {
    const parsed = searchCardsRequestSchema.safeParse(req.body);
    if (!parsed.success) {
      res
        .status(200)
        .json({ results: [], error: BAD_REQUEST, jwtToken: null } satisfies SearchCardsResponse);
      return;
    }
    const { search, jwtToken } = parsed.data;

    if (isExpired(jwtToken)) {
      res
        .status(200)
        .json({ results: [], error: INVALID_JWT, jwtToken: null } satisfies SearchCardsResponse);
      return;
    }

    let error = '';
    let results: string[] = [];
    try {
      const db = getDb();
      const docs = await db
        .collection('Cards')
        .find({ Card: { $regex: escapeRegex(search.trim()), $options: 'i' } })
        .toArray();
      results = docs.map((d: Record<string, unknown>) => d.Card as string);
    } catch (e) {
      error = (e as Error).message;
    }

    res
      .status(200)
      .json({ results, error, jwtToken: refresh(jwtToken) } satisfies SearchCardsResponse);
  });
}