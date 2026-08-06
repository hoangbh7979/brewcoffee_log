import test from "node:test";
import assert from "node:assert/strict";

import {
  bangkokDate,
  consistencyPercent,
  dateRangeForBangkokDay,
  getShotAnalysis,
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
    if (sql.includes("MIN(created_at)")) {
      return {
        min_created_at: Date.parse("2026-01-09T17:00:00Z"),
        max_created_at: Date.parse("2026-08-05T16:59:00Z"),
      };
    }
    if (sql.includes("AVG(shot_ms)") && sql.includes("AS under20")) return {};
    if (sql.includes("GROUP BY date")) return { results: [] };
    if (sql.includes("COUNT(*) AS total")) return { total: 0, consistent: 0 };
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
    if (sql.includes("MIN(created_at)")) {
      return {
        min_created_at: Date.parse("2026-06-30T17:00:00Z"),
        max_created_at: Date.parse("2026-08-05T16:59:00Z"),
      };
    }
    if (sql.includes("COUNT(CASE WHEN shot_ms >= 24000")) return { total: 31, consistent: 12 };
    if (sql.trim().startsWith("SELECT COUNT(*) AS total")) return { total: 25 };
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
  const summaryQuery = queryLog.find((entry) => entry.sql.includes("COUNT(CASE WHEN shot_ms >= 24000"));
  assert.match(rowQuery.sql, /shot_ms >= 20000 AND shot_ms < 25000/);
  assert.match(rowQuery.sql, /LIMIT \? OFFSET \?/);
  assert.deepEqual(rowQuery.bindings.slice(-2), [5, 5]);
  assert.match(summaryQuery.sql, /shot_ms >= 24000 AND shot_ms <= 27000/);
});

test("getShotAnalysis aggregates all D1 history while keeping 30-day consistency", async () => {
  const env = mockEnv((sql) => {
    if (sql.includes("MIN(created_at)")) {
      return {
        min_created_at: Date.parse("2026-01-09T17:00:00Z"),
        max_created_at: Date.parse("2026-08-05T16:59:00Z"),
      };
    }
    if (sql.includes("AVG(shot_ms)") && sql.includes("AS under20")) {
      return {
        total: 100,
        average_ms: 25_500,
        under20: 10,
        "20to25": 20,
        "25to28": 40,
        "28to30": 20,
        over30: 10,
        consistent: 35,
      };
    }
    if (sql.includes("GROUP BY date")) {
      return { results: [{ date: "2026-01-10", count: 10, average_ms: 25_000, consistent: 4 }] };
    }
    if (sql.includes("SELECT created_at, shot_ms")) {
      return { results: [{ created_at: Date.parse("2026-01-10T03:00:00Z"), shot_ms: 25_000 }] };
    }
    if (sql.includes("COUNT(*) AS total")) return { total: 20, consistent: 10 };
    throw new Error(`Unexpected query: ${sql}`);
  });

  const result = await getShotAnalysis(env, { now: NOW, allHistory: true, includePoints: true });
  assert.deepEqual(result.range, { start_date: "2026-01-10", end_date: "2026-08-05" });
  assert.equal(result.total, 100);
  assert.equal(result.consistency_percent, 35);
  assert.equal(result.consistency_30d_percent, 50);
  assert.equal(result.daily[0].consistency_percent, 40);
  assert.deepEqual(result.shot_points, [{ created_at: Date.parse("2026-01-10T03:00:00Z"), shot_ms: 25_000 }]);
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
