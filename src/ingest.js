import { HUB_NAME } from "./config.js";
import { num } from "./format.js";
import { corsHeaders, json } from "./http.js";

export async function handleHttpIngest(request, env, origin, allowedOrigin) {
  const url = new URL(request.url);
  const key =
    request.headers.get("x-api-key") ||
    url.searchParams.get("key") ||
    "";

  if (!env.API_KEY || key !== env.API_KEY) {
    return json({ ok: false, error: "unauthorized" }, origin, allowedOrigin, 401);
  }

  let payload = null;
  try {
    payload = await request.json();
  } catch {
    return json({ ok: false, error: "invalid_json" }, origin, allowedOrigin, 400);
  }

  const shotMs = num(payload.shot_ms ?? payload.ms ?? payload.duration_ms);
  if (!Number.isFinite(shotMs)) {
    return json({ ok: false, error: "invalid_shot_ms" }, origin, allowedOrigin, 400);
  }
  await ingestPayload(payload, env);
  return new Response(null, {
    status: 204,
    headers: {
      ...corsHeaders(origin, allowedOrigin),
      "Connection": "keep-alive",
      "Keep-Alive": "timeout=30",
    },
  });
}

export async function ingestPayload(payload, env) {
  const prep = preparePayload(payload);
  if (!prep.ok) return prep;
  if (!env.DB) {
    return { ok: false, error: "DB not bound", status: 500 };
  }
  await processIngest(prep, env);
  return { ok: true, created_at: prep.createdAtMs, id: prep.id };
}

function preparePayload(payload) {
  const shotMs = num(payload.shot_ms ?? payload.ms ?? payload.duration_ms);
  const shotEpochSec = num(payload.epoch ?? payload.ts);
  const createdAtMs = shotEpochSec ? shotEpochSec * 1000 : Date.now();
  const brewCounter = num(payload.brew_counter ?? payload.brewCounter);
  const avgMs = num(payload.avg_ms ?? payload.avgMs);

  if (!Number.isFinite(shotMs)) {
    return { ok: false, error: "invalid_shot_ms", status: 400 };
  }

  const id = (Number.isFinite(brewCounter) && Number.isFinite(shotMs))
    ? `${brewCounter}:${shotMs}:${createdAtMs}`
    : String(createdAtMs);

  return {
    ok: true,
    id,
    createdAtMs,
    shotMs,
    brewCounter,
    avgMs,
    payloadJson: JSON.stringify(payload),
  };
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

async function processIngest(prep, env) {
  await insertShot(prep, env);
  if (env.SHOT_HUB) {
    try {
      await broadcastShot(buildHubMessage(prep), env);
    } catch (e) {
      // Keep ingest ACK successful after DB commit; realtime broadcast is best-effort.
      console.log("broadcast_failed", e && e.message ? e.message : e);
    }
  }
}

async function broadcastShot(hubMessage, env) {
  const hub = env.SHOT_HUB.get(env.SHOT_HUB.idFromName(HUB_NAME));
  await hub.fetch("https://hub/broadcast", {
    method: "POST",
    body: hubMessage,
  });
}

async function insertShot(prep, env) {
  await env.DB.prepare(
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
}
