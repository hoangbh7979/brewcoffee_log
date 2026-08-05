import { HUB_NAME, MAX_INGEST_BYTES, MAX_SHOT_MS } from "./config.js";
import { corsHeaders, json } from "./http.js";

const MAX_FUTURE_DRIFT_MS = 24 * 60 * 60 * 1000;

export function readApiKey(request) {
  const url = new URL(request.url);
  return request.headers.get("x-api-key") || url.searchParams.get("key") || "";
}

export async function handleHttpIngest(request, env, origin, allowedOrigin) {
  if (!env.API_KEY || readApiKey(request) !== env.API_KEY) {
    return json({ ok: false, error: "unauthorized" }, origin, allowedOrigin, 401);
  }

  const declaredLength = Number(request.headers.get("content-length"));
  if (Number.isFinite(declaredLength) && declaredLength > MAX_INGEST_BYTES) {
    return json({ ok: false, error: "payload_too_large" }, origin, allowedOrigin, 413);
  }

  let payload;
  try {
    payload = await request.json();
  } catch {
    return json({ ok: false, error: "invalid_json" }, origin, allowedOrigin, 400);
  }

  const result = await ingestPayload(payload, env);
  if (!result.ok) {
    return json(
      { ok: false, error: result.error },
      origin,
      allowedOrigin,
      result.status || 400
    );
  }

  return new Response(null, {
    status: 204,
    headers: corsHeaders(origin, allowedOrigin),
  });
}

export async function ingestPayload(payload, env, now = Date.now()) {
  const prep = preparePayload(payload, now);
  if (!prep.ok) return prep;
  if (!env.DB) return { ok: false, error: "db_not_bound", status: 500 };

  const inserted = await insertShot(prep, env);
  if (inserted && env.SHOT_HUB) {
    try {
      await broadcastShot(buildHubMessage(prep), env);
    } catch (error) {
      console.log("broadcast_failed", error && error.message ? error.message : error);
    }
  }

  return {
    ok: true,
    inserted,
    created_at: prep.createdAtMs,
    id: prep.id,
  };
}

export function preparePayload(payload, now = Date.now()) {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    return { ok: false, error: "invalid_payload", status: 400 };
  }

  const shotMs = finiteNumber(payload.shot_ms ?? payload.ms ?? payload.duration_ms);
  const shotEpochSec = finiteNumber(payload.epoch ?? payload.ts);
  const brewCounter = optionalNumber(payload.brew_counter ?? payload.brewCounter);
  const avgMs = optionalNumber(payload.avg_ms ?? payload.avgMs);

  if (shotMs === null || shotMs <= 0 || shotMs > MAX_SHOT_MS) {
    return { ok: false, error: "invalid_shot_ms", status: 400 };
  }
  if (brewCounter !== null && (!Number.isInteger(brewCounter) || brewCounter < 0)) {
    return { ok: false, error: "invalid_brew_counter", status: 400 };
  }
  if (avgMs !== null && (avgMs < 0 || avgMs > MAX_SHOT_MS)) {
    return { ok: false, error: "invalid_avg_ms", status: 400 };
  }

  const createdAtMs = shotEpochSec === null ? now : shotEpochSec * 1000;
  if (
    !Number.isFinite(createdAtMs) ||
    createdAtMs < 0 ||
    createdAtMs > now + MAX_FUTURE_DRIFT_MS ||
    !Number.isFinite(new Date(createdAtMs).getTime())
  ) {
    return { ok: false, error: "invalid_timestamp", status: 400 };
  }

  let payloadJson;
  try {
    payloadJson = JSON.stringify(payload);
  } catch {
    return { ok: false, error: "invalid_payload", status: 400 };
  }
  if (new TextEncoder().encode(payloadJson).byteLength > MAX_INGEST_BYTES) {
    return { ok: false, error: "payload_too_large", status: 413 };
  }

  const id = Number.isFinite(brewCounter)
    ? `${brewCounter}:${shotMs}:${createdAtMs}`
    : `${createdAtMs}:${shotMs}`;

  return {
    ok: true,
    id,
    createdAtMs,
    shotMs,
    brewCounter,
    avgMs,
    payloadJson,
  };
}

function finiteNumber(value) {
  if (value === "" || value === null || value === undefined || typeof value === "boolean") {
    return null;
  }
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function optionalNumber(value) {
  if (value === null || value === undefined || value === "") return null;
  return finiteNumber(value);
}

function buildHubMessage(prep) {
  return JSON.stringify({
    id: prep.id,
    created_at: prep.createdAtMs,
    shot_ms: prep.shotMs,
    brew_counter: prep.brewCounter,
    avg_ms: prep.avgMs,
  });
}

async function broadcastShot(hubMessage, env) {
  const hub = env.SHOT_HUB.get(env.SHOT_HUB.idFromName(HUB_NAME));
  const response = await hub.fetch("https://hub/broadcast", {
    method: "POST",
    body: hubMessage,
  });
  if (!response.ok) throw new Error(`hub_broadcast_${response.status}`);
}

async function insertShot(prep, env) {
  const result = await env.DB.prepare(
    `INSERT OR IGNORE INTO shots (id, created_at, shot_ms, brew_counter, avg_ms, payload)
     VALUES (?, ?, ?, ?, ?, ?)`
  ).bind(
    prep.id,
    prep.createdAtMs,
    prep.shotMs,
    prep.brewCounter,
    prep.avgMs,
    prep.payloadJson
  ).run();
  return Boolean(result && result.meta && result.meta.changes > 0);
}
