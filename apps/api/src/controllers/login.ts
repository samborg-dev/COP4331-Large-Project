import { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { loginSchema } from '@repo/shared';
import { getDb } from './db';

export async function loginController(req: Request, res: Response): Promise<any> {
  const parsed = loginSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: 'Invalid email or password' });
  }

  try {
    const db = getDb();
    const email = parsed.data.email.toLowerCase();
    const user = await db.collection('users').findOne({ email });

    if (!user) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    const passwordMatches = await bcrypt.compare(parsed.data.password, user.passwordHash);
    if (!passwordMatches) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    if (!user.emailVerified) {
      return res.status(403).json({ error: 'Account email is not verified' });
    }

    const secret = process.env.ACCESS_TOKEN_SECRET!;
    const accessToken = jwt.sign({ userId: user._id.toString() }, secret, { expiresIn: '24h' });

    return res.status(200).json({
      accessToken,
      user: {
        id: user._id.toString(),
        firstName: user.firstName,
        lastName: user.lastName,
        email: user.email,
        totalPoints: user.totalPoints,
      },
    });
  } catch (err: any) {
    return res.status(500).json({ error: err.message || 'Internal server error' });
  }
}
