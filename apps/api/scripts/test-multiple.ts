import dotenv from 'dotenv';
import { connectDB, getDb } from '../src/db.js';
import { createRawToken, hashToken } from '../src/tokens.js';

dotenv.config();

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
}

interface SearchResponseData {
  countries?: Array<{ id?: string }>;
}

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

  // 1. Register
  const reg = await request('POST', '/api/auth/register', {
    firstName: 'Test',
    lastName: 'User',
    email: TEST_EMAIL,
    password: INITIAL_PASSWORD,
  });
  console.log('1. POST /api/auth/register ->', reg.status, reg.data);

  // 2. Login before verification (Expect 403)
  const unverifiedLogin = await request('POST', '/api/auth/login', {
    email: TEST_EMAIL,
    password: INITIAL_PASSWORD,
  });
  console.log('2. POST /api/auth/login (unverified, expect 403) ->', unverifiedLogin.status, unverifiedLogin.data);

  // 3. Resend verification (Expect 200)
  const resend = await request('POST', '/api/auth/resend-verification', { email: TEST_EMAIL });
  console.log('3. POST /api/auth/resend-verification ->', resend.status, resend.data);

  // Inject known verify token in DB so we can test POST /api/auth/verify-email directly
  const user = await db.collection('users').findOne({ email: TEST_EMAIL });
  if (!user) throw new Error('Test user was not created in DB');

  const rawVerifyToken = createRawToken();
  await db.collection('tokens').insertOne({
    userId: user._id,
    type: 'verify',
    tokenHash: hashToken(rawVerifyToken),
    expiresAt: new Date(Date.now() + 3600_000),
  });

  // 4. Verify Email (Expect 200)
  const verify = await request('POST', '/api/auth/verify-email', { token: rawVerifyToken });
  console.log('4. POST /api/auth/verify-email ->', verify.status, verify.data);

  // 5. Forgot Password (Expect 200)
  const forgot = await request('POST', '/api/auth/forgot-password', { email: TEST_EMAIL });
  console.log('5. POST /api/auth/forgot-password ->', forgot.status, forgot.data);

  // Inject known reset token in DB to test POST /api/auth/reset-password
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
  console.log('6. POST /api/auth/reset-password ->', reset.status, reset.data);

  // 7. Login with new password (Expect 200 + accessToken)
  const login = await request<LoginResponseData>('POST', '/api/auth/login', {
    email: TEST_EMAIL,
    password: NEW_PASSWORD,
  });
  console.log('7. POST /api/auth/login (verified) ->', login.status, {
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

  // 9. GET /api/countries/search?q=fra&limit=10
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
    const firstCountryId = search.data?.countries?.[0]?.id ?? 'FRA';
    const guess = await request(
      'POST',
      `/api/games/${gameId}/guesses`,
      { countryId: firstCountryId },
      accessToken
    );
    console.log('12. POST /api/games/:id/guesses ->', guess.status, guess.data);
  }

  // 13. GET /api/leaderboard
  const leaderboard = await request('GET', '/api/leaderboard?page=1&limit=5', undefined, accessToken);
  console.log('13. GET /api/leaderboard ->', leaderboard.status, leaderboard.data);

  // Clean up test user
  await db.collection('users').deleteOne({ _id: user._id });
  await db.collection('tokens').deleteMany({ userId: user._id });
  if (gameId) await db.collection('games').deleteMany({ userId: user._id });

  console.log('\nAll E2E tests finished and test data cleaned up!');
  process.exit(0);
}

runTests().catch((err) => {
  console.error('E2E Test Error:', err);
  process.exit(1);
});