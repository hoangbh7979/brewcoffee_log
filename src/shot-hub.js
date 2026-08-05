import { ALLOWED_ORIGIN } from "./config.js";
import { isAllowedOrigin } from "./origin.js";

export class ShotHub {
  constructor(ctx, env) {
    this.ctx = ctx;
    this.env = env;
  }

  async fetch(request) {
    const upgrade = (request.headers.get("Upgrade") || "").toLowerCase();
    if (upgrade === "websocket") {
      const origin = request.headers.get("Origin") || "";
      if (!isAllowedOrigin(origin, ALLOWED_ORIGIN)) {
        return new Response("Forbidden", { status: 403 });
      }

      const pair = new WebSocketPair();
      const client = pair[0];
      const server = pair[1];
      this.ctx.acceptWebSocket(server);
      return new Response(null, { status: 101, webSocket: client });
    }

    const url = new URL(request.url);
    if (request.method === "POST" && url.pathname === "/broadcast") {
      const message = await request.text();
      if (message) this.broadcast(message);
      return new Response(null, { status: 204 });
    }

    return new Response("Not found", { status: 404 });
  }

  webSocketMessage(ws, message) {
    if (message === "ping") {
      try { ws.send("pong"); } catch {}
    }
  }

  webSocketClose(ws, code, reason) {
    try { ws.close(code, reason); } catch {}
  }

  webSocketError(ws) {
    try { ws.close(1011, "error"); } catch {}
  }

  broadcast(message) {
    for (const ws of this.ctx.getWebSockets()) {
      try {
        if (ws.readyState === WebSocket.OPEN) ws.send(message);
      } catch {
        try { ws.close(1011, "broadcast_failed"); } catch {}
      }
    }
  }
}
