import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { buildServer } from './server.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const defaultDbPath = resolve(__dirname, '../data/elevation-cache.db');

const host = process.env.HOST ?? '127.0.0.1';
const port = Number(process.env.PORT ?? 3003);

const { app } = await buildServer({
  dbPath: process.env.ELEVATION_DB_PATH ?? defaultDbPath,
  logger: process.env.NODE_ENV !== 'test',
});

const shutdown = async (signal: string) => {
  app.log.info(`Received ${signal}, shutting down cleanly`);
  await app.close();
  process.exit(0);
};

process.on('SIGINT', () => void shutdown('SIGINT'));
process.on('SIGTERM', () => void shutdown('SIGTERM'));

try {
  await app.listen({ host, port });
  console.log(`LinkSight RF API listening on http://${host}:${port}`);
} catch (error) {
  console.error('Failed to start LinkSight RF API:', error);
  process.exit(1);
}
