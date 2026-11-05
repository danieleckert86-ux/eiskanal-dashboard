CREATE TABLE IF NOT EXISTS water_cache (
  cache_key text PRIMARY KEY,
  payload jsonb NOT NULL,
  measured_at timestamptz NOT NULL,
  fetched_at timestamptz NOT NULL DEFAULT now()
);
