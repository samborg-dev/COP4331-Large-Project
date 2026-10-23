import { config } from 'dotenv';
import { createEnv } from '@t3-oss/env-core';
import { z } from 'zod';

// Load the monorepo-root .env (same depth from src/ and dist/)
config({ path: new URL('../../../.env', import.meta.url) });

export const env = createEnv({
  server: {
    NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
    PORT: z.coerce.number().default(5000),
    MONGODB_URI: z.string().min(1, 'MONGODB_URI is required (see .env.example)'),
    ACCESS_TOKEN_SECRET: z.string().min(16, 'ACCESS_TOKEN_SECRET must be a long random string'),
    ACCESS_TOKEN_EXPIRES_IN: z.string().default('30m'),
  },
  runtimeEnv: process.env,
  emptyStringAsUndefined: true,
});
