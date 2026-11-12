// Sends a sample verification email, to check deliverability before the real flow exists.
// Usage: pnpm --filter @cop4331/api mail:test you@gmail.com
// Try a Gmail and a UCF address, and check spam. Uses RESEND_API_KEY / MAIL_FROM / APP_URL from the root .env.
import { sendVerificationEmail } from '../src/mail.js';
import { createRawToken, hashToken } from '../src/tokens.js';
// import your token/user model to save the hashed token to MongoDB
const to = process.argv[2];
  if (!to) {
    console.error('Usage: pnpm --filter @cop4331/api mail:test <email>');
    process.exit(1);
  }

  const rawToken = createRawToken();
  const hashedToken = hashToken(rawToken);
  const verificationUrl = `${process.env.APP_URL}/lander?token=${hashedToken}`;

  await sendVerificationEmail(to, verificationUrl);
  console.log(`Sent test verification email to ${to}`);