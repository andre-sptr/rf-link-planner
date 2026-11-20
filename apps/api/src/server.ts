import { resolve } from 'node:path';
import helmet from '@fastify/helmet';
import rateLimit from '@fastify/rate-limit';
import Fastify, { type FastifyInstance } from 'fastify';
import { ElevationCache } from './cache.js';
import type { FetchLike } from './providers.js';
import { registerElevationRoutes } from './routes/elevation.js';

export interface BuildServerOptions {
  dbPath?: string;
  fetchImpl?: FetchLike;
  rateLimitMax?: number;
  logger?: boolean;
}

export async function buildServer(
  options: BuildServerOptions = {},
): Promise<{ app: FastifyInstance; cache: ElevationCache }> {
  const app = Fastify({
    logger: options.logger ?? false,
    bodyLimit: 256 * 1024,
  });

  const dbPath =
    options.dbPath ??
    process.env.ELEVATION_DB_PATH ??
    resolve(process.cwd(), 'apps/api/data/elevation-cache.db');

  const cache = new ElevationCache(dbPath);
  const fetchImpl = options.fetchImpl ?? fetch;

  await app.register(helmet, {
    contentSecurityPolicy: false,
  });

  await app.register(rateLimit, {
    max: options.rateLimitMax ?? 60,
    timeWindow: '1 minute',
  });

  registerElevationRoutes(app, { cache, fetchImpl });

  app.addHook('onClose', async () => {
    cache.close();
  });

  return { app, cache };
}
