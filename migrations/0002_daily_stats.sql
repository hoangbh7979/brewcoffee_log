CREATE TABLE IF NOT EXISTS shot_daily_stats (
  shot_date TEXT PRIMARY KEY NOT NULL,
  total INTEGER NOT NULL DEFAULT 0 CHECK (total >= 0),
  sum_ms REAL NOT NULL DEFAULT 0 CHECK (sum_ms >= 0),
  under20 INTEGER NOT NULL DEFAULT 0 CHECK (under20 >= 0),
  bucket_20_25 INTEGER NOT NULL DEFAULT 0 CHECK (bucket_20_25 >= 0),
  bucket_25_28 INTEGER NOT NULL DEFAULT 0 CHECK (bucket_25_28 >= 0),
  bucket_28_30 INTEGER NOT NULL DEFAULT 0 CHECK (bucket_28_30 >= 0),
  over30 INTEGER NOT NULL DEFAULT 0 CHECK (over30 >= 0),
  consistent INTEGER NOT NULL DEFAULT 0 CHECK (consistent >= 0),
  updated_at INTEGER NOT NULL
) WITHOUT ROWID;

INSERT INTO shot_daily_stats (
  shot_date,
  total,
  sum_ms,
  under20,
  bucket_20_25,
  bucket_25_28,
  bucket_28_30,
  over30,
  consistent,
  updated_at
)
SELECT
  date(created_at / 1000, 'unixepoch', '+7 hours') AS shot_date,
  COUNT(*) AS total,
  COALESCE(SUM(shot_ms), 0) AS sum_ms,
  COUNT(CASE WHEN shot_ms < 20000 THEN 1 END) AS under20,
  COUNT(CASE WHEN shot_ms >= 20000 AND shot_ms < 25000 THEN 1 END) AS bucket_20_25,
  COUNT(CASE WHEN shot_ms >= 25000 AND shot_ms < 28000 THEN 1 END) AS bucket_25_28,
  COUNT(CASE WHEN shot_ms >= 28000 AND shot_ms <= 30000 THEN 1 END) AS bucket_28_30,
  COUNT(CASE WHEN shot_ms > 30000 THEN 1 END) AS over30,
  COUNT(CASE WHEN shot_ms >= 24000 AND shot_ms <= 27000 THEN 1 END) AS consistent,
  MAX(created_at) AS updated_at
FROM shots
GROUP BY shot_date
ON CONFLICT(shot_date) DO UPDATE SET
  total = excluded.total,
  sum_ms = excluded.sum_ms,
  under20 = excluded.under20,
  bucket_20_25 = excluded.bucket_20_25,
  bucket_25_28 = excluded.bucket_25_28,
  bucket_28_30 = excluded.bucket_28_30,
  over30 = excluded.over30,
  consistent = excluded.consistent,
  updated_at = excluded.updated_at;

CREATE TRIGGER IF NOT EXISTS trg_shots_daily_stats_insert
AFTER INSERT ON shots
BEGIN
  INSERT INTO shot_daily_stats (
    shot_date,
    total,
    sum_ms,
    under20,
    bucket_20_25,
    bucket_25_28,
    bucket_28_30,
    over30,
    consistent,
    updated_at
  ) VALUES (
    date(NEW.created_at / 1000, 'unixepoch', '+7 hours'),
    1,
    NEW.shot_ms,
    CASE WHEN NEW.shot_ms < 20000 THEN 1 ELSE 0 END,
    CASE WHEN NEW.shot_ms >= 20000 AND NEW.shot_ms < 25000 THEN 1 ELSE 0 END,
    CASE WHEN NEW.shot_ms >= 25000 AND NEW.shot_ms < 28000 THEN 1 ELSE 0 END,
    CASE WHEN NEW.shot_ms >= 28000 AND NEW.shot_ms <= 30000 THEN 1 ELSE 0 END,
    CASE WHEN NEW.shot_ms > 30000 THEN 1 ELSE 0 END,
    CASE WHEN NEW.shot_ms >= 24000 AND NEW.shot_ms <= 27000 THEN 1 ELSE 0 END,
    NEW.created_at
  )
  ON CONFLICT(shot_date) DO UPDATE SET
    total = shot_daily_stats.total + 1,
    sum_ms = shot_daily_stats.sum_ms + excluded.sum_ms,
    under20 = shot_daily_stats.under20 + excluded.under20,
    bucket_20_25 = shot_daily_stats.bucket_20_25 + excluded.bucket_20_25,
    bucket_25_28 = shot_daily_stats.bucket_25_28 + excluded.bucket_25_28,
    bucket_28_30 = shot_daily_stats.bucket_28_30 + excluded.bucket_28_30,
    over30 = shot_daily_stats.over30 + excluded.over30,
    consistent = shot_daily_stats.consistent + excluded.consistent,
    updated_at = MAX(shot_daily_stats.updated_at, excluded.updated_at);
END;
