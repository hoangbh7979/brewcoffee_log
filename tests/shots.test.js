import test from "node:test";
import assert from "node:assert/strict";

import {
  bangkokDate,
  dateRangeForBangkokDay,
  historyWindow,
  isDateWithinHistory,
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
