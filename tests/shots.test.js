import test from "node:test";
import assert from "node:assert/strict";

import {
  bangkokDate,
  consistencyPercent,
  dateRangeForBangkokDay,
  getShotAnalysis,
  getShotBounds,
  getShotsForDate,
  historyWindow,
  isDateWithinHistory,
  resolveAnalysisRange,
} from "../src/shots.js";

const NOW = Date.parse("2026-08-05T03:00:00Z");

test("Bangkok date helpers use the configured UTC+7 boundary", () => {
  assert.equal(bangkokDate(NOW), "2026-08-05");
  const range = dateRangeForBangkokDay("2026-08-05");
  assert.equal(range.start, Date.parse("2026-08-04T17:00:00Z"));
  assert.equal(range.end, Date.parse("2026-08-05T17:00:00Z"));
});

test("history window includes exactly the latest 30 Bangkok dates", () => {
  const window = historyWindow(NOW);
  assert.equal(window.minDate, "2026-07-07");
  assert.equal(window.maxDate, "2026-08-05");
  assert.equal(isDateWithinHistory("2026-07-07", NOW), true);
  assert.equal(isDateWithinHistory("2026-07-06", NOW), false);
  assert.equal(isDateWithinHistory("2026-08-06", NOW), false);
});

test("consistency uses the inclusive 24 to 27 second range result", () => {
  assert.equal(consistencyPercent(24, 75), 32);
  assert.equal(consistencyPercent(0, 0), 0);
});

test("analysis range defaults to the current day and can expand to all D1", () => {
  const bounds = { minDate: "2026-01-10", maxDate: "2026-10-10" };
  const today = resolveAnalysisRange({}, bounds);
  assert.equal(today.startDate, "2026-10-10");
  assert.equal(today.endDate, "2026-10-10");

  const all = resolveAnalysisRange({ allHistory: true }, bounds);
  assert.equal(all.startDate, "2026-01-10");
  assert.equal(all.endDate, "2026-10-10");

  const reversed = resolveAnalysisRange({ start: "2026-07-20", end: "2026-03-01" }, bounds);
  assert.equal(reversed.startDate, "2026-03-01");
  assert.equal(reversed.endDate, "2026-07-20");
});

test("analysis opens the current Bangkok day even when its latest D1 record is older", async () => {
  const now = Date.parse("2026-10-10T03:00:00Z");
  const env = mockEnv((sql) => {
    if (sql.includes("ORDER BY created_at ASC")) return { created_at: Date.parse("2026-01-09T17:00:00Z") };
    if (sql.includes("ORDER BY created_at DESC")) return { created_at: Date.parse("2026-08-05T16:59:00Z") };
    if (sql.includes("FROM shot_daily_stats") && sql.includes("ORDER BY shot_date")) return { results: [] };
    if (sql.includes("SUM(consistent)")) return { total: 0, consistent: 0 };
    throw new Error(`Unexpected query: ${sql}`);
  });

  const result = await getShotAnalysis(env, { now });
  assert.deepEqual(result.range, { start_date: "2026-10-10", end_date: "2026-10-10" });
  assert.deepEqual(result.window, { min_date: "2026-01-10", max_date: "2026-10-10" });
});

test("getShotsForDate limits results to 5 rows and returns pagination metadata", async () => {
  const queryLog = [];
  const rows = Array.from({ length: 5 }, (_, index) => ({
    id: String(index + 1),
    created_at: Date.parse("2026-07-01T01:00:00Z") + index * 1000,
    shot_ms: 21_000 + index * 100,
  }));
  const env = mockEnv((sql, bindings, method) => {
    queryLog.push({ sql, bindings, method });
    if (sql.includes("ORDER BY created_at ASC")) return { created_at: Date.parse("2026-06-30T17:00:00Z") };
    if (sql.includes("ORDER BY created_at DESC") && sql.includes("LIMIT 1")) return { created_at: Date.parse("2026-08-05T16:59:00Z") };
    if (sql.includes("FROM shot_daily_stats")) {
      return {
        total: 31,
        consistent: 12,
        under20: 2,
        bucket_20_25: 25,
        bucket_25_28: 2,
        bucket_28_30: 1,
        over30: 1,
      };
    }
    if (sql.includes("SELECT id, created_at")) return { results: rows };
    throw new Error(`Unexpected query: ${sql}`);
  });

  const result = await getShotsForDate(env, {
    date: "2026-07-01",
    bucket: "20to25",
    page: 2,
    now: NOW,
  });

  assert.deepEqual(result.data, rows);
  assert.equal(result.total, 25);
  assert.deepEqual(result.pagination, { page: 2, page_size: 5, page_count: 5 });
  assert.equal(result.day_summary.total, 31);
  assert.equal(result.day_summary.consistency_percent, 39);
  assert.deepEqual(result.window, { min_date: "2026-07-01", max_date: "2026-08-05" });
  const rowQuery = queryLog.find((entry) => entry.sql.includes("SELECT id, created_at"));
  const summaryQuery = queryLog.find((entry) => entry.sql.includes("FROM shot_daily_stats"));
  assert.match(rowQuery.sql, /shot_ms >= 20000 AND shot_ms < 25000/);
  assert.match(rowQuery.sql, /LIMIT \? OFFSET \?/);
  assert.deepEqual(rowQuery.bindings.slice(-2), [5, 5]);
  assert.deepEqual(summaryQuery.bindings, ["2026-07-01"]);
});

test("daily shot log surfaces a missing aggregate migration", async () => {
  const queries = [];
  const env = mockEnv((sql) => {
    queries.push(sql);
    throw new Error("D1_ERROR: no such table: shot_daily_stats");
  });

  await assert.rejects(
    getShotsForDate(env, {
      date: "2026-08-05",
      now: NOW,
      bounds: { minDate: "2026-01-10", maxDate: "2026-08-05" },
    }),
    /no such table: shot_daily_stats/
  );
  assert.equal(queries.length, 1);
  assert.match(queries[0], /FROM shot_daily_stats/);
});

test("getShotAnalysis aggregates all D1 history while keeping 30-day consistency", async () => {
  const env = mockEnv((sql) => {
    if (sql.includes("ORDER BY created_at ASC") && sql.includes("LIMIT 1")) return { created_at: Date.parse("2026-01-09T17:00:00Z") };
    if (sql.includes("ORDER BY created_at DESC")) return { created_at: Date.parse("2026-08-05T16:59:00Z") };
    if (sql.includes("FROM shot_daily_stats") && sql.includes("ORDER BY shot_date")) {
      return { results: [
        { date: "2026-01-10", count: 10, sum_ms: 250_000, under20: 1, bucket_20_25: 2, bucket_25_28: 4, bucket_28_30: 2, over30: 1, consistent: 4 },
        { date: "2026-08-05", count: 90, sum_ms: 2_300_000, under20: 9, bucket_20_25: 18, bucket_25_28: 36, bucket_28_30: 18, over30: 9, consistent: 31 },
      ] };
    }
    if (sql.includes("SELECT id, created_at, shot_ms")) {
      return { results: [{ id: "shot-1", created_at: Date.parse("2026-01-10T03:00:00Z"), shot_ms: 25_000 }] };
    }
    if (sql.includes("SUM(consistent)")) return { total: 20, consistent: 10 };
    throw new Error(`Unexpected query: ${sql}`);
  });

  const result = await getShotAnalysis(env, { now: NOW, allHistory: true, includePoints: true });
  assert.deepEqual(result.range, { start_date: "2026-01-10", end_date: "2026-08-05" });
  assert.equal(result.total, 100);
  assert.equal(result.consistency_percent, 35);
  assert.equal(result.consistency_30d_percent, 50);
  assert.equal(result.daily[0].consistency_percent, 40);
  assert.equal(result.average_ms, 25_500);
  assert.deepEqual(result.shot_points, [{ id: "shot-1", created_at: Date.parse("2026-01-10T03:00:00Z"), shot_ms: 25_000 }]);
});

test("shot bounds use two index-friendly ordered lookups", async () => {
  const queries = [];
  const env = mockEnv((sql) => {
    queries.push(sql);
    if (sql.includes("ASC")) return { created_at: Date.parse("2026-01-09T17:00:00Z") };
    return { created_at: Date.parse("2026-08-05T16:59:00Z") };
  });

  const bounds = await getShotBounds(env, NOW);

  assert.deepEqual(bounds, { minDate: "2026-01-10", maxDate: "2026-08-05" });
  assert.equal(queries.length, 2);
  assert.ok(queries.every((sql) => sql.includes("ORDER BY created_at") && sql.includes("LIMIT 1")));
  assert.ok(queries.every((sql) => !sql.includes("MIN(") && !sql.includes("MAX(")));
});

test("analysis calculates exact averages and buckets from daily aggregates", async () => {
  const bounds = { minDate: "2026-08-04", maxDate: "2026-08-05" };
  const dailyRows = [
    { date: "2026-08-04", count: 2, sum_ms: 49_000, under20: 0, bucket_20_25: 1, bucket_25_28: 1, bucket_28_30: 0, over30: 0, consistent: 1 },
    { date: "2026-08-05", count: 3, sum_ms: 80_000, under20: 1, bucket_20_25: 0, bucket_25_28: 1, bucket_28_30: 0, over30: 1, consistent: 1 },
  ];
  const aggregateEnv = mockEnv((sql) => {
    if (sql.includes("ORDER BY shot_date")) return { results: dailyRows };
    if (sql.includes("SUM(consistent)")) return { total: 5, consistent: 2 };
    throw new Error(`Unexpected aggregate query: ${sql}`);
  });
  const options = { now: NOW, allHistory: true, bounds };

  const aggregate = await getShotAnalysis(aggregateEnv, options);

  assert.equal(aggregate.average_ms, 25_800);
  assert.deepEqual(aggregate.buckets, { under20: 1, "20to25": 1, "25to28": 2, "28to30": 0, over30: 1 });
});

test("analysis surfaces a missing aggregate migration", async () => {
  const queries = [];
  const env = mockEnv((sql) => {
    queries.push(sql);
    throw new Error("D1_ERROR: no such table: shot_daily_stats");
  });

  await assert.rejects(
    getShotAnalysis(env, {
      now: NOW,
      bounds: { minDate: "2026-08-04", maxDate: "2026-08-05" },
    }),
    /no such table: shot_daily_stats/
  );
  assert.ok(queries.length > 0);
  assert.ok(queries.every((sql) => sql.includes("FROM shot_daily_stats")));
});

function mockEnv(handler) {
  return {
    DB: {
      prepare(sql) {
        const statement = {
          bind(...bindings) {
            return {
              first: async () => handler(sql, bindings, "first"),
              all: async () => handler(sql, bindings, "all"),
            };
          },
          first: async () => handler(sql, [], "first"),
          all: async () => handler(sql, [], "all"),
        };
        return statement;
      },
    },
  };
}
