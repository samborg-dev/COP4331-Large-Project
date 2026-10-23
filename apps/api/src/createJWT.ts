import jwt from 'jsonwebtoken';
import { tokenPayloadSchema, type TokenPayload } from '@cop4331/shared';
import { env } from './env.js';

export function createToken(user: TokenPayload): { accessToken: string } {
  const accessToken = jwt.sign(user, env.ACCESS_TOKEN_SECRET, {
    expiresIn: env.ACCESS_TOKEN_EXPIRES_IN as jwt.SignOptions['expiresIn'],
  });
  return { accessToken };
}

// true when the token is missing, malformed, tampered with, or expired
export function isExpired(token: string | undefined): boolean {
  try {
    jwt.verify(token ?? '', env.ACCESS_TOKEN_SECRET);
    return false;
  } catch {
    return true;
  }
}

// issue a fresh token carrying the same user info (call after isExpired() is false)
export function refresh(token: string): { accessToken: string } {
  const decoded = jwt.decode(token);
  const { userId, firstName, lastName } = tokenPayloadSchema.parse(decoded);
  return createToken({ userId, firstName, lastName });
}
