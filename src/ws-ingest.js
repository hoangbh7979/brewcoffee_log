import { MAX_INGEST_BYTES } from "./config.js";
import { ingestPayload, readApiKey } from "./ingest.js";

export async function handleWsIngest(request, env) {
  const upgrade = (request.headers.get("Upgrade") || "").toLowerCase();
  if (upgrade !== "websocket") {
    return new Response("Expected websocket", { status: 426 });
  }
  if (!env.API_KEY || readApiKey(request) !== env.API_KEY) {
    return new Response("Unauthorized", { status: 401 });
  }
  if (!env.DB) {
    return new Response("DB not bound", { status: 500 });
  }

  const pair = new WebSocketPair();
  const client = pair[0];
  const server = pair[1];
  server.accept();

  let queue = Promise.resolve();
  server.addEventListener("message", (event) => {
    queue = queue.then(() => processMessage(server, event.data, env)).catch(() => {
      wsSendJson(server, { ok: false, error: "ingest_exception" });
    });
  });

  server.addEventListener("error", () => {
    try { server.close(1011, "error"); } catch {}
  });

  return new Response(null, { status: 101, webSocket: client });
}

async function processMessage(server, data, env) {
  const raw = typeof data === "string"
    ? data
    : data instanceof ArrayBuffer
      ? new TextDecoder().decode(data)
      : String(data || "");

  if (raw === "ping") {
    try { server.send("pong"); } catch {}
    return;
  }
  if (new TextEncoder().encode(raw).byteLength > MAX_INGEST_BYTES) {
    wsSendJson(server, { ok: false, error: "payload_too_large" });
    try { server.close(1009, "payload_too_large"); } catch {}
    return;
  }

  let payload;
  try {
    payload = JSON.parse(raw);
  } catch {
    wsSendJson(server, { ok: false, error: "invalid_json" });
    return;
  }

  const result = await ingestPayload(payload, env);
  wsSendJson(server, result.ok
    ? {
        ok: true,
        inserted: result.inserted,
        id: result.id || null,
        created_at: result.created_at || null,
      }
    : { ok: false, error: result.error || "ingest_failed" });
}

function wsSendJson(ws, object) {
  try { ws.send(JSON.stringify(object)); } catch {}
}
