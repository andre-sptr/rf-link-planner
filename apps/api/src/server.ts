import { resolve } from 'node:path';
import helmet from '@fastify/helmet';
import rateLimit from '@fastify/rate-limit';
import Fastify, { type FastifyInstance } from 'fastify';
import { ElevationCache } from './cache.js';
import { UpstreamCoordinator, type FetchLike } from './providers.js';
import { registerElevationRoutes } from './routes/elevation.js';

export interface BuildServerOptions {
  dbPath?: string;
  fetchImpl?: FetchLike;
  rateLimitMax?: number;
  logger?: boolean;
  trustProxy?: boolean | string | string[];
  openTopoMinIntervalMs?: number;
  maxDiskCacheEntries?: number;
}

const PRUNE_INTERVAL_MS = 6 * 60 * 60 * 1000;

export async function buildServer(
  options: BuildServerOptions = {},
): Promise<{ app: FastifyInstance; cache: ElevationCache }> {
  const app = Fastify({
    logger: options.logger ?? false,
    bodyLimit: 256 * 1024,
    trustProxy: options.trustProxy ?? '127.0.0.1',
  });

  const dbPath =
    options.dbPath ??
    process.env.ELEVATION_DB_PATH ??
    resolve(process.cwd(), 'apps/api/data/elevation-cache.db');

  const cache = new ElevationCache(dbPath, {
    maxDiskEntries: options.maxDiskCacheEntries,
  });
  cache.prune();

  const pruneTimer = setInterval(() => {
    cache.prune();
  }, PRUNE_INTERVAL_MS);
  pruneTimer.unref();

  const coordinator = new UpstreamCoordinator({
    fetchImpl: options.fetchImpl ?? fetch,
    openTopoMinIntervalMs: options.openTopoMinIntervalMs,
  });

  await app.register(helmet, {
    contentSecurityPolicy: false,
  });

  await app.register(rateLimit, {
    max: options.rateLimitMax ?? 60,
    timeWindow: '1 minute',
  });

  registerElevationRoutes(app, { cache, coordinator });

  app.addHook('onClose', async () => {
    clearInterval(pruneTimer);
    cache.close();
  });

  return { app, cache };
}
