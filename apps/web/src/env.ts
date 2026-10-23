import { createEnv } from '@t3-oss/env-core';
import { z } from 'zod';

// Only VITE_* variables are exposed to the browser (set them in the root .env)
export const env = createEnv({
  clientPrefix: 'VITE_',
  client: {
    VITE_API_URL: z.string().url().default('http://localhost:5000'),
  },
  runtimeEnv: import.meta.env,
  emptyStringAsUndefined: true,
});
