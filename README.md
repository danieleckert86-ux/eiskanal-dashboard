# Eiskanal Dashboard

Next.js dashboard for Abfluss Haunstetten (12003500), Wassertemperatur Augsburg Hochablass (12004002), Open-Meteo weather and the official Eiskanal webcam.

## Run

Use Node 24 and `npm ci`, then `npm run dev`. `npm test` checks parsing, primary/fallback selection, outage handling and German timestamp conversion. `npm run build` includes TypeScript checks.

## Water sources and persistence

- Flow: HND first, GKD current measurements as fallback.
- Temperature: NID first, GKD current measurements as fallback.
- HTML error pages (including HTTP 200 proxy errors) and empty tables are rejected.
- Each station's successful reading is stored independently in Neon. Set the server-only `DATABASE_URL` and apply `migrations/001_water_cache.sql` before deployment. No credentials belong in source control.
- Successful readings are reused for five minutes; older readings never overwrite newer snapshots. A source failure preserves the last snapshot and its original measurement time. Readings older than three hours are marked stale. The UI shows source, measurement time and age; stale readings do not drive the paddle check or clothing advice.
- Monthly/yearly GKD history is fetched separately through `/api/water-data?history=1` and persisted for a day. History failure cannot block live station data.
- `storageAvailable: false` signals a persistence problem without hiding independently available measurements.

The integration check in `tests/integration.mjs` accepts a test-branch database URL on stdin with terminal echo disabled. It runs a production server, verifies both live sources, persisted snapshots, simulated upstream failure from those snapshots, server-rendered labels and the separate history endpoint. Use an isolated Neon branch for this test.
