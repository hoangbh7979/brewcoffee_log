import test from "node:test";
import assert from "node:assert/strict";

import { renderHomePage } from "../src/page.js";

test("renderHomePage includes a paginated daily log, range controls, and an SSR trend chart", async () => {
  const rows = Array.from({ length: 12 }, (_, index) => ({
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
      total: 75,
      pagination: { page: 2, page_size: 12, page_count: 7 },
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
  assert.equal((tableBody[1].match(/class="brew-number"/g) || []).length, 12);
  assert.match(html, /value="2026-08-05"/);
  assert.match(html, /id="dateForm" method="get"/);
  assert.match(html, /name="date"/);
  assert.match(html, /href="\/\?date=2026-08-04&amp;bucket=all#shot-log"/);
  assert.match(html, /class="icon-button disabled" aria-disabled="true">›/);
  assert.match(html, /class="date-submit"/);
  assert.match(html, /getElementById\("dateForm"\)/);
  assert.doesNotMatch(html, /id="previousDay"|id="nextDay"/);
  assert.match(html, /id="pagination"/);
  assert.match(html, /id="pageSummary">Showing 13\u201324 of 75 shots/);
  assert.match(html, /class="page-number active" href="\/?date=2026-08-05&amp;page=2#shot-log" aria-current="page"/);
  assert.match(html, /href="\/?date=2026-08-05&amp;page=3#shot-log" aria-label="Next page"/);
  assert.match(html, /id="metricSelectedDate">05 Aug</);
  assert.match(html, /id="metricSelectedCount">75 shots</);
  assert.match(html, /id="metricDailyConsistency">32%/);
  assert.match(html, /id="heroConsistency">32%/);
  assert.match(html, /id="analysisStart"[^>]*value="2026-01-10"/);
  assert.match(html, /id="analysisEnd"[^>]*value="2026-08-05"/);
  assert.match(html, /id="analysisDateForm" method="get" action="\/#analysis"/);
  assert.match(html, /name="analysis_start"/);
  assert.match(html, /name="analysis_end"/);
  assert.match(html, /id="analysisAll"[^>]*href="\/?date=2026-08-05&amp;page=2&amp;analysis_all=1#analysis"/);
  assert.match(html, /id="bucketMix"/);
  assert.match(html, /class="donut-chart"/);
  assert.match(html, /class="chart-mode-link active"/);
  assert.match(html, /view=shots/);
  assert.match(html, /<path class="pie-slice"[^>]*fill="#899eb7"/);
  assert.match(html, /class="pie-slice-label"/);
  assert.ok(trendChart);
  assert.match(trendChart[1], /<svg /);
  assert.match(trendChart[1], /class="trend-line"/);
  assert.equal((trendChart[1].match(/class="trend-point"/g) || []).length, 3);
  assert.match(html, /<script nonce="test-nonce">/);
  assert.doesNotMatch(html, /src="\/assets\/app\.js/);
});

test("renderHomePage renders a fixed-axis shot timeline when selected", async () => {
  const response = renderHomePage({
    nonce: "test-nonce",
    view: "shots",
    shots: {
      data: [],
      total: 0,
      selected_date: "2026-08-04",
      bucket: "all",
      day_summary: { total: 2, consistent: 1, consistency_percent: 50 },
      window: { min_date: "2026-01-10", max_date: "2026-08-05" },
    },
    analysis: {
      total: 2,
      average_ms: 25_000,
      consistency_percent: 50,
      consistency_30d_percent: 50,
      buckets: { under20: 0, "20to25": 0, "25to28": 2, "28to30": 0, over30: 0 },
      daily: [{ date: "2026-08-04", count: 2, average_ms: 25_000, consistency_percent: 50 }],
      shot_points: [
        { created_at: Date.parse("2026-08-04T03:00:00Z"), shot_ms: 24_500 },
        { created_at: Date.parse("2026-08-04T04:00:00Z"), shot_ms: 25_500 },
      ],
      range: { start_date: "2026-08-04", end_date: "2026-08-04" },
      window: { min_date: "2026-01-10", max_date: "2026-08-05" },
    },
  });
  const html = await response.text();
  const scatterMarkup = html.match(/<div class="trend-chart" id="trendChart"[^>]*>([\s\S]*?)<\/div>/);
  assert.ok(scatterMarkup);
  assert.match(html, /class="chart-mode-link active"[^>]*view=shots/);
  assert.match(html, /class="scatter-chart"/);
  assert.match(html, />0s</);
  assert.match(html, />40s</);
  assert.match(html, />00:00</);
  assert.match(html, />23:30</);
  assert.equal((scatterMarkup[1].match(/class="scatter-point"/g) || []).length, 2);
});
