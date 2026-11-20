import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import type { ElevationCache } from '../cache.js';
import { resolveElevations, type FetchLike } from '../providers.js';

const CoordinateSchema = z.object({
  lat: z.number().finite().min(-85).max(85),
  lng: z.number().finite().min(-180).max(180),
});

const ProfileRequestSchema = z.object({
  points: z.array(CoordinateSchema).min(2).max(200),
});

const SinglePointQuerySchema = z.object({
  lat: z.coerce.number().finite().min(-85).max(85),
  lng: z.coerce.number().finite().min(-180).max(180),
});

export interface ElevationRoutesContext {
  cache: ElevationCache;
  fetchImpl: FetchLike;
}

export function registerElevationRoutes(
  app: FastifyInstance,
  ctx: ElevationRoutesContext,
): void {
  const startedAt = Date.now();

  app.get('/api/health', async () => {
    return {
      status: 'ok',
      service: 'linksight-rf-api',
      cacheEntries: ctx.cache.count(),
      uptimeSec: Math.round((Date.now() - startedAt) / 1000),
    };
  });

  app.post('/api/elevation/profile', async (request, reply) => {
    const parsed = ProfileRequestSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({
        error: 'Invalid elevation profile payload',
        issues: parsed.error.issues.map((issue) => ({
          path: issue.path.join('.'),
          message: issue.message,
        })),
      });
    }

    const result = await resolveElevations(
      parsed.data.points,
      ctx.cache,
      ctx.fetchImpl,
    );
    return reply.send(result);
  });

  app.get('/api/elevation/point', async (request, reply) => {
    const parsed = SinglePointQuerySchema.safeParse(request.query);
    if (!parsed.success) {
      return reply.status(400).send({
        error: 'Invalid coordinates query parameters',
        issues: parsed.error.issues.map((issue) => ({
          path: issue.path.join('.'),
          message: issue.message,
        })),
      });
    }

    const result = await resolveElevations(
      [{ lat: parsed.data.lat, lng: parsed.data.lng }],
      ctx.cache,
      ctx.fetchImpl,
    );

    return reply.send({
      elevationM: result.elevations[0] ?? 0,
      source: result.source,
      cacheHitRatio: result.cacheHitRatio,
      degraded: result.degraded,
    });
  });
}
