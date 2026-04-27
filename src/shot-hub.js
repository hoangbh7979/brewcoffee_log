import { ALLOWED_ORIGIN } from "./config.js";
import { isAllowedOrigin } from "./origin.js";

export class ShotHub {
  constructor(state, env) {
    this.state = state;
    this.env = env;
    this.sockets = new Set();
  }

  async fetch(request) {
    if (request.headers.get("Upgrade") === "websocket") {
      const origin = request.headers.get("Origin") || "";
      if (!isAllowedOrigin(origin, ALLOWED_ORIGIN)) {
        return new Response("Forbidden", { status: 403 });
      }
      const pair = new WebSocketPair();
      const client = pair[0];
      const server = pair[1];
      server.accept();
      this.sockets.add(server);
      server.addEventListener("close", () => this.sockets.delete(server));
      server.addEventListener("error", () => this.sockets.delete(server));
      server.addEventListener("message", (event) => {
        if (event.data === "ping") {
          try { server.send("pong"); } catch (e) {}
        }
      });
      return new Response(null, { status: 101, webSocket: client });
    }

    const url = new URL(request.url);
    if (request.method === "POST" && url.pathname === "/broadcast") {
      const msg = await request.text();
      if (msg) this.broadcast(msg);
      return new Response("ok");
    }

    return new Response("Not found", { status: 404 });
  }

  broadcast(msg) {
    for (const ws of this.sockets) {
      try {
        if (ws.readyState === 1) ws.send(msg);
      } catch (e) {
        this.sockets.delete(ws);
      }
    }
  }
}
