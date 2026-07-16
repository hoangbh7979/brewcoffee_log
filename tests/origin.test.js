import test from "node:test";
import assert from "node:assert/strict";

import { ALLOWED_ORIGIN } from "../src/config.js";
import { isAllowedOrigin } from "../src/origin.js";

test("isAllowedOrigin accepts production and local development origins", () => {
  assert.equal(isAllowedOrigin("", ALLOWED_ORIGIN), true);
  assert.equal(isAllowedOrigin(ALLOWED_ORIGIN, ALLOWED_ORIGIN), true);
  assert.equal(isAllowedOrigin("http://localhost:8787", ALLOWED_ORIGIN), true);
  assert.equal(isAllowedOrigin("http://127.0.0.1:8787", ALLOWED_ORIGIN), true);
});

test("isAllowedOrigin rejects unrelated origins", () => {
  assert.equal(isAllowedOrigin("https://example.com", ALLOWED_ORIGIN), false);
});
