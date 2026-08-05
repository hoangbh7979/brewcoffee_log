import test from "node:test";
import assert from "node:assert/strict";

import { renderHomePage } from "../src/page.js";

test("renderHomePage includes server-rendered rows and pagination", async () => {
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
      selected_date: "2026-08-05",
      bucket: "all",
      pagination: { page: 1, page_size: 10, total: 75, total_pages: 8 },
      window: { min_date: "2026-07-07", max_date: "2026-08-05" },
    },
    analysis: {
      total: 75,
      average_ms: 25_000,
      buckets: { under20: 5, "20to25": 20, "25to28": 30, "28to30": 15, over30: 5 },
      daily: [],
    },
  });
  const html = await response.text();
  const tableBody = html.match(/<tbody id="shotsTable">([\s\S]*?)<\/tbody>/);

  assert.ok(tableBody);
  assert.equal((tableBody[1].match(/class="brew-number"/g) || []).length, 10);
  assert.match(html, /value="2026-08-05"/);
  assert.match(html, /Page 1 of 8/);
  assert.match(html, /75 extractions/);
  assert.match(html, /<script nonce="test-nonce">/);
  assert.doesNotMatch(html, /src="\/assets\/app\.js/);
  assert.match(html, /href="\/\?date=2026-08-05&amp;page=2&amp;bucket=all#shot-log"/);
});
