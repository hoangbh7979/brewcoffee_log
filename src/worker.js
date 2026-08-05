import { ALLOWED_ORIGIN, HUB_NAME } from "./config.js";
import { clampInt } from "./format.js";
import { handleHttpIngest } from "./ingest.js";
import { corsHeaders, json, methodNotAllowed, text } from "./http.js";
import { isAllowedOrigin } from "./origin.js";
import { CLIENT_SCRIPT } from "./page-client.js";
import { PAGE_STYLES } from "./page-styles.js";
import { renderHomePage } from "./page.js";
import { getShotAnalysis, getShotsForDate, listShots } from "./shots.js";
import { handleWsIngest } from "./ws-ingest.js";

export { ShotHub } from "./shot-hub.js";

const SECURITY_HEADERS = {
  "Referrer-Policy": "no-referrer",
  "Permissions-Policy": "camera=(), microphone=(), geolocation=()",
  "X-Content-Type-Options": "nosniff",
  "X-Frame-Options": "DENY",
};

export default {
  async fetch(request, env) {
    try {
      return await routeRequest(request, env);
    } catch (error) {
      console.error("request_failed", error && error.stack ? error.stack : error);
      const origin = request.headers.get("Origin") || "";
      if (new URL(request.url).pathname.startsWith("/api/")) {
        return json({ ok: false, error: "internal_error" }, origin, ALLOWED_ORIGIN, 500);
      }
      return new Response("Service temporarily unavailable", { status: 500 });
    }
  },
};

async function routeRequest(request, env) {
  const url = new URL(request.url);
  const origin = request.headers.get("Origin") || "";

  if (request.method === "OPTIONS") {
    return new Response(null, {
      status: 204,
      headers: corsHeaders(origin, ALLOWED_ORIGIN),
    });
  }

  if (url.pathname === "/assets/app.css") {
    if (request.method !== "GET") return methodNotAllowed(["GET"]);
    return text(PAGE_STYLES, "text/css; charset=utf-8", 200, { "Cache-Control": "no-store, max-age=0" });
  }

  if (url.pathname === "/assets/app.js") {
    if (request.method !== "GET") return methodNotAllowed(["GET"]);
    return text(CLIENT_SCRIPT, "text/javascript; charset=utf-8", 200, { "Cache-Control": "no-store, max-age=0" });
  }

  if (url.pathname === "/") {
    if (request.method !== "GET" && request.method !== "HEAD") return methodNotAllowed(["GET", "HEAD"]);
    if (!env.DB) return new Response("DB not bound", { status: 500 });
    const view = url.searchParams.get("view") || "daily";
    const [shots, analysis] = await Promise.all([
      getShotsForDate(env, {
        date: url.searchParams.get("date") || "",
        bucket: url.searchParams.get("bucket") || "all",
      }),
      getShotAnalysis(env, {
        start: url.searchParams.get("analysis_start") || "",
        end: url.searchParams.get("analysis_end") || "",
        includePoints: view === "shots",
      }),
    ]);
    const nonce = crypto.randomUUID();
    return withSecurityHeaders(renderHomePage({
      shots,
      analysis,
      nonce,
      view,
    }), nonce);
  }

  if (url.pathname === "/api/ws") {
    if (request.method !== "GET") return methodNotAllowed(["GET"]);
    if (!env.SHOT_HUB) return new Response("Hub not bound", { status: 500 });
    if (!isAllowedOrigin(origin, ALLOWED_ORIGIN)) return new Response("Forbidden", { status: 403 });
    const id = env.SHOT_HUB.idFromName(HUB_NAME);
    return env.SHOT_HUB.get(id).fetch(request);
  }

  if (url.pathname === "/api/ws-ingest") {
    if (request.method !== "GET") return methodNotAllowed(["GET"]);
    return handleWsIngest(request, env);
  }

  if (url.pathname === "/api/health") {
    if (request.method !== "GET") return methodNotAllowed(["GET"]);
    return healthResponse(env, origin);
  }

  if (url.pathname === "/api/ingest") {
    if (request.method !== "POST") return methodNotAllowed(["POST"]);
    return handleHttpIngest(request, env, origin, ALLOWED_ORIGIN);
  }

  if (url.pathname === "/api/shots") {
    if (request.method !== "GET") return methodNotAllowed(["GET"]);
    if (!env.DB) return json({ ok: false, error: "db_not_bound" }, origin, ALLOWED_ORIGIN, 500);

    if (url.searchParams.has("limit")) {
      const limit = clampInt(url.searchParams.get("limit"), 1, 500, 500);
      const results = await listShots(env, limit);
      return json({ ok: true, data: results }, origin, ALLOWED_ORIGIN);
    }

    const result = await getShotsForDate(env, {
      date: url.searchParams.get("date") || "",
      bucket: url.searchParams.get("bucket") || "all",
    });
    return json({ ok: true, ...result }, origin, ALLOWED_ORIGIN);
  }

  if (url.pathname === "/api/analysis") {
    if (request.method !== "GET") return methodNotAllowed(["GET"]);
    if (!env.DB) return json({ ok: false, error: "db_not_bound" }, origin, ALLOWED_ORIGIN, 500);
    const result = await getShotAnalysis(env, {
      start: url.searchParams.get("start") || "",
      end: url.searchParams.get("end") || "",
      includePoints: url.searchParams.get("include_points") === "1",
    });
    return json({ ok: true, data: result }, origin, ALLOWED_ORIGIN);
  }

  return new Response("Not found", { status: 404 });
}

async function healthResponse(env, origin) {
  if (!env.DB || !env.SHOT_HUB) {
    return json({ ok: false, error: "binding_missing" }, origin, ALLOWED_ORIGIN, 503);
  }
  try {
    await env.DB.prepare("SELECT id FROM shots LIMIT 1").first();
    return json({ ok: true, ts: Date.now(), db: true, realtime: true }, origin, ALLOWED_ORIGIN);
  } catch {
    return json({ ok: false, error: "db_unavailable" }, origin, ALLOWED_ORIGIN, 503);
  }
}

function withSecurityHeaders(response, nonce) {
  const headers = new Headers(response.headers);
  Object.entries(SECURITY_HEADERS).forEach(([name, value]) => headers.set(name, value));
  headers.set(
    "Content-Security-Policy",
    `default-src 'self'; connect-src 'self' wss: ws:; img-src 'self' data:; style-src 'self' 'unsafe-inline'; script-src 'self' 'nonce-${nonce}'; font-src 'self'; object-src 'none'; base-uri 'self'; frame-ancestors 'none'; form-action 'self'`
  );
  return new Response(response.body, { status: response.status, headers });
}
