import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { DatabaseSync } from "node:sqlite";

const createShotsSql = readFileSync(new URL("../migrations/0001_create_shots.sql", import.meta.url), "utf8");
const dailyStatsSql = readFileSync(new URL("../migrations/0002_daily_stats.sql", import.meta.url), "utf8");

test("daily stats migration backfills raw shots and tracks new inserts atomically", () => {
  const db = new DatabaseSync(":memory:");
  db.exec(createShotsSql);
  const insert = db.prepare(
    `INSERT INTO shots (id, created_at, shot_ms, brew_counter, avg_ms, payload)
     VALUES (?, ?, ?, ?, ?, '{}')`
  );
  insert.run("shot-1", Date.parse("2026-08-04T18:00:00Z"), 19_000, 1, 19_000);
  insert.run("shot-2", Date.parse("2026-08-05T02:00:00Z"), 25_000, 2, 22_000);
  insert.run("shot-3", Date.parse("2026-08-05T18:00:00Z"), 31_000, 3, 25_000);

  db.exec(dailyStatsSql);

  assert.deepEqual(
    { ...db.prepare("SELECT * FROM shot_daily_stats WHERE shot_date = ?").get("2026-08-05") },
    {
      shot_date: "2026-08-05",
      total: 2,
      sum_ms: 44_000,
      under20: 1,
      bucket_20_25: 0,
      bucket_25_28: 1,
      bucket_28_30: 0,
      over30: 0,
      consistent: 1,
      updated_at: Date.parse("2026-08-05T02:00:00Z"),
    }
  );
  assert.equal(db.prepare("SELECT total FROM shot_daily_stats WHERE shot_date = ?").get("2026-08-06").total, 1);

  insert.run("shot-4", Date.parse("2026-08-05T03:00:00Z"), 29_000, 4, 24_000);
  const updated = db.prepare("SELECT * FROM shot_daily_stats WHERE shot_date = ?").get("2026-08-05");
  assert.equal(updated.total, 3);
  assert.equal(updated.sum_ms, 73_000);
  assert.equal(updated.bucket_28_30, 1);
  assert.equal(updated.consistent, 1);
  assert.equal(updated.updated_at, Date.parse("2026-08-05T03:00:00Z"));

  db.prepare(
    `INSERT OR IGNORE INTO shots (id, created_at, shot_ms, brew_counter, avg_ms, payload)
     VALUES (?, ?, ?, ?, ?, '{}')`
  ).run("shot-4", Date.parse("2026-08-05T03:00:00Z"), 29_000, 4, 24_000);
  assert.equal(db.prepare("SELECT total FROM shot_daily_stats WHERE shot_date = ?").get("2026-08-05").total, 3);
  db.close();
});
