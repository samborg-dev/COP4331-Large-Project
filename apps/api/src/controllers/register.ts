import { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import { registerSchema } from '@repo/shared';
import { getDb } from './db';
import { createRawToken, hashToken } from './tokens';
import { sendVerificationEmail } from './mail';

const WEB_URL = process.env.WEB_URL || 'http://localhost:5173';

export async function registerController(req: Request, res: Response): Promise<any> {
  const parsed = registerSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: 'Invalid registration input' });
  }

  try {
    const db = getDb();
    const email = parsed.data.email.toLowerCase();

    const existing = await db.collection('users').findOne({ email });
    if (existing) {
      return res.status(409).json({ error: 'Email already registered' });
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

    return res.status(201).json({ message: 'Account created. Check your email to verify.' });
  } catch (err: any) {
    return res.status(500).json({ error: err.message || 'Internal server error' });
  }
}
