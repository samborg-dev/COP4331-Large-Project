import { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import { registerSchema } from '@cop4331/shared';
import { getDb } from '../db.js';
import { createRawToken, hashToken } from '../tokens.js';
import { sendVerificationEmail } from '../mail.js';

export async function registerController(req: Request, res: Response): Promise<void> {
  const parsed = registerSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues[0]?.message || 'Invalid registration input' });
    return;
  }

  try {
    const db = getDb();
    const email = parsed.data.email.toLowerCase();

    const existing = await db.collection('users').findOne({ email });
    if (existing) {
      res.status(409).json({ error: 'Email already registered' });
      return;
    }

    const passwordHash = await bcrypt.hash(parsed.data.password, 10);
    const result = await db.collection('users').insertOne({
      firstName: parsed.data.firstName,
      lastName: parsed.data.lastName,
      email,
      passwordHash,
      emailVerified: false,
      totalPoints: 0,
      gamesPlayed: 0,
      gamesWon: 0,
      createdAt: new Date(),
    });

    const rawToken = createRawToken();
    await db.collection('tokens').insertOne({
      userId: result.insertedId,
      type: 'verify',
      tokenHash: hashToken(rawToken),
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
    });

    await sendVerificationEmail(email, rawToken);

    res.status(201).json({ message: 'Account created. Check your email to verify.' });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Internal server error';
    res.status(500).json({ error: message });
  }
}