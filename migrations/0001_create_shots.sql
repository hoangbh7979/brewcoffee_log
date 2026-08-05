CREATE TABLE IF NOT EXISTS shots (
  id TEXT PRIMARY KEY NOT NULL,
  created_at INTEGER NOT NULL,
  shot_ms REAL NOT NULL CHECK (shot_ms > 0),
  brew_counter INTEGER,
  avg_ms REAL,
  payload TEXT NOT NULL DEFAULT '{}'
);

CREATE INDEX IF NOT EXISTS idx_shots_created_at
ON shots (created_at DESC, brew_counter DESC, id DESC);
