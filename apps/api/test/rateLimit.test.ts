// Uses the real limiter (the other test files replace it with a no-op).
import { describe, expect, it } from 'vitest';
import express from 'express';
import request from 'supertest';
import { authRateLimiter } from '../src/middleware/rateLimit.js';

describe('authRateLimiter', () => {
  it('answers 429 with the standard error shape after 25 requests', async () => {
    const app = express();
    app.use(authRateLimiter);
    app.post('/login', (_req, res) => {
      res.status(200).json({ ok: true });
    });

    for (let i = 0; i < 25; i++) await request(app).post('/login').expect(200);
    const blocked = await request(app).post('/login');
    expect(blocked.status).toBe(429);
    expect(blocked.body).toEqual({ error: 'Too many requests, please try again later' });
  });
});
