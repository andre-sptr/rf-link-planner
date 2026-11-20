import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import Database from 'better-sqlite3';
import type { Coordinates } from '@linksight/rf-engine';

export interface CachedElevation {
  elevationM: number;
  dataset: string;
  fetchedAt: number;
}

export interface ElevationCacheOptions {
  maxMemoryEntries?: number;
  maxDiskEntries?: number;
  ttlMs?: number;
}

const DEFAULT_MAX_MEM = 20_000;
const DEFAULT_MAX_DISK = 250_000;
const DEFAULT_TTL_MS = 30 * 24 * 60 * 60 * 1000;

export function elevationGridKey(lat: number, lng: number): string {
  return `${lat.toFixed(4)},${lng.toFixed(4)}`;
}

export class ElevationCache {
  private readonly db: Database.Database;
  private readonly memory = new Map<string, CachedElevation>();
  private readonly maxMemoryEntries: number;
  private readonly maxDiskEntries: number;
  private readonly ttlMs: number;
  private readonly selectStmt: Database.Statement<
    [string],
    { elevation_m: number; dataset: string; fetched_at: number }
  >;
  private readonly upsertStmt: Database.Statement<[string, number, string, number]>;
  private readonly countStmt: Database.Statement<[], { cnt: number }>;
  private readonly deleteExpiredStmt: Database.Statement<[number]>;
  private readonly selectOldestKeysStmt: Database.Statement<[number], { key: string }>;
  private readonly deleteOldestStmt: Database.Statement<[number]>;

  constructor(dbPath: string, options: ElevationCacheOptions = {}) {
    if (dbPath !== ':memory:') {
      mkdirSync(dirname(dbPath), { recursive: true });
    }

    this.maxMemoryEntries = options.maxMemoryEntries ?? DEFAULT_MAX_MEM;
    this.maxDiskEntries = options.maxDiskEntries ?? DEFAULT_MAX_DISK;
    this.ttlMs = options.ttlMs ?? DEFAULT_TTL_MS;

    this.db = new Database(dbPath);
    this.db.pragma('journal_mode = WAL');
    this.db.pragma('busy_timeout = 3000');

    this.db.exec(`
      CREATE TABLE IF NOT EXISTS elevation_points (
        key TEXT PRIMARY KEY,
        elevation_m REAL NOT NULL,
        dataset TEXT NOT NULL,
        fetched_at INTEGER NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_elevation_fetched_at
        ON elevation_points(fetched_at);
    `);

    this.selectStmt = this.db.prepare(
      'SELECT elevation_m, dataset, fetched_at FROM elevation_points WHERE key = ?',
    );
    this.upsertStmt = this.db.prepare(
      'INSERT OR REPLACE INTO elevation_points (key, elevation_m, dataset, fetched_at) VALUES (?, ?, ?, ?)',
    );
    this.countStmt = this.db.prepare(
      'SELECT COUNT(*) AS cnt FROM elevation_points',
    );
    this.deleteExpiredStmt = this.db.prepare(
      'DELETE FROM elevation_points WHERE fetched_at < ?',
    );
    this.selectOldestKeysStmt = this.db.prepare(
      'SELECT key FROM elevation_points ORDER BY fetched_at ASC LIMIT ?',
    );
    this.deleteOldestStmt = this.db.prepare(
      'DELETE FROM elevation_points WHERE key IN (SELECT key FROM elevation_points ORDER BY fetched_at ASC LIMIT ?)',
    );
  }

  private rememberInMemory(key: string, entry: CachedElevation): void {
    if (this.memory.has(key)) {
      this.memory.delete(key);
    }
    this.memory.set(key, entry);
    if (this.memory.size > this.maxMemoryEntries) {
      const oldestKey = this.memory.keys().next().value;
      if (oldestKey !== undefined) {
        this.memory.delete(oldestKey);
      }
    }
  }

  getMany(points: Coordinates[], now = Date.now()): Map<string, CachedElevation> {
    const result = new Map<string, CachedElevation>();
    const cutoff = now - this.ttlMs;

    for (const pt of points) {
      const key = elevationGridKey(pt.lat, pt.lng);
      if (result.has(key)) continue;

      const mem = this.memory.get(key);
      if (mem && mem.fetchedAt >= cutoff) {
        this.rememberInMemory(key, mem);
        result.set(key, mem);
        continue;
      }

      const row = this.selectStmt.get(key);
      if (row && row.fetched_at >= cutoff) {
        const entry: CachedElevation = {
          elevationM: row.elevation_m,
          dataset: row.dataset,
          fetchedAt: row.fetched_at,
        };
        this.rememberInMemory(key, entry);
        result.set(key, entry);
      }
    }

    return result;
  }

  setMany(
    entries: Array<{
      lat: number;
      lng: number;
      elevationM: number;
      dataset: string;
    }>,
    now = Date.now(),
  ): void {
    if (entries.length === 0) return;

    const tx = this.db.transaction(
      (
        batch: Array<{
          key: string;
          elevationM: number;
          dataset: string;
        }>,
      ) => {
        for (const item of batch) {
          this.upsertStmt.run(item.key, item.elevationM, item.dataset, now);
        }
      },
    );

    const prepared = entries.map((e) => ({
      key: elevationGridKey(e.lat, e.lng),
      elevationM: e.elevationM,
      dataset: e.dataset,
    }));

    tx(prepared);

    for (const item of prepared) {
      this.rememberInMemory(item.key, {
        elevationM: item.elevationM,
        dataset: item.dataset,
        fetchedAt: now,
      });
    }
  }

  /**
   * Deletes TTL-expired entries and trims oldest rows if disk count exceeds maxDiskEntries.
   */
  prune(now = Date.now()): number {
    const cutoff = now - this.ttlMs;

    for (const [key, entry] of this.memory) {
      if (entry.fetchedAt < cutoff) {
        this.memory.delete(key);
      }
    }

    const tx = this.db.transaction(() => {
      const expiredChanges = this.deleteExpiredStmt.run(cutoff).changes;
      const total = this.count();
      let trimmedChanges = 0;

      if (total > this.maxDiskEntries) {
        const excess = total - this.maxDiskEntries;
        const evictedRows = this.selectOldestKeysStmt.all(excess);
        for (const row of evictedRows) {
          this.memory.delete(row.key);
        }
        trimmedChanges = this.deleteOldestStmt.run(excess).changes;
      }

      return expiredChanges + trimmedChanges;
    });

    return tx();
  }

  count(): number {
    return this.countStmt.get()?.cnt ?? 0;
  }

  close(): void {
    this.memory.clear();
    this.db.close();
  }
}
