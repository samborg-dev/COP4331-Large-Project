// The root .env is shared with the API; deploy bundles must use production React.
process.env.NODE_ENV = 'production';
const { build } = await import('vite');
await build();
