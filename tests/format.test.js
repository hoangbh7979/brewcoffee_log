import test from "node:test";
import assert from "node:assert/strict";

import { clampInt, formatShot, num, pad2 } from "../src/format.js";

test("num returns finite numbers and rejects invalid input", () => {
  assert.equal(num("25.5"), 25.5);
  assert.equal(num(Number.POSITIVE_INFINITY), null);
  assert.equal(num("not-a-number"), null);
});

test("clampInt parses, clamps, and falls back", () => {
  assert.equal(clampInt("25", 1, 500, 100), 25);
  assert.equal(clampInt("0", 1, 500, 100), 1);
  assert.equal(clampInt("999", 1, 500, 100), 500);
  assert.equal(clampInt(undefined, 1, 500, 100), 100);
});

test("formatShot formats milliseconds without rounding up", () => {
  assert.equal(formatShot(25_000), "25.00s");
  assert.equal(formatShot(25_009), "25.00s");
  assert.equal(formatShot(Number.NaN), "--.--s");
});

test("pad2 pads single-digit values", () => {
  assert.equal(pad2(7), "07");
  assert.equal(pad2(12), "12");
});
