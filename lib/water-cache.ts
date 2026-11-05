import { neon } from '@neondatabase/serverless';
export type CacheEntry = { cache_key: string; payload: unknown; measured_at: string; fetched_at: string };
function database() {
  if (!process.env.DATABASE_URL) throw new Error('Snapshot storage is not configured');
  return neon(process.env.DATABASE_URL, {fetchOptions:{signal:AbortSignal.timeout(10000)}});
}
export async function readCache(): Promise<CacheEntry[]> {
  return await database()`SELECT cache_key, payload, measured_at, fetched_at FROM water_cache` as CacheEntry[];
}
export async function saveCache(key:string, payload:unknown, measuredAt:string) {
  return database()`INSERT INTO water_cache(cache_key,payload,measured_at,fetched_at)
    VALUES (${key},${JSON.stringify(payload)}::jsonb,${measuredAt}::timestamptz,now())
    ON CONFLICT(cache_key) DO UPDATE SET payload=EXCLUDED.payload, measured_at=EXCLUDED.measured_at, fetched_at=EXCLUDED.fetched_at
    WHERE water_cache.measured_at <= EXCLUDED.measured_at`;
}
