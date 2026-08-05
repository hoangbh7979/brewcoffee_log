import test from "node:test";
import assert from "node:assert/strict";

import { preparePayload } from "../src/ingest.js";

const NOW = Date.parse("2026-08-05T03:00:00Z");

test("preparePayload normalizes a valid device payload", () => {
  const result = preparePayload({
    shot_ms: "25250",
    epoch: NOW / 1000,
    brew_counter: 7,
    avg_ms: 24800,
  }, NOW);

  assert.equal(result.ok, true);
  assert.equal(result.shotMs, 25250);
  assert.equal(result.brewCounter, 7);
  assert.equal(result.createdAtMs, NOW);
});

test("preparePayload rejects invalid shapes and values", () => {
  assert.equal(preparePayload(null, NOW).error, "invalid_payload");
  assert.equal(preparePayload({ shot_ms: 0 }, NOW).error, "invalid_shot_ms");
  assert.equal(preparePayload({ shot_ms: 25000, brew_counter: 1.5 }, NOW).error, "invalid_brew_counter");
  assert.equal(
    preparePayload({ shot_ms: 25000, epoch: (NOW + 25 * 60 * 60 * 1000) / 1000 }, NOW).error,
    "invalid_timestamp"
  );
});
