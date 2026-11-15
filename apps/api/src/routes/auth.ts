import { Router } from 'express';
import { registerController } from '../controllers/register.js';
import { loginController } from '../controllers/login.js';
import { getDb } from '../db.js';
import { hashToken, createRawToken } from '../tokens.js';
import { sendVerificationEmail, sendPasswordResetEmail } from '../mail.js';
import { authRateLimiter } from '../middleware/rateLimit.js';
import bcrypt from 'bcryptjs';

const router = Router();

// Apply rate limiter to all auth endpoints
router.use(authRateLimiter);

router.post('/register', registerController);
router.post('/login', loginController);

// POST /api/auth/verify-email
router.post('/verify-email', async (req, res) => {
  try {
    const token = req.body?.token ?? req.query?.token;
    if (!token || typeof token !== 'string') {
      return res.status(400).json({ error: 'Verification token is required' });
    }

    const db = getDb();
    const tokenDoc = await db.collection('tokens').findOne({
      type: 'verify',
      tokenHash: hashToken(token),
      expiresAt: { $gt: new Date() },
    });

    if (!tokenDoc) {
      return res.status(400).json({ error: 'Invalid or expired verification token' });
    }

    await db.collection('users').updateOne(
      { _id: tokenDoc.userId },
      { $set: { emailVerified: true } }
    );

    await db.collection('tokens').deleteMany({
      userId: tokenDoc.userId,
      type: 'verify',
    });

    return res.status(200).json({ message: 'Email verified successfully' });
  } catch (error) {
    console.error('Verify email error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/auth/resend-verification (always returns 200)
router.post('/resend-verification', async (req, res) => {
  try {
    const rawEmail = req.body?.email;
    if (!rawEmail || typeof rawEmail !== 'string') {
      return res.status(400).json({ error: 'Email is required' });
    }

    const email = rawEmail.toLowerCase();
    const db = getDb();
    const user = await db.collection('users').findOne({ email });

    if (user && !user.emailVerified) {
      await db.collection('tokens').deleteMany({ userId: user._id, type: 'verify' });

      const rawToken = createRawToken();
      await db.collection('tokens').insertOne({
        userId: user._id,
        type: 'verify',
        tokenHash: hashToken(rawToken),
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
      });

      await sendVerificationEmail(user.email, rawToken);
    }

    return res.status(200).json({
      message: 'If the email exists and is unverified, a verification link has been sent.',
    });
  } catch (error) {
    console.error('Resend verification error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/auth/forgot-password (always returns 200)
router.post('/forgot-password', async (req, res) => {
  try {
    const rawEmail = req.body?.email;
    if (!rawEmail || typeof rawEmail !== 'string') {
      return res.status(400).json({ error: 'Email is required' });
    }

    const email = rawEmail.toLowerCase();
    const db = getDb();
    const user = await db.collection('users').findOne({ email });

    if (user) {
      await db.collection('tokens').deleteMany({ userId: user._id, type: 'reset' });

      const rawToken = createRawToken();
      await db.collection('tokens').insertOne({
        userId: user._id,
        type: 'reset',
        tokenHash: hashToken(rawToken),
        expiresAt: new Date(Date.now() + 60 * 60 * 1000), // 1-hour expiry
      });

      await sendPasswordResetEmail(user.email, rawToken);
    }

    return res.status(200).json({
      message: 'If that email address is in our database, we have sent a password reset link.',
    });
  } catch (error) {
    console.error('Forgot password error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/auth/reset-password
router.post('/reset-password', async (req, res) => {
  try {
    const token = req.body?.token;
    const password = req.body?.password ?? req.body?.newPassword;
    if (!token || !password || typeof token !== 'string' || typeof password !== 'string') {
      return res.status(400).json({ error: 'Token and password are required' });
    }
    if (password.length < 8) {
      return res.status(400).json({ error: 'Password must be at least 8 characters' });
    }

    const db = getDb();
    const tokenDoc = await db.collection('tokens').findOne({
      type: 'reset',
      tokenHash: hashToken(token),
      expiresAt: { $gt: new Date() },
    });

    if (!tokenDoc) {
      return res.status(400).json({ error: 'Invalid or expired password reset token' });
    }

    const passwordHash = await bcrypt.hash(password, 10);

    await db.collection('users').updateOne(
      { _id: tokenDoc.userId },
      { $set: { passwordHash } }
    );

    await db.collection('tokens').deleteMany({
      userId: tokenDoc.userId,
      type: 'reset',
    });

    return res.status(200).json({ message: 'Password reset successfully' });
  } catch (error) {
    console.error('Reset password error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;