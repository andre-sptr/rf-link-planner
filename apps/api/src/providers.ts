import {
  generateSyntheticElevationM,
  type Coordinates,
  type ElevationProfileResponse,
  type ElevationSource,
} from '@linksight/rf-engine';
import { ElevationCache, elevationGridKey } from './cache.js';

export type FetchLike = typeof fetch;

const UPSTREAM_TIMEOUT_MS = 5000;
const CHUNK_SIZE = 100;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function chunkPoints<T>(items: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < items.length; i += size) {
    chunks.push(items.slice(i, i + size));
  }
  return chunks;
}

export async function fetchOpenTopoData(
  points: Coordinates[],
  fetchImpl: FetchLike = fetch,
): Promise<number[]> {
  for (const pt of points) {
    if (pt.lat < -56 || pt.lat > 60) {
      throw new Error('Latitude outside SRTM30m coverage [-56, 60]');
    }
  }

  const chunks = chunkPoints(points, CHUNK_SIZE);
  const results: number[] = [];

  for (let idx = 0; idx < chunks.length; idx++) {
    if (idx > 0) {
      await sleep(1050);
    }

    const chunk = chunks[idx]!;
    const locParam = chunk
      .map((p) => `${p.lat.toFixed(5)},${p.lng.toFixed(5)}`)
      .join('|');
    const url = `https://api.opentopodata.org/v1/srtm30m?locations=${encodeURIComponent(locParam)}`;

    const res = await fetchImpl(url, {
      signal: AbortSignal.timeout(UPSTREAM_TIMEOUT_MS),
      headers: { Accept: 'application/json' },
    });

    if (!res.ok) {
      throw new Error(`OpenTopoData HTTP ${res.status}`);
    }

    const body = (await res.json()) as {
      status?: string;
      results?: Array<{ elevation?: number | null }>;
    };

    if (body.status !== 'OK' || !Array.isArray(body.results)) {
      throw new Error('OpenTopoData invalid response structure');
    }

    if (body.results.length !== chunk.length) {
      throw new Error('OpenTopoData mismatched point count');
    }

    for (const item of body.results) {
      const val = item.elevation;
      results.push(typeof val === 'number' && Number.isFinite(val) ? val : 0);
    }
  }

  return results;
}

export async function fetchOpenMeteo(
  points: Coordinates[],
  fetchImpl: FetchLike = fetch,
): Promise<number[]> {
  const chunks = chunkPoints(points, CHUNK_SIZE);
  const results: number[] = [];

  for (const chunk of chunks) {
    const lats = chunk.map((p) => p.lat.toFixed(5)).join(',');
    const lngs = chunk.map((p) => p.lng.toFixed(5)).join(',');
    const url = `https://api.open-meteo.com/v1/elevation?latitude=${lats}&longitude=${lngs}`;

    const res = await fetchImpl(url, {
      signal: AbortSignal.timeout(UPSTREAM_TIMEOUT_MS),
      headers: { Accept: 'application/json' },
    });

    if (!res.ok) {
      throw new Error(`Open-Meteo HTTP ${res.status}`);
    }

    const body = (await res.json()) as {
      elevation?: Array<number | null>;
    };

    if (!Array.isArray(body.elevation) || body.elevation.length !== chunk.length) {
      throw new Error('Open-Meteo invalid response structure');
    }

    for (const val of body.elevation) {
      results.push(typeof val === 'number' && Number.isFinite(val) ? val : 0);
    }
  }

  return results;
}

export async function resolveElevations(
  points: Coordinates[],
  cache: ElevationCache,
  fetchImpl: FetchLike = fetch,
): Promise<ElevationProfileResponse> {
  const cachedMap = cache.getMany(points);

  const uniqueMisses: Coordinates[] = [];
  const missKeySet = new Set<string>();
  const hitDatasets = new Set<string>();

  for (const pt of points) {
    const key = elevationGridKey(pt.lat, pt.lng);
    const hit = cachedMap.get(key);
    if (hit) {
      hitDatasets.add(hit.dataset);
    } else if (!missKeySet.has(key)) {
      missKeySet.add(key);
      uniqueMisses.push(pt);
    }
  }

  const cacheHitRatio =
    points.length > 0
      ? Number(
          (
            points.filter((pt) => cachedMap.has(elevationGridKey(pt.lat, pt.lng)))
              .length / points.length
          ).toFixed(3),
        )
      : 1;

  if (uniqueMisses.length === 0) {
    let source: ElevationSource = 'mixed-cache';
    if (hitDatasets.size === 1) {
      const only = hitDatasets.values().next().value;
      if (only === 'srtm30m' || only === 'open-meteo-90m') {
        source = only;
      }
    }
    return {
      elevations: points.map(
        (pt) => cachedMap.get(elevationGridKey(pt.lat, pt.lng))?.elevationM ?? 0,
      ),
      source,
      cacheHitRatio: 1,
      degraded: false,
    };
  }

  let fetchedElevations: number[] | null = null;
  let fetchedSource: ElevationSource = 'synthetic-fallback';
  let degraded = false;

  try {
    fetchedElevations = await fetchOpenTopoData(uniqueMisses, fetchImpl);
    fetchedSource = 'srtm30m';
  } catch {
    try {
      fetchedElevations = await fetchOpenMeteo(uniqueMisses, fetchImpl);
      fetchedSource = 'open-meteo-90m';
    } catch {
      degraded = true;
      fetchedSource = 'synthetic-fallback';
      fetchedElevations = uniqueMisses.map((pt) =>
        generateSyntheticElevationM(pt.lat, pt.lng),
      );
    }
  }

  const fetchedMap = new Map<string, number>();
  const toPersist: Array<{
    lat: number;
    lng: number;
    elevationM: number;
    dataset: string;
  }> = [];

  for (let i = 0; i < uniqueMisses.length; i++) {
    const pt = uniqueMisses[i]!;
    const elev = fetchedElevations[i] ?? 0;
    const key = elevationGridKey(pt.lat, pt.lng);
    fetchedMap.set(key, elev);
    if (!degraded) {
      toPersist.push({
        lat: pt.lat,
        lng: pt.lng,
        elevationM: elev,
        dataset: fetchedSource,
      });
    }
  }

  if (!degraded && toPersist.length > 0) {
    cache.setMany(toPersist);
  }

  const elevations = points.map((pt) => {
    const key = elevationGridKey(pt.lat, pt.lng);
    return cachedMap.get(key)?.elevationM ?? fetchedMap.get(key) ?? 0;
  });

  const finalSource: ElevationSource =
    degraded
      ? 'synthetic-fallback'
      : hitDatasets.size > 0 && !hitDatasets.has(fetchedSource)
        ? 'mixed-cache'
        : fetchedSource;

  return {
    elevations,
    source: finalSource,
    cacheHitRatio,
    degraded,
  };
}
