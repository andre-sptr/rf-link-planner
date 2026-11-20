import { describe, expect, it } from 'vitest';
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
});
