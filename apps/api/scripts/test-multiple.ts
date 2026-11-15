import dotenv from 'dotenv';
import { ObjectId } from 'mongodb';
import { connectDB, getDb } from '../src/db.js';
import { createRawToken, hashToken } from '../src/tokens.js';

dotenv.config();

const destructiveE2EAllowed =
  process.env.NODE_ENV === 'test' && process.env.ALLOW_DESTRUCTIVE_E2E === 'true';

const BASE_URL = `http://localhost:${process.env.PORT || 5000}`;
const TEST_EMAIL = 'delivered@resend.dev';
const INITIAL_PASSWORD = 'Password123!';
const NEW_PASSWORD = 'NewPassword456!';

interface LoginResponseData {
  accessToken?: string;
  user?: unknown;
}

interface StartGameResponseData {
  gameId?: string;
  maxGuesses?: number;
}

interface SearchCountryItem {
  id?: string;
  name?: string;
  iso2?: string;
  iso3?: string;
  continent?: string;
}

type SearchResponseData = SearchCountryItem[];

async function request<T = Record<string, unknown>>(
  method: string,
  path: string,
  body?: unknown,
  token?: string
): Promise<{ status: number; data: T }> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const res = await fetch(`${BASE_URL}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });

  const data = (await res.json().catch(() => ({}))) as T;
  return { status: res.status, data };
}

async function runTests() {
  console.log(`Starting E2E API tests against ${BASE_URL}...\n`);
  await connectDB();
  const db = getDb();

  // Pre-clean any leftover test user with TEST_EMAIL
  const existing = await db.collection('users').findOne({ email: TEST_EMAIL });
  if (existing) {
    await db.collection('users').deleteOne({ _id: existing._id });
    await db.collection('tokens').deleteMany({ userId: existing._id });
    await db.collection('games').deleteMany({ userId: existing._id });
  }

  // 1. Register (Expect 201)
  const reg = await request('POST', '/api/auth/register', {
    firstName: 'Test',
    lastName: 'User',
    email: TEST_EMAIL,
    password: INITIAL_PASSWORD,
  });
  console.log('1. POST /api/auth/register (expect 201) ->', reg.status, reg.data);

  // 1b. Duplicate Register (Expect 409)
  const dupReg = await request('POST', '/api/auth/register', {
    firstName: 'Test',
    lastName: 'User',
    email: TEST_EMAIL,
    password: INITIAL_PASSWORD,
  });
  console.log('1b. POST /api/auth/register (duplicate, expect 409) ->', dupReg.status, dupReg.data);

  // 2. Login before verification (Expect 403)
  const unverifiedLogin = await request('POST', '/api/auth/login', {
    email: TEST_EMAIL,
    password: INITIAL_PASSWORD,
  });
  console.log('2. POST /api/auth/login (unverified, expect 403) ->', unverifiedLogin.status, unverifiedLogin.data);

  // 2b. Login with wrong password (Expect 401)
  const badPasswordLogin = await request('POST', '/api/auth/login', {
    email: TEST_EMAIL,
    password: 'WrongPassword999!',
  });
  console.log('2b. POST /api/auth/login (wrong password, expect 401) ->', badPasswordLogin.status, badPasswordLogin.data);

  // 3. Resend verification (Expect 200)
  const resend = await request('POST', '/api/auth/resend-verification', { email: TEST_EMAIL });
  console.log('3. POST /api/auth/resend-verification (expect 200) ->', resend.status, resend.data);

  const user = await db.collection('users').findOne({ email: TEST_EMAIL });
  if (!user) throw new Error('Test user was not created in DB');

  // 3b. Expired Verification Token (Expect 400)
  const expiredVerifyToken = createRawToken();
  await db.collection('tokens').insertOne({
    userId: user._id,
    type: 'verify',
    tokenHash: hashToken(expiredVerifyToken),
    expiresAt: new Date(Date.now() - 3600_000),
  });
  const expiredVerify = await request('POST', '/api/auth/verify-email', { token: expiredVerifyToken });
  console.log('3b. POST /api/auth/verify-email (expired token, expect 400) ->', expiredVerify.status, expiredVerify.data);

  // Inject valid verify token in DB
  const rawVerifyToken = createRawToken();
  await db.collection('tokens').insertOne({
    userId: user._id,
    type: 'verify',
    tokenHash: hashToken(rawVerifyToken),
    expiresAt: new Date(Date.now() + 3600_000),
  });

  // 4. Verify Email (Expect 200)
  const verify = await request('POST', '/api/auth/verify-email', { token: rawVerifyToken });
  console.log('4. POST /api/auth/verify-email (expect 200) ->', verify.status, verify.data);

  // 4b. Reused Verify Token (Expect 400)
  const reusedVerify = await request('POST', '/api/auth/verify-email', { token: rawVerifyToken });
  console.log('4b. POST /api/auth/verify-email (reused token, expect 400) ->', reusedVerify.status, reusedVerify.data);

  // 5. Forgot Password (Expect 200)
  const forgot = await request('POST', '/api/auth/forgot-password', { email: TEST_EMAIL });
  console.log('5. POST /api/auth/forgot-password (expect 200) ->', forgot.status, forgot.data);

  // Inject known reset token in DB
  const rawResetToken = createRawToken();
  await db.collection('tokens').insertOne({
    userId: user._id,
    type: 'reset',
    tokenHash: hashToken(rawResetToken),
    expiresAt: new Date(Date.now() + 3600_000),
  });

  // 6. Reset Password (Expect 200)
  const reset = await request('POST', '/api/auth/reset-password', {
    token: rawResetToken,
    password: NEW_PASSWORD,
  });
  console.log('6. POST /api/auth/reset-password (expect 200) ->', reset.status, reset.data);

  // 6b. Reused Reset Token (Expect 400)
  const reusedReset = await request('POST', '/api/auth/reset-password', {
    token: rawResetToken,
    password: NEW_PASSWORD,
  });
  console.log('6b. POST /api/auth/reset-password (reused token, expect 400) ->', reusedReset.status, reusedReset.data);

  // 7. Login with new password (Expect 200 + accessToken)
  const login = await request<LoginResponseData>('POST', '/api/auth/login', {
    email: TEST_EMAIL,
    password: NEW_PASSWORD,
  });
  console.log('7. POST /api/auth/login (verified, expect 200) ->', login.status, {
    hasAccessToken: Boolean(login.data?.accessToken),
    user: login.data?.user,
  });

  const accessToken = login.data?.accessToken;
  if (!accessToken) {
    console.error('Stopping protected route tests: No accessToken returned from login.');
    process.exit(1);
  }

  // 8. GET /api/users/me
  const me = await request('GET', '/api/users/me', undefined, accessToken);
  console.log('8. GET /api/users/me ->', me.status, me.data);

  // 9. GET /api/countries/search?q=fra&limit=10 (Expect top-level array per api-contract.md)
  const search = await request<SearchResponseData>(
    'GET',
    '/api/countries/search?q=fra&limit=10',
    undefined,
    accessToken
  );
  console.log('9. GET /api/countries/search?q=fra&limit=10 ->', search.status, search.data);

  // 10. POST /api/games
  const startGame = await request<StartGameResponseData>('POST', '/api/games', {}, accessToken);
  console.log('10. POST /api/games ->', startGame.status, startGame.data);

  const gameId = startGame.data?.gameId;
  if (gameId) {
    // 11. GET /api/games/:id
    const getGame = await request('GET', `/api/games/${gameId}`, undefined, accessToken);
    console.log('11. GET /api/games/:id ->', getGame.status, getGame.data);

    // 12. POST /api/games/:id/guesses
    const firstCountry = Array.isArray(search.data) ? search.data[0] : undefined;
    const firstCountryId = firstCountry?.iso2 || firstCountry?.id || firstCountry?.name || 'FR';
    const guess = await request(
      'POST',
      `/api/games/${gameId}/guesses`,
      { countryId: firstCountryId },
      accessToken
    );
    console.log('12. POST /api/games/:id/guesses ->', guess.status, guess.data);

    // 12b. Cannot touch another user's game (Expect 403)
    const otherUsersGame = await db.collection('games').insertOne({
      userId: new ObjectId(),
      targetCountry: 'Japan',
      targetIso: 'JP',
      targetLat: 36,
      targetLng: 138,
      guesses: [],
      status: 'IN_PROGRESS',
      createdAt: new Date(),
    });
    const forbiddenGuess = await request(
      'POST',
      `/api/games/${otherUsersGame.insertedId.toString()}/guesses`,
      { countryId: firstCountryId },
      accessToken
    );
    console.log("12b. POST /api/games/:id/guesses (other user's game, expect 403) ->", forbiddenGuess.status, forbiddenGuess.data);
    await db.collection('games').deleteOne({ _id: otherUsersGame.insertedId });
  }

  // 13. GET /api/leaderboard (Expect { entries, page, limit, total } per api-contract.md)
  const leaderboard = await request('GET', '/api/leaderboard?page=1&limit=5', undefined, accessToken);
  console.log('13. GET /api/leaderboard ->', leaderboard.status, leaderboard.data);

  // Clean up test user
  await db.collection('users').deleteOne({ _id: user._id });
  await db.collection('tokens').deleteMany({ userId: user._id });
  if (gameId) await db.collection('games').deleteMany({ userId: user._id });

  console.log('\nAll E2E tests finished and test data cleaned up!');
  process.exit(0);
}

if (!destructiveE2EAllowed) {
  console.error(
    'Refusing to run destructive E2E tests. Set NODE_ENV=test and ALLOW_DESTRUCTIVE_E2E=true explicitly.',
  );
  process.exitCode = 1;
} else {
  runTests().catch((err) => {
    console.error('E2E Test Error:', err);
    process.exit(1);
  });
}