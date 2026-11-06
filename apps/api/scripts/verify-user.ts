// Marks an account as email-verified, for local testing and demos before the web
// app's /verify-email page exists. Uses MONGODB_URI from the root .env.
// Usage: pnpm --filter @cop4331/api user:verify someone@example.com
import { client, connectDb, db } from '../src/db.js';

const email = process.argv[2]?.trim().toLowerCase();
if (!email) {
  console.error('Usage: pnpm --filter @cop4331/api user:verify <email>');
  process.exit(1);
}

await connectDb();
const { matchedCount } = await db()
  .collection('users')
  .updateOne({ email }, { $set: { emailVerified: true } });
await client.close();

if (!matchedCount) {
  console.error(`No account found for ${email}`);
  process.exit(1);
}
console.log(`Verified ${email}`);
