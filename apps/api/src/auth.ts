import { createHash, randomBytes } from 'node:crypto';
import bcrypt from 'bcryptjs';
import type { Express, Request, Response } from 'express';
import { MongoServerError, type ObjectId } from 'mongodb';
import type { ZodError } from 'zod';
import type { AuthLoginResponse, ErrorResponse, MessageResponse } from '@cop4331/shared';
import {
  authLoginRequestSchema,
  emailRequestSchema,
  registerRequestSchema,
  resetPasswordRequestSchema,
  verifyEmailRequestSchema,
} from '@cop4331/shared';
import { createToken } from './createJWT.js';
import { db } from './db.js';
import { sendPasswordResetEmail, sendVerificationEmail } from './mail.js';

// Collections follow the data model in TASKS.md section 3
interface UserDoc {
  firstName: string;
  lastName: string;
  email: string;
  passwordHash: string;
  emailVerified: boolean;
  totalPoints: number;
  gamesPlayed: number;
  gamesWon: number;
  createdAt: Date;
}

type TokenType = 'verify' | 'reset';

interface TokenDoc {
  userId: ObjectId;
  type: TokenType;
  tokenHash: string;
  expiresAt: Date;
}

const HOUR_MS = 60 * 60 * 1000;
const TOKEN_TTL_MS: Record<TokenType, number> = { verify: 24 * HOUR_MS, reset: HOUR_MS };
const BCRYPT_ROUNDS = 10;
const INVALID_LOGIN = 'Invalid email or password';
const INVALID_LINK = 'This link is invalid or has expired';

const users = () => db().collection<UserDoc>('users');
const tokens = () => db().collection<TokenDoc>('tokens');

const sha256 = (s: string) => createHash('sha256').update(s).digest('hex');

// Idempotent; safe to run on every startup
export async function ensureAuthIndexes(): Promise<void> {
  await users().createIndex({ email: 1 }, { unique: true });
  await tokens().createIndex({ tokenHash: 1 });
  await tokens().createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 });
}

// Only the hash is stored; the raw token exists only in the email.
// Issuing a new token invalidates the user's older ones of the same type.
async function issueToken(userId: ObjectId, type: TokenType): Promise<string> {
  const raw = randomBytes(32).toString('hex');
  await tokens().deleteMany({ userId, type });
  await tokens().insertOne({
    userId,
    type,
    tokenHash: sha256(raw),
    expiresAt: new Date(Date.now() + TOKEN_TTL_MS[type]),
  });
  return raw;
}

// Single use: deletes the token and returns its user, or null if invalid/expired
async function consumeToken(raw: string, type: TokenType): Promise<ObjectId | null> {
  const doc = await tokens().findOneAndDelete({
    tokenHash: sha256(raw),
    type,
    expiresAt: { $gt: new Date() },
  });
  return doc?.userId ?? null;
}

function sendError(res: Response, status: number, error: string): void {
  res.status(status).json({ error } satisfies ErrorResponse);
}

const firstIssue = (err: ZodError) => err.issues[0]?.message ?? 'Invalid request body';

// Express 4 doesn't catch rejected promises; turn them into a 500
const handle =
  (fn: (req: Request, res: Response) => Promise<void>) => (req: Request, res: Response) => {
    fn(req, res).catch((e: unknown) => {
      console.error(`${req.method} ${req.path} failed:`, e);
      if (!res.headersSent) sendError(res, 500, 'Something went wrong. Please try again.');
    });
  };

// Email failures shouldn't fail the request; the user can ask for a resend
async function trySend(send: () => Promise<void>): Promise<void> {
  try {
    await send();
  } catch (e) {
    console.error('[mail]', (e as Error).message);
  }
}

export function setAuthRoutes(app: Express): void {
  app.post(
    '/api/auth/register',
    handle(async (req, res) => {
      const parsed = registerRequestSchema.safeParse(req.body);
      if (!parsed.success) return sendError(res, 400, firstIssue(parsed.error));
      const { firstName, lastName, email, password } = parsed.data;

      if (await users().findOne({ email })) {
        return sendError(res, 409, 'An account with that email already exists');
      }

      let userId: ObjectId;
      try {
        const result = await users().insertOne({
          firstName,
          lastName,
          email,
          passwordHash: await bcrypt.hash(password, BCRYPT_ROUNDS),
          emailVerified: false,
          totalPoints: 0,
          gamesPlayed: 0,
          gamesWon: 0,
          createdAt: new Date(),
        });
        userId = result.insertedId;
      } catch (e) {
        // lost a race with another signup for the same email
        if (e instanceof MongoServerError && e.code === 11000) {
          return sendError(res, 409, 'An account with that email already exists');
        }
        throw e;
      }

      const raw = await issueToken(userId, 'verify');
      await trySend(() => sendVerificationEmail(email, raw));
      res
        .status(201)
        .json({ message: 'Account created. Check your email to verify it.' } satisfies MessageResponse);
    }),
  );

  app.post(
    '/api/auth/verify-email',
    handle(async (req, res) => {
      const parsed = verifyEmailRequestSchema.safeParse(req.body);
      if (!parsed.success) return sendError(res, 400, INVALID_LINK);

      const userId = await consumeToken(parsed.data.token, 'verify');
      if (!userId) return sendError(res, 400, INVALID_LINK);

      await users().updateOne({ _id: userId }, { $set: { emailVerified: true } });
      res.json({ message: 'Email verified. You can log in now.' } satisfies MessageResponse);
    }),
  );

  app.post(
    '/api/auth/resend-verification',
    handle(async (req, res) => {
      const parsed = emailRequestSchema.safeParse(req.body);
      if (!parsed.success) return sendError(res, 400, firstIssue(parsed.error));
      const { email } = parsed.data;

      // Same response whether or not the account exists (no account enumeration)
      const user = await users().findOne({ email });
      if (user && !user.emailVerified) {
        const raw = await issueToken(user._id, 'verify');
        await trySend(() => sendVerificationEmail(email, raw));
      }
      res.json({
        message: 'If that account needs verifying, we sent a new link.',
      } satisfies MessageResponse);
    }),
  );

  app.post(
    '/api/auth/login',
    handle(async (req, res) => {
      const parsed = authLoginRequestSchema.safeParse(req.body);
      if (!parsed.success) return sendError(res, 400, firstIssue(parsed.error));
      const { email, password } = parsed.data;

      // One generic message for an unknown email and a wrong password
      const user = await users().findOne({ email });
      if (!user || !(await bcrypt.compare(password, user.passwordHash))) {
        return sendError(res, 401, INVALID_LOGIN);
      }
      if (!user.emailVerified) {
        return sendError(res, 403, 'Please verify your email before logging in');
      }

      const id = user._id.toHexString();
      const { accessToken } = createToken({
        userId: id,
        firstName: user.firstName,
        lastName: user.lastName,
      });
      res.json({
        accessToken,
        user: {
          id,
          firstName: user.firstName,
          lastName: user.lastName,
          email: user.email,
          totalPoints: user.totalPoints,
        },
      } satisfies AuthLoginResponse);
    }),
  );

  app.post(
    '/api/auth/forgot-password',
    handle(async (req, res) => {
      const parsed = emailRequestSchema.safeParse(req.body);
      if (!parsed.success) return sendError(res, 400, firstIssue(parsed.error));
      const { email } = parsed.data;

      // Same response whether or not the account exists (no account enumeration)
      const user = await users().findOne({ email });
      if (user) {
        const raw = await issueToken(user._id, 'reset');
        await trySend(() => sendPasswordResetEmail(email, raw));
      }
      res.json({
        message: 'If an account exists for that email, we sent a reset link.',
      } satisfies MessageResponse);
    }),
  );

  app.post(
    '/api/auth/reset-password',
    handle(async (req, res) => {
      const parsed = resetPasswordRequestSchema.safeParse(req.body);
      if (!parsed.success) return sendError(res, 400, firstIssue(parsed.error));
      const { token, password } = parsed.data;

      const userId = await consumeToken(token, 'reset');
      if (!userId) return sendError(res, 400, INVALID_LINK);

      // Following the emailed link also proves they own the address
      await users().updateOne(
        { _id: userId },
        { $set: { passwordHash: await bcrypt.hash(password, BCRYPT_ROUNDS), emailVerified: true } },
      );
      res.json({ message: 'Password updated. You can log in now.' } satisfies MessageResponse);
    }),
  );
}
