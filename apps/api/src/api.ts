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
import { db } from './db.js';
import { createToken, isExpired, refresh } from './createJWT.js';

const INVALID_JWT = 'The JWT is no longer valid';
const BAD_REQUEST = 'Invalid request body';

const escapeRegex = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

export function setApp(app: Express): void {
  app.post('/api/login', async (req, res) => {
    // incoming: login, password
    // outgoing: accessToken | error
    const parsed = loginRequestSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(200).json({ error: BAD_REQUEST } satisfies LoginResponse);
      return;
    }
    const { login, password } = parsed.data;

    try {
      // NOTE: starter only -- passwords are stored/compared in plaintext as in the course demo.
      // Replace with bcrypt-hashed passwords when real registration is added.
      const user = await db().collection('Users').findOne({ Login: login, Password: password });

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
    // incoming: userId, card, jwtToken
    // outgoing: error, jwtToken
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
      await db().collection('Cards').insertOne({ Card: card, UserId: userId });
    } catch (e) {
      error = (e as Error).message;
    }

    res.status(200).json({ error, jwtToken: refresh(jwtToken) } satisfies AddCardResponse);
  });

  app.post('/api/searchcards', async (req, res) => {
    // incoming: userId, search, jwtToken
    // outgoing: results[], error, jwtToken
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
      // partial, case-insensitive match; user input is escaped so it can't inject a regex
      const docs = await db()
        .collection('Cards')
        .find({ Card: { $regex: escapeRegex(search.trim()), $options: 'i' } })
        .toArray();
      results = docs.map((d) => d.Card as string);
    } catch (e) {
      error = (e as Error).message;
    }

    res
      .status(200)
      .json({ results, error, jwtToken: refresh(jwtToken) } satisfies SearchCardsResponse);
  });
}
