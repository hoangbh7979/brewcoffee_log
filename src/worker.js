import { ALLOWED_ORIGIN, HUB_NAME } from "./config.js";
import { clampInt } from "./format.js";
import { handleHttpIngest } from "./ingest.js";
import { corsHeaders, json } from "./http.js";
import { isAllowedOrigin } from "./origin.js";
import { renderHomePage } from "./page.js";
import { listShots } from "./shots.js";
import { handleWsIngest } from "./ws-ingest.js";

export { ShotHub } from "./shot-hub.js";

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const origin = request.headers.get("Origin") || "";
    const allowedOrigin = ALLOWED_ORIGIN;

    if (request.method === "OPTIONS") {
      return new Response(null, {
        status: 204,
        headers: corsHeaders(origin, allowedOrigin),
      });
    }

    if (request.method === "GET" && url.pathname === "/api/ws") {
      if (!env.SHOT_HUB) {
        return new Response("Hub not bound", { status: 500 });
      }
      if (!isAllowedOrigin(origin, allowedOrigin)) {
        return new Response("Forbidden", { status: 403 });
      }
      const id = env.SHOT_HUB.idFromName(HUB_NAME);
      return env.SHOT_HUB.get(id).fetch(request);
    }

    if (request.method === "GET" && url.pathname === "/api/ws-ingest") {
      return handleWsIngest(request, env);
    }

    if (request.method === "GET" && url.pathname === "/") {
      if (!env.DB) {
        return new Response("DB not found", { status: 500 });
      }
      const limit = clampInt(url.searchParams.get("limit"), 1, 500, 500);
      const results = await listShots(env, limit);
      return renderHomePage(url, results);
    }

    if (request.method === "GET" && url.pathname === "/api/health") {
      return json({ ok: true, ts: Date.now() }, origin, allowedOrigin);
    }

    if (request.method === "POST" && url.pathname === "/api/ingest") {
      return handleHttpIngest(request, env, origin, allowedOrigin);
    }

    if (request.method === "GET" && url.pathname === "/api/shots") {
      if (!env.DB) {
        return json({ ok: false, error: "DB not bound" }, origin, allowedOrigin, 500);
      }
      const limit = clampInt(url.searchParams.get("limit"), 1, 500, 500);
      const results = await listShots(env, limit);
      return json({ ok: true, data: results }, origin, allowedOrigin);
    }

    return new Response("Not found", { status: 404 });
  },
};
