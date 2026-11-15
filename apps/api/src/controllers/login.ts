import { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { loginSchema } from '@cop4331/shared';
import { getDb } from '../db.js';

export async function loginController(req: Request, res: Response): Promise<void> {
  const parsed = loginSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Invalid email or password' });
    return;
  }

  try {
    const db = getDb();
    const email = parsed.data.email.toLowerCase();
    const user = await db.collection('users').findOne({ email });

    if (!user) {
      res.status(401).json({ error: 'Invalid email or password' });
      return;
    }

    const passwordMatches = await bcrypt.compare(parsed.data.password, user.passwordHash as string);
    if (!passwordMatches) {
      res.status(401).json({ error: 'Invalid email or password' });
      return;
    }

    if (!user.emailVerified) {
      res.status(403).json({ error: 'Account email is not verified' });
      return;
    }

    const secret = process.env.ACCESS_TOKEN_SECRET || '';
    const accessToken = jwt.sign({ userId: user._id.toString() }, secret, { expiresIn: '24h' });

    res.status(200).json({
      accessToken,
      user: {
        id: user._id.toString(),
        firstName: user.firstName as string,
        lastName: user.lastName as string,
        email: user.email as string,
        totalPoints: (user.totalPoints as number) ?? 0,
      },
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Internal server error';
    res.status(500).json({ error: message });
  }
}