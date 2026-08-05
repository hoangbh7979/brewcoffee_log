import test from "node:test";
import assert from "node:assert/strict";

import { renderHomePage } from "../src/page.js";

test("renderHomePage includes all daily rows, range controls, and an SSR trend chart", async () => {
  const rows = Array.from({ length: 10 }, (_, index) => ({
    id: String(index),
    created_at: Date.parse("2026-08-05T03:00:00Z") + index * 1000,
    shot_ms: 20_000 + index * 1000,
    brew_counter: index + 1,
    avg_ms: 25_000,
  }));
  const response = renderHomePage({
    nonce: "test-nonce",
    shots: {
      data: rows,
      total: 10,
      selected_date: "2026-08-05",
      bucket: "all",
      day_summary: { total: 75, consistent: 24, consistency_percent: 32 },
      window: { min_date: "2026-01-10", max_date: "2026-08-05" },
    },
    analysis: {
      total: 2209,
      average_ms: 25_000,
      consistent: 800,
      consistency_percent: 36,
      consistency_30d_percent: 32,
      buckets: { under20: 500, "20to25": 450, "25to28": 600, "28to30": 400, over30: 259 },
      daily: [
        { date: "2026-01-10", count: 12, average_ms: 24_500, consistency_percent: 42 },
        { date: "2026-04-20", count: 15, average_ms: 25_500, consistency_percent: 47 },
        { date: "2026-08-05", count: 75, average_ms: 26_000, consistency_percent: 32 },
      ],
      range: { start_date: "2026-01-10", end_date: "2026-08-05" },
      window: { min_date: "2026-01-10", max_date: "2026-08-05" },
    },
  });
  const html = await response.text();
  const tableBody = html.match(/<tbody id="shotsTable">([\s\S]*?)<\/tbody>/);
  const trendChart = html.match(/<div class="trend-chart" id="trendChart"[^>]*>([\s\S]*?)<\/div>/);

  assert.ok(tableBody);
  assert.equal((tableBody[1].match(/class="brew-number"/g) || []).length, 10);
  assert.match(html, /value="2026-08-05"/);
  assert.doesNotMatch(html, /id="pagination"|id="pageSummary"/);
  assert.match(html, /id="metricSelected">75</);
  assert.match(html, /id="metricDailyConsistency">32%/);
  assert.match(html, /id="heroConsistency">32%/);
  assert.match(html, /id="analysisStart"[^>]*value="2026-01-10"/);
  assert.match(html, /id="analysisEnd"[^>]*value="2026-08-05"/);
  assert.ok(trendChart);
  assert.match(trendChart[1], /<svg /);
  assert.match(trendChart[1], /class="trend-line"/);
  assert.equal((trendChart[1].match(/class="trend-point"/g) || []).length, 3);
  assert.match(html, /<script nonce="test-nonce">/);
  assert.doesNotMatch(html, /src="\/assets\/app\.js/);
});
