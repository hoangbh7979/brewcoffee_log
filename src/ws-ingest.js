import { ingestPayload } from "./ingest.js";

export async function handleWsIngest(request, env) {
  const upgrade = (request.headers.get("Upgrade") || "").toLowerCase();
  if (upgrade !== "websocket") {
    return new Response("Expected websocket", { status: 426 });
  }

  const url = new URL(request.url);
  const key =
    request.headers.get("x-api-key") ||
    url.searchParams.get("key") ||
    "";
  if (!env.API_KEY || key !== env.API_KEY) {
    return new Response("unauthorized", { status: 401 });
  }
  if (!env.DB) {
    return new Response("DB not bound", { status: 500 });
  }

  const pair = new WebSocketPair();
  const client = pair[0];
  const server = pair[1];
  server.accept();

  server.addEventListener("message", (event) => {
    void (async () => {
      try {
        const raw =
          typeof event.data === "string"
            ? event.data
            : (event.data instanceof ArrayBuffer
              ? new TextDecoder().decode(event.data)
              : String(event.data || ""));
        if (raw === "ping") {
          try { server.send("pong"); } catch (e) {}
          return;
        }

        let payload = null;
        try {
          payload = JSON.parse(raw);
        } catch (e) {
          wsSendJson(server, { ok: false, error: "invalid_json" });
          return;
        }

        const result = await ingestPayload(payload, env);
        if (result && result.ok) {
          wsSendJson(server, { ok: true, id: result.id || null, created_at: result.created_at || null });
        } else {
          wsSendJson(server, { ok: false, error: result && result.error ? result.error : "ingest_failed" });
        }
      } catch (e) {
        wsSendJson(server, { ok: false, error: "ingest_exception" });
      }
    })();
  });

  server.addEventListener("error", () => {
    try { server.close(1011, "error"); } catch (e) {}
  });

  return new Response(null, { status: 101, webSocket: client });
}

function wsSendJson(ws, obj) {
  try {
    ws.send(JSON.stringify(obj));
  } catch (e) {
    // ignore ws send failures
  }
}
