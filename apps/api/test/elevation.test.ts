import { describe, expect, it } from 'vitest';
import { ElevationCache } from '../src/cache.js';
import { buildServer } from '../src/server.js';

describe('LinkSight RF API elevation routes', () => {
  it('returns health check metadata', async () => {
    const { app } = await buildServer({ dbPath: ':memory:' });
    const res = await app.inject({ method: 'GET', url: '/api/health' });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.status).toBe('ok');
    expect(body.cacheEntries).toBe(0);
    await app.close();
  });

  it('rejects invalid elevation profile payloads with 400', async () => {
    const { app } = await buildServer({ dbPath: ':memory:' });

    const tooFew = await app.inject({
      method: 'POST',
      url: '/api/elevation/profile',
      payload: { points: [{ lat: 0.5, lng: 101.4 }] },
    });
    expect(tooFew.statusCode).toBe(400);

    const outOfRange = await app.inject({
      method: 'POST',
      url: '/api/elevation/profile',
      payload: {
        points: [
          { lat: 95, lng: 101.4 },
          { lat: 0.5, lng: 101.5 },
        ],
      },
    });
    expect(outOfRange.statusCode).toBe(400);

    const tooMany = await app.inject({
      method: 'POST',
      url: '/api/elevation/profile',
      payload: {
        points: Array.from({ length: 201 }, (_, i) => ({
          lat: -6.9 + i * 0.001,
          lng: 107.6,
        })),
      },
    });
    expect(tooMany.statusCode).toBe(400);

    await app.close();
  });

  it('fetches SRTM30m, normalizes ocean nulls to 0, and hits cache on repeat request', async () => {
    let calls = 0;
    const mockFetch: typeof fetch = async () => {
      calls += 1;
      return new Response(
        JSON.stringify({
          status: 'OK',
          results: [{ elevation: 678 }, { elevation: null }],
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      );
    };

    const { app } = await buildServer({
      dbPath: ':memory:',
      fetchImpl: mockFetch,
    });

    const payload = {
      points: [
        { lat: -6.9475, lng: 107.6191 },
        { lat: -6.8012, lng: 107.6285 },
      ],
    };

    const first = await app.inject({
      method: 'POST',
      url: '/api/elevation/profile',
      payload,
    });
    expect(first.statusCode).toBe(200);
    expect(first.json()).toEqual({
      elevations: [678, 0],
      source: 'srtm30m',
      cacheHitRatio: 0,
      degraded: false,
    });
    expect(calls).toBe(1);

    const second = await app.inject({
      method: 'POST',
      url: '/api/elevation/profile',
      payload,
    });
    expect(second.statusCode).toBe(200);
    expect(second.json()).toEqual({
      elevations: [678, 0],
      source: 'srtm30m',
      cacheHitRatio: 1,
      degraded: false,
    });
    expect(calls).toBe(1);

    await app.close();
  });

  it('fails over from OpenTopoData HTTP 429 to Open-Meteo 90m', async () => {
    const mockFetch: typeof fetch = async (input) => {
      const url = String(input);
      if (url.includes('opentopodata.org')) {
        return new Response('Rate limited', { status: 429 });
      }
      return new Response(JSON.stringify({ elevation: [110, 240] }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    };

    const { app } = await buildServer({
      dbPath: ':memory:',
      fetchImpl: mockFetch,
    });

    const res = await app.inject({
      method: 'POST',
      url: '/api/elevation/profile',
      payload: {
        points: [
          { lat: 0.5071, lng: 101.4478 },
          { lat: 0.5785, lng: 101.4255 },
        ],
      },
    });

    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({
      elevations: [110, 240],
      source: 'open-meteo-90m',
      cacheHitRatio: 0,
      degraded: false,
    });

    await app.close();
  });

  it('returns synthetic fallback without polluting cache when all upstreams fail', async () => {
    const mockFetch: typeof fetch = async () => {
      throw new Error('Network unreachable');
    };

    const { app, cache } = await buildServer({
      dbPath: ':memory:',
      fetchImpl: mockFetch,
    });

    const res = await app.inject({
      method: 'POST',
      url: '/api/elevation/profile',
      payload: {
        points: [
          { lat: -6.9475, lng: 107.6191 },
          { lat: -6.735, lng: 107.652 },
        ],
      },
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.source).toBe('synthetic-fallback');
    expect(body.degraded).toBe(true);
    expect(body.elevations).toHaveLength(2);
    expect(cache.count()).toBe(0);

    await app.close();
  });

  it('tracks rate limits per X-Forwarded-For client IP and exempts /api/health', async () => {
    const mockFetch: typeof fetch = async () =>
      new Response(
        JSON.stringify({
          status: 'OK',
          results: [{ elevation: 100 }, { elevation: 120 }],
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      );

    const { app } = await buildServer({
      dbPath: ':memory:',
      fetchImpl: mockFetch,
      rateLimitMax: 2,
      openTopoMinIntervalMs: 0,
    });

    const payload = {
      points: [
        { lat: -6.9475, lng: 107.6191 },
        { lat: -6.8012, lng: 107.6285 },
      ],
    };

    const r1 = await app.inject({
      method: 'POST',
      url: '/api/elevation/profile',
      headers: { 'x-forwarded-for': '203.0.113.10' },
      payload,
    });
    const r2 = await app.inject({
      method: 'POST',
      url: '/api/elevation/profile',
      headers: { 'x-forwarded-for': '203.0.113.10' },
      payload,
    });
    const r3 = await app.inject({
      method: 'POST',
      url: '/api/elevation/profile',
      headers: { 'x-forwarded-for': '203.0.113.10' },
      payload,
    });
    expect(r1.statusCode).toBe(200);
    expect(r2.statusCode).toBe(200);
    expect(r3.statusCode).toBe(429);

    // Separate client IP still has full quota
    const otherClient = await app.inject({
      method: 'POST',
      url: '/api/elevation/profile',
      headers: { 'x-forwarded-for': '203.0.113.11' },
      payload,
    });
    expect(otherClient.statusCode).toBe(200);

    // /api/health remains exempt even for rate-limited client
    const health = await app.inject({
      method: 'GET',
      url: '/api/health',
      headers: { 'x-forwarded-for': '203.0.113.10' },
    });
    expect(health.statusCode).toBe(200);

    await app.close();
  });

  it('deduplicates simultaneous uncached elevation requests (single-flight)', async () => {
    let fetchCalls = 0;
    const mockFetch: typeof fetch = async () => {
      fetchCalls += 1;
      await new Promise((r) => setTimeout(r, 25));
      return new Response(
        JSON.stringify({
          status: 'OK',
          results: [{ elevation: 321 }, { elevation: 654 }],
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      );
    };

    const { app } = await buildServer({
      dbPath: ':memory:',
      fetchImpl: mockFetch,
      openTopoMinIntervalMs: 0,
    });

    const payload = {
      points: [
        { lat: -6.9475, lng: 107.6191 },
        { lat: -6.8012, lng: 107.6285 },
      ],
    };

    const [a, b] = await Promise.all([
      app.inject({ method: 'POST', url: '/api/elevation/profile', payload }),
      app.inject({ method: 'POST', url: '/api/elevation/profile', payload }),
    ]);

    expect(a.statusCode).toBe(200);
    expect(b.statusCode).toBe(200);
    expect(a.json().elevations).toEqual([321, 654]);
    expect(b.json().elevations).toEqual([321, 654]);
    expect(fetchCalls).toBe(1);

    await app.close();
  });

  it('prunes expired TTL entries and caps maximum disk rows', () => {
    const cache = new ElevationCache(':memory:', {
      ttlMs: 1000,
      maxDiskEntries: 2,
    });

    const t0 = 10_000;
    cache.setMany(
      [
        { lat: 0.1, lng: 101.1, elevationM: 10, dataset: 'srtm30m' },
        { lat: 0.2, lng: 101.2, elevationM: 20, dataset: 'srtm30m' },
      ],
      t0,
    );
    cache.setMany(
      [
        { lat: 0.3, lng: 101.3, elevationM: 30, dataset: 'srtm30m' },
        { lat: 0.4, lng: 101.4, elevationM: 40, dataset: 'srtm30m' },
      ],
      t0 + 600,
    );

    // At t0 + 1100: first 2 rows (t0) expired, remaining 2 rows kept under cap=2
    const deletedExpired = cache.prune(t0 + 1100);
    expect(deletedExpired).toBe(2);
    expect(cache.count()).toBe(2);

    // Add 1 more fresh point -> cap=2 trims oldest remaining row
    cache.setMany(
      [{ lat: 0.5, lng: 101.5, elevationM: 50, dataset: 'srtm30m' }],
      t0 + 1200,
    );
    const deletedCap = cache.prune(t0 + 1200);
    expect(deletedCap).toBe(1);
    expect(cache.count()).toBe(2);

    cache.close();
  });
});
