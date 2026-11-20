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
const DEFAULT_OPENTOPO_MIN_INTERVAL_MS = 1050;

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

export interface UpstreamBatchResult {
  elevationsByKey: Map<string, number>;
  source: ElevationSource;
  degraded: boolean;
}

export interface UpstreamCoordinatorOptions {
  fetchImpl?: FetchLike;
  openTopoMinIntervalMs?: number;
}

/**
 * Coordinates upstream DEM requests across concurrent API calls:
 * 1) Enforces a global minimum spacing between OpenTopoData SRTM requests.
 * 2) Deduplicates simultaneous identical uncached miss batches (single-flight).
 */
export class UpstreamCoordinator {
  readonly fetchImpl: FetchLike;
  private readonly openTopoMinIntervalMs: number;
  private openTopoQueue: Promise<void> = Promise.resolve();
  private lastOpenTopoRequestAt = 0;
  private readonly inFlight = new Map<string, Promise<UpstreamBatchResult>>();

  constructor(options: UpstreamCoordinatorOptions = {}) {
    this.fetchImpl = options.fetchImpl ?? fetch;
    this.openTopoMinIntervalMs =
      options.openTopoMinIntervalMs ?? DEFAULT_OPENTOPO_MIN_INTERVAL_MS;
  }

  scheduleOpenTopo<T>(task: () => Promise<T>): Promise<T> {
    const run = async (): Promise<T> => {
      if (this.openTopoMinIntervalMs > 0 && this.lastOpenTopoRequestAt > 0) {
        const elapsed = Date.now() - this.lastOpenTopoRequestAt;
        const waitMs = this.openTopoMinIntervalMs - elapsed;
        if (waitMs > 0) {
          await sleep(waitMs);
        }
      }
      this.lastOpenTopoRequestAt = Date.now();
      return task();
    };

    const next = this.openTopoQueue.then(run, run);
    this.openTopoQueue = next.then(
      () => undefined,
      () => undefined,
    );
    return next;
  }

  async resolveMissingBatch(
    uniqueMisses: Coordinates[],
    cache: ElevationCache,
  ): Promise<UpstreamBatchResult> {
    const batchKey = uniqueMisses
      .map((pt) => elevationGridKey(pt.lat, pt.lng))
      .sort()
      .join('|');

    const existing = this.inFlight.get(batchKey);
    if (existing) {
      return existing;
    }

    const promise = (async (): Promise<UpstreamBatchResult> => {
      let fetchedElevations: number[] | null = null;
      let fetchedSource: ElevationSource = 'synthetic-fallback';
      let degraded = false;

      try {
        fetchedElevations = await fetchOpenTopoData(
          uniqueMisses,
          this.fetchImpl,
          (task) => this.scheduleOpenTopo(task),
        );
        fetchedSource = 'srtm30m';
      } catch {
        try {
          fetchedElevations = await fetchOpenMeteo(uniqueMisses, this.fetchImpl);
          fetchedSource = 'open-meteo-90m';
        } catch {
          degraded = true;
          fetchedSource = 'synthetic-fallback';
          fetchedElevations = uniqueMisses.map((pt) =>
            generateSyntheticElevationM(pt.lat, pt.lng),
          );
        }
      }

      const elevationsByKey = new Map<string, number>();
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
        elevationsByKey.set(key, elev);
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

      return {
        elevationsByKey,
        source: fetchedSource,
        degraded,
      };
    })();

    this.inFlight.set(batchKey, promise);
    try {
      return await promise;
    } finally {
      this.inFlight.delete(batchKey);
    }
  }
}

export async function fetchOpenTopoData(
  points: Coordinates[],
  fetchImpl: FetchLike = fetch,
  schedule?: <T>(task: () => Promise<T>) => Promise<T>,
): Promise<number[]> {
  for (const pt of points) {
    if (pt.lat < -56 || pt.lat > 60) {
      throw new Error('Latitude outside SRTM30m coverage [-56, 60]');
    }
  }

  const chunks = chunkPoints(points, CHUNK_SIZE);
  const results: number[] = [];

  for (let idx = 0; idx < chunks.length; idx++) {
    const chunk = chunks[idx]!;
    const execChunk = async (): Promise<number[]> => {
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

      return body.results.map((item) => {
        const val = item.elevation;
        return typeof val === 'number' && Number.isFinite(val) ? val : 0;
      });
    };

    let chunkElevations: number[];
    if (schedule) {
      chunkElevations = await schedule(execChunk);
    } else {
      if (idx > 0) {
        await sleep(DEFAULT_OPENTOPO_MIN_INTERVAL_MS);
      }
      chunkElevations = await execChunk();
    }
    results.push(...chunkElevations);
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
  coordinatorOrFetch: UpstreamCoordinator | FetchLike = fetch,
): Promise<ElevationProfileResponse> {
  const coordinator =
    coordinatorOrFetch instanceof UpstreamCoordinator
      ? coordinatorOrFetch
      : new UpstreamCoordinator({ fetchImpl: coordinatorOrFetch });

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

  const batch = await coordinator.resolveMissingBatch(uniqueMisses, cache);

  const elevations = points.map((pt) => {
    const key = elevationGridKey(pt.lat, pt.lng);
    return cachedMap.get(key)?.elevationM ?? batch.elevationsByKey.get(key) ?? 0;
  });

  const finalSource: ElevationSource = batch.degraded
    ? 'synthetic-fallback'
    : hitDatasets.size > 0 && !hitDatasets.has(batch.source)
      ? 'mixed-cache'
      : batch.source;

  return {
    elevations,
    source: finalSource,
    cacheHitRatio,
    degraded: batch.degraded,
  };
}
