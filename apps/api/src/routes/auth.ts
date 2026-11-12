import { Router } from 'express';
import { registerController } from '../controllers/register';
import { loginController } from '../controllers/login';
import { getDb } from '../db';
import { hashToken, createRawToken } from '../tokens';
import { sendVerificationEmail, sendPasswordResetEmail } from '../mail';
import { authRateLimiter } from '../middleware/rateLimit';
import bcrypt from 'bcryptjs';

const router = Router();

router.post('/register', registerController);
router.post('/login', loginController);

// GET /api/auth/verify-email?token=...
router.get('/verify-email', async (req, res) => {
  try {
    const { token } = req.query;
    if (!token || typeof token !== 'string') {
      return res.status(400).json({ error: 'Verification token is required' });
    }

    const hashedToken = hashToken(token);
    const db = await getDb();
    
    const user = await db.collection('users').findOne({
      verificationToken: hashedToken,
      verificationTokenExpiresAt: { $gt: new Date() }
    });

    if (!user) {
      return res.status(400).json({ error: 'Invalid or expired verification token' });
    }

    await db.collection('users').updateOne(
      { _id: user._id },
      { 
        $set: { isVerified: true },
        $unset: { verificationToken: '', verificationTokenExpiresAt: '' }
      }
    );

    return res.json({ message: 'Email verified successfully' });
  } catch (error) {
    console.error('Verify email error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/auth/resend-verification
router.post('/resend-verification', async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) {
      return res.status(400).json({ error: 'Email is required' });
    }

    const db = await getDb();
    const user = await db.collection('users').findOne({ email });

    if (!user || user.isVerified) {
      return res.json({ message: 'If the email exists and is unverified, a verification link has been sent.' });
    }

    const verificationToken = createRawToken();
    const hashedToken = hashToken(verificationToken);
    const verificationTokenExpiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);

    await db.collection('users').updateOne(
      { _id: user._id },
      { $set: { verificationToken: hashedToken, verificationTokenExpiresAt } }
    );

    await sendVerificationEmail(user.email, verificationToken);

    return res.json({ message: 'Verification email resent successfully' });
  } catch (error) {
    console.error('Resend verification error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// P2: POST /api/auth/forgot-password (always returns 200)
router.post('/forgot-password', async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) {
      return res.status(400).json({ error: 'Email is required' });
    }

    const db = await getDb();
    const user = await db.collection('users').findOne({ email });

    if (user) {
      const resetToken = createRawToken();
      const hashedToken = hashToken(resetToken);
      const resetTokenExpiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1-hour expiry

      await db.collection('users').updateOne(
        { _id: user._id },
        { $set: { resetToken: hashedToken, resetTokenExpiresAt } }
      );

      await sendPasswordResetEmail(user.email, resetToken);
    }

    return res.json({ message: 'If that email address is in our database, we have sent a password reset link.' });
  } catch (error) {
    console.error('Forgot password error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// P2: POST /api/auth/reset-password
router.post('/reset-password', async (req, res) => {
  try {
    const { token, newPassword } = req.body;
    if (!token || !newPassword) {
      return res.status(400).json({ error: 'Token and new password are required' });
    }

    const hashedToken = hashToken(token);
    const db = await getDb();

    const user = await db.collection('users').findOne({
      resetToken: hashedToken,
      resetTokenExpiresAt: { $gt: new Date() }
    });

    if (!user) {
      return res.status(400).json({ error: 'Invalid or expired password reset token' });
    }

    const hashedPassword = await bcrypt.hash(newPassword, 10);

    await db.collection('users').updateOne(
      { _id: user._id },
      { 
        $set: { password: hashedPassword },
        $unset: { resetToken: '', resetTokenExpiresAt: '' }
      }
    );

    return res.json({ message: 'Password reset successfully' });
  } catch (error) {
    console.error('Reset password error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

//P3: // Apply rate limiter to all auth endpoints
router.use(authRateLimiter);

router.post('/register', registerController);
router.post('/login', loginController);

export default router;