import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['esm'],
  target: 'node22',
  clean: true,
  // @cop4331/shared ships TypeScript source, so bundle it into the output
  noExternal: ['@cop4331/shared'],
});
