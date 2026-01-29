const ALLOWED_ORIGIN = "https://shotlog.barista-homelife.cloud";
const HUB_NAME = "global";
const DEV_ORIGINS = new Set(["http://localhost:8787", "http://127.0.0.1:8787"]);

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const origin = request.headers.get("Origin") || "";
    const allowedOrigin = ALLOWED_ORIGIN;

    // CORS preflight
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

    if (request.method === "GET" && url.pathname === "/") {
      if (!env.DB) {
        return new Response("DB not found", { status: 500 });
      }
      const limit = clampInt(url.searchParams.get("limit"), 1, 200, 300);
      const { results } = await env.DB.prepare(
        "SELECT id, created_at, shot_ms, device_id, shot_index FROM shots ORDER BY created_at DESC LIMIT ?"
      ).bind(limit).all();

      const rows = results.map(r => {
        const dt = new Date(r.created_at);
        const timeText = formatTime(dt); // HHhMM dd/mm/yy
        const shotText = formatShot(r.shot_ms); // 00.00s
        const dev = r.device_id || "";
        const idx = Number.isFinite(r.shot_index) ? `#${r.shot_index}` : "";
        return `<tr>
          <td>${idx}</td>
          <td>${timeText}</td>
          <td>${shotText}</td>
          <td>${escapeHtml(dev)}</td>
        </tr>`;
      }).join("");

      const html = `<!doctype html>
      <html>
      <head>
        <meta charset="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <title>Shot Log</title>
        <style>
          body { font-family: Arial, sans-serif; background:#0b0b0b; color:#eaeaea; margin:0; }
          header { padding:16px 20px; font-size:20px; font-weight:600; }
          table { width:100%; border-collapse: collapse; }
          th, td { padding:10px 12px; border-bottom:1px solid #222; text-align:left; }
          th { color:#7fdcff; font-weight:600; }
          tr:hover { background:#111; }
          .wrap { max-width:900px; margin:0 auto; padding:0 16px 24px; }
          .sub { color:#888; font-size:13px; margin-bottom:12px; }
        </style>
      </head>
      <body>
        <div class="wrap">
          <header>BREW RECORD</header>
          <div class="sub" id="status">Connecting...</div>
          <table>
            <thead>
              <tr><th>Brew number</th><th>Time</th><th>Shot</th><th>Device</th></tr>
            </thead>
            <tbody id="shots">
              ${rows || `<tr><td colspan="4">No data</td></tr>`}
            </tbody>
          </table>
        </div>

        <script>
          const MAX_ROWS = 300;
          const seen = new Set();
          const statusEl = document.getElementById('status');

          function setStatus(text) {
            if (statusEl) statusEl.textContent = text;
          }

          function renderRow(r) {
            const dt = new Date(r.created_at);
            const timeText = formatTime(dt);
            const shotText = formatShot(r.shot_ms);
            const dev = escapeHtml(r.device_id || '');
            const idx = Number.isFinite(r.shot_index) ? '#' + r.shot_index : '';
            return \`<tr><td>\${idx}</td><td>\${timeText}</td><td>\${shotText}</td><td>\${dev}</td></tr>\`;
          }

          function trimRows(tbody) {
            while (tbody.children.length > MAX_ROWS) {
              tbody.removeChild(tbody.lastElementChild);
            }
          }

          function prependRow(r) {
            const tbody = document.getElementById('shots');
            if (!tbody) return;
            if (r && r.id && seen.has(r.id)) return;
            if (r && r.id) seen.add(r.id);
            tbody.insertAdjacentHTML('afterbegin', renderRow(r));
            trimRows(tbody);
          }

          async function loadShots() {
            try {
              const res = await fetch('/api/shots?limit=300', { cache: 'no-store' });
              const json = await res.json();
              const tbody = document.getElementById('shots');
              const data = json.data || [];
              if (data.length === 0) {
                tbody.innerHTML = '<tr><td colspan="4">No data</td></tr>';
                return;
              }
              seen.clear();
              data.forEach(r => { if (r && r.id) seen.add(r.id); });
              tbody.innerHTML = data.map(r => renderRow(r)).join('');
              trimRows(tbody);
            } catch (e) {
              // ignore fetch errors (offline etc.)
            }
          }

          function formatShot(ms) {
            if (!Number.isFinite(ms)) return "--.--s";
            const cs = Math.floor(ms / 10);
            return (cs / 100).toFixed(2) + "s";
          }
          function pad2(n){ return n < 10 ? "0"+n : ""+n; }
          function formatTime(d){
            const hh = pad2(d.getHours());
            const mm = pad2(d.getMinutes());
            const dd = pad2(d.getDate());
            const mo = pad2(d.getMonth()+1);
            const yy = (""+d.getFullYear()).slice(-2);
            return \`\${hh}h\${mm} \${dd}/\${mo}/\${yy}\`;
          }
          function escapeHtml(s){
            return String(s || "")
              .replace(/&/g,"&amp;")
              .replace(/</g,"&lt;")
              .replace(/>/g,"&gt;");
          }

          function connectWs() {
            setStatus("Connecting...");
            const proto = location.protocol === "https:" ? "wss" : "ws";
            const ws = new WebSocket(\`\${proto}://\${location.host}/api/ws\`);
            ws.onopen = () => setStatus("Live");
            ws.onmessage = (ev) => {
              try {
                const data = JSON.parse(ev.data);
                if (data) prependRow(data);
              } catch (e) {
                // ignore bad payloads
              }
            };
            ws.onclose = () => {
              setStatus("Reconnecting...");
              setTimeout(connectWs, 2000);
            };
            ws.onerror = () => {
              ws.close();
            };
          }

          loadShots();
          connectWs();
        </script>
      </body>
      </html>`;
      return new Response(html, {
        headers: { "Content-Type": "text/html; charset=utf-8" }
      });
    }

    if (request.method === "GET" && url.pathname === "/api/health") {
      return json({ ok: true, ts: Date.now() }, origin, allowedOrigin);
    }

    if (request.method === "POST" && url.pathname === "/api/ingest") {
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
      const shotEpochSec = num(payload.epoch ?? payload.ts);
      const createdAtMs = shotEpochSec ? shotEpochSec * 1000 : Date.now();
      const deviceId = payload.device_id ? String(payload.device_id) : null;
      const shotIndex = num(payload.shot_index ?? payload.shotIndex ?? payload.index);
      const shotUid = num(payload.shot_uid ?? payload.shotUid ?? payload.uid);
      let id = payload.id ? String(payload.id) : null;
      if (!id) {
        if (deviceId && Number.isFinite(shotUid)) {
          id = `${deviceId}:${shotUid}`;
        } else if (deviceId && Number.isFinite(shotIndex) && Number.isFinite(shotEpochSec)) {
          id = `${deviceId}:${shotIndex}:${shotEpochSec}`;
        } else {
          id = crypto.randomUUID();
        }
      }

      if (env.DB) {
        const result = await env.DB.prepare(
          "INSERT OR IGNORE INTO shots (id, created_at, shot_ms, device_id, shot_index, payload) VALUES (?, ?, ?, ?, ?, ?)"
        ).bind(
          id,
          createdAtMs,
          shotMs,
          deviceId,
          shotIndex,
          JSON.stringify(payload)
        ).run();
        const inserted = !result || !result.meta || result.meta.changes > 0;
        if (inserted && env.SHOT_HUB && ctx) {
          const hub = env.SHOT_HUB.get(env.SHOT_HUB.idFromName(HUB_NAME));
          const msg = JSON.stringify({
            id,
            created_at: createdAtMs,
            shot_ms: shotMs,
            device_id: deviceId,
            shot_index: shotIndex,
          });
          ctx.waitUntil(
            hub.fetch("https://hub/broadcast", {
              method: "POST",
              body: msg,
            })
          );
        }
      } else {
        return json({ ok: false, error: "DB not bound" }, origin, allowedOrigin, 500);
      }

      return json({ ok: true, id, created_at: createdAtMs }, origin, allowedOrigin);
    }

    if (request.method === "GET" && url.pathname === "/api/shots") {
      if (!env.DB) {
        return json({ ok: false, error: "DB not bound" }, origin, allowedOrigin, 500);
      }
      const limit = clampInt(url.searchParams.get("limit"), 1, 200, 300);
      const { results } = await env.DB.prepare(
        "SELECT id, created_at, shot_ms, device_id, shot_index, payload FROM shots ORDER BY created_at DESC LIMIT ?"
      ).bind(limit).all();

      return json({ ok: true, data: results }, origin, allowedOrigin);
    }

    return new Response("Not found", { status: 404 });
  },
};

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

function corsHeaders(origin, allowedOrigin) {
  return {
    "Access-Control-Allow-Origin": origin === allowedOrigin ? origin : allowedOrigin,
    "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
    "Access-Control-Allow-Headers": "content-type,x-api-key",
  };
}

function json(obj, origin, allowedOrigin, status = 200) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: {
      "Content-Type": "application/json",
      ...corsHeaders(origin, allowedOrigin),
    },
  });
}

function isAllowedOrigin(origin, allowedOrigin) {
  if (!origin) return true;
  if (origin === allowedOrigin) return true;
  return DEV_ORIGINS.has(origin);
}

function num(v) {
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function clampInt(v, min, max, fallback) {
  const n = parseInt(v, 10);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, n));
}

function formatShot(ms) {
  if (!Number.isFinite(ms)) return "--.--s";
  const cs = Math.floor(ms / 10);
  return (cs / 100).toFixed(2) + "s";
}

function pad2(n) {
  return n < 10 ? "0" + n : "" + n;
}

function formatTime(d) {
  const hh = pad2(d.getHours());
  const mm = pad2(d.getMinutes());
  const dd = pad2(d.getDate());
  const mo = pad2(d.getMonth() + 1);
  const yy = ("" + d.getFullYear()).slice(-2);
  return `${hh}h${mm} ${dd}/${mo}/${yy}`;
}

function escapeHtml(s) {
  return String(s || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}
