const ALLOWED_ORIGIN = "https://shotlog.barista-homelife.cloud";
const HUB_NAME = "global";
const DEV_ORIGINS = new Set(["http://localhost:8787", "http://127.0.0.1:8787"]);

const CLIENT_SCRIPT = `
          const MAX_ROWS = 300;
          const MAX_POINTS = 200;
          const seen = new Set();
          const statusEl = document.getElementById('status');
          const brewEl = document.getElementById('brewCounter');
          const avgEl = document.getElementById('avgBrew');
          const mainView = document.getElementById('mainView');
          const analysisView = document.getElementById('analysisView');
          const analysisBtn = document.getElementById('analysisBtn');
          const chartCanvas = document.getElementById('chart');
          const chartScroll = document.getElementById('chartScroll');
          const brewStartEl = document.getElementById('brewStart');
          const dayFilterEl = document.getElementById('dayFilter');
          let chartCtx = chartCanvas ? chartCanvas.getContext('2d') : null;
          let chartPoints = [];
          let chartRaw = [];
          let chartRawIds = new Set();
          let chartScheduled = false;
          let chartRawMaxIndex = 0;
          let chartMinX = 0;
          let chartMaxX = 0;
          let chartDayKeys = [];
          const ENABLE_ANALYSIS = !!analysisBtn && !!chartCanvas;

          function setStatus(text) {
            if (statusEl) statusEl.textContent = text;
          }

          window.onerror = (msg, src, line, col) => {
            setStatus("JS error: " + msg + " @" + line);
          };
          window.onunhandledrejection = (ev) => {
            const msg = ev && ev.reason ? String(ev.reason) : "Promise error";
            setStatus("JS error: " + msg);
          };

          function showMain() {
            if (mainView) mainView.classList.remove('hidden');
            if (analysisView) analysisView.classList.add('hidden');
            if (analysisBtn) analysisBtn.textContent = "See Detailed Analysis";
          }

          function showAnalysis() {
            if (!ENABLE_ANALYSIS) return;
            if (mainView) mainView.classList.add('hidden');
            if (analysisView) analysisView.classList.remove('hidden');
            if (analysisBtn) analysisBtn.textContent = "Back to main";
            resizeChart();
            applyChartFilters();
          }

          function toggleAnalysis() {
            if (!ENABLE_ANALYSIS) return;
            if (analysisView && !analysisView.classList.contains('hidden')) {
              showMain();
            } else {
              showAnalysis();
            }
          }

          if (analysisBtn) analysisBtn.addEventListener('click', toggleAnalysis);
          if (brewStartEl) brewStartEl.addEventListener('input', applyChartFilters);
          if (dayFilterEl) dayFilterEl.addEventListener('change', applyChartFilters);

          function updateStats(brew, avg) {
            const hasBrew = Number.isFinite(brew);
            if (brewEl) {
              brewEl.textContent = "Brew counter: " + (hasBrew ? Math.trunc(brew) : "--");
            }
            if (avgEl) {
              const showAvg = hasBrew && brew > 0 && Number.isFinite(avg);
              avgEl.textContent = "Avg Brew Time: " + (showAvg ? formatShot(avg) : "--.--s");
            }
          }

          function extractStats(r) {
            let brew = null;
            let avg = null;
            if (r) {
              if (Number.isFinite(r.brew_counter)) brew = r.brew_counter;
              if (Number.isFinite(r.avg_ms)) avg = r.avg_ms;
              if ((brew === null || avg === null) && r.payload) {
                try {
                  const p = typeof r.payload === "string" ? JSON.parse(r.payload) : r.payload;
                  if (brew === null && Number.isFinite(p.brew_counter)) brew = p.brew_counter;
                  if (avg === null && Number.isFinite(p.avg_ms)) avg = p.avg_ms;
                } catch (e) {
                  // ignore invalid payload
                }
              }
            }
            updateStats(brew, avg);
          }

          function renderRow(r) {
            const dt = new Date(r.created_at);
            const timeText = formatTime(dt);
            const shotText = formatShot(r.shot_ms);
            const idx = Number.isFinite(r.shot_index) ? "#" + r.shot_index : "";
            return "<tr><td>" + idx + "</td><td>" + timeText + "</td><td>" + shotText + "</td></tr>";
          }

          function trimRows(tbody) {
            while (tbody.children.length > MAX_ROWS) {
              tbody.removeChild(tbody.lastElementChild);
            }
          }

          function toPoint(r) {
            if (!r) return null;
            const x = Number(r.shot_index);
            const y = Number(r.shot_ms);
            if (!Number.isFinite(x) || !Number.isFinite(y)) return null;
            const ySec = Math.floor(y / 10) / 100;
            const dt = r.created_at ? new Date(r.created_at) : null;
            const ts = dt ? dt.getTime() : Date.now();
            const dayKey = dt
              ? ("" + dt.getFullYear() + "-" + pad2(dt.getMonth() + 1) + "-" + pad2(dt.getDate()))
              : null;
            return { id: r.id || ("" + x + ":" + y), x, y: ySec, ts, dayKey };
          }

          function resetChart() {
            chartPoints = [];
            chartRaw = [];
            chartRawIds = new Set();
            chartRawMaxIndex = 0;
            chartDayKeys = [];
            applyChartFilters();
          }

          function filterToLatestSession(data) {
            const idx = data.findIndex(r => Number(r.shot_index) === 1);
            if (idx >= 0) return data.slice(0, idx + 1);
            return data;
          }

          function setChartFromData(data) {
            if (!ENABLE_ANALYSIS) return;
            const sessionData = filterToLatestSession(data);
            const pts = [];
            const ids = new Set();
            sessionData.forEach(r => {
              const pt = toPoint(r);
              if (!pt || ids.has(pt.id)) return;
              ids.add(pt.id);
              pts.push(pt);
            });
            pts.sort((a, b) => a.x - b.x);
            const trimmed = pts.length > MAX_POINTS ? pts.slice(pts.length - MAX_POINTS) : pts;
            chartRaw = trimmed;
            chartRawIds = new Set(trimmed.map(p => p.id));
            chartRawMaxIndex = trimmed.reduce((m, p) => (p.x > m ? p.x : m), 0);
            updateDayOptions();
            applyChartFilters();
          }

          function addChartPoint(r) {
            if (!ENABLE_ANALYSIS) return;
            const idx = Number(r && r.shot_index);
            if (Number.isFinite(idx)) {
              if (idx === 1 || (chartRawMaxIndex > 0 && idx < chartRawMaxIndex)) {
                resetChart();
              }
            }
            const pt = toPoint(r);
            if (!pt || chartRawIds.has(pt.id)) return;
            chartRawIds.add(pt.id);
            chartRaw.push(pt);
            chartRaw.sort((a, b) => a.x - b.x);
            if (chartRaw.length > MAX_POINTS) {
              const excess = chartRaw.length - MAX_POINTS;
              const removed = chartRaw.splice(0, excess);
              removed.forEach(p => chartRawIds.delete(p.id));
            }
            if (pt.x > chartRawMaxIndex) chartRawMaxIndex = pt.x;
            updateDayOptions();
            applyChartFilters();
          }

          function prependRow(r) {
            const tbody = document.getElementById('shots');
            if (!tbody) return;
            if (r && r.id && seen.has(r.id)) return;
            if (r && r.id) seen.add(r.id);
            tbody.insertAdjacentHTML('afterbegin', renderRow(r));
            trimRows(tbody);
            extractStats(r);
            addChartPoint(r);
          }

          async function loadShots() {
            try {
              const res = await fetch('/api/shots?limit=300', { cache: 'no-store' });
              const json = await res.json();
              const tbody = document.getElementById('shots');
              const data = json.data || [];
              if (data.length === 0) {
                tbody.innerHTML = '<tr><td colspan="3">No data</td></tr>';
                updateStats(null, null);
                setChartFromData([]);
                return;
              }
              seen.clear();
              data.forEach(r => { if (r && r.id) seen.add(r.id); });
              tbody.innerHTML = data.map(r => renderRow(r)).join('');
              trimRows(tbody);
              extractStats(data[0]);
              setChartFromData(data);
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
            return hh + "h" + mm + " " + dd + "/" + mo + "/" + yy;
          }
          function escapeHtml(s){
            return String(s || "")
              .replace(/&/g,"&amp;")
              .replace(/</g,"&lt;")
              .replace(/>/g,"&gt;");
          }

          function scheduleChart() {
            if (!ENABLE_ANALYSIS) return;
            if (!chartCanvas || !chartCtx) return;
            if (chartScheduled) return;
            chartScheduled = true;
            requestAnimationFrame(() => {
              chartScheduled = false;
              drawChart();
            });
          }

          function resizeChart() {
            if (!ENABLE_ANALYSIS) return;
            if (!chartCanvas || !chartCtx) return;
            const dpr = window.devicePixelRatio || 1;
            const w = chartCanvas.clientWidth || 0;
            const h = chartCanvas.clientHeight || 0;
            if (w === 0 || h === 0) return;
            chartCanvas.width = Math.floor(w * dpr);
            chartCanvas.height = Math.floor(h * dpr);
            chartCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
          }

          function getMinBrew() {
            const raw = brewStartEl ? parseInt(brewStartEl.value || "0", 10) : 0;
            return Number.isFinite(raw) && raw >= 0 ? raw : 0;
          }

          function getDayFilter() {
            if (!dayFilterEl) return "all";
            return dayFilterEl.value || "all";
          }

          function updateDayOptions() {
            if (!dayFilterEl) return;
            const keys = new Set();
            chartRaw.forEach(p => { if (p.dayKey) keys.add(p.dayKey); });
            const sorted = Array.from(keys).sort((a, b) => b.localeCompare(a));
            chartDayKeys = sorted.slice(0, 7);
            const current = dayFilterEl.value || "all";
            dayFilterEl.innerHTML = "";
            const optAll = document.createElement("option");
            optAll.value = "all";
            optAll.textContent = "All";
            dayFilterEl.appendChild(optAll);
            chartDayKeys.forEach(k => {
              const opt = document.createElement("option");
              opt.value = k;
              const parts = k.split("-");
              opt.textContent = parts.length === 3 ? (parts[2] + "/" + parts[1] + "/" + parts[0]) : k;
              dayFilterEl.appendChild(opt);
            });
            const keep = chartDayKeys.includes(current) ? current : "all";
            dayFilterEl.value = keep;
          }

          function updateChartSize() {
            if (!ENABLE_ANALYSIS || !chartCanvas || !chartScroll) return;
            const containerW = chartScroll.clientWidth || 0;
            const span = Math.max(1, (chartMaxX - chartMinX + 1));
            const spacing = 30;
            const desired = span * spacing + 70;
            const width = Math.max(containerW, desired);
            chartCanvas.style.width = width + "px";
            chartCanvas.style.height = "320px";
            resizeChart();
          }

          function applyChartFilters() {
            if (!ENABLE_ANALYSIS) return;
            const minBrew = getMinBrew();
            const dayKey = getDayFilter();
            const useDay = dayKey !== "all";
            if (brewStartEl) brewStartEl.disabled = useDay;
            let filtered = chartRaw;
            if (useDay) {
              filtered = chartRaw.filter(pt => pt.dayKey === dayKey);
              filtered.sort((a, b) => (b.ts - a.ts) || (b.x - a.x));
              chartPoints = filtered.map((p, i) => ({
                ...p,
                plotX: i,
                label: p.x
              }));
              chartMinX = 0;
              chartMaxX = Math.max(1, chartPoints.length - 1);
            } else {
              filtered = chartRaw.filter(pt => pt.x >= minBrew);
              filtered.sort((a, b) => a.x - b.x);
              chartPoints = filtered;
              if (chartPoints.length === 0) {
                chartMinX = minBrew;
                chartMaxX = minBrew + 1;
              } else {
                const minPointX = chartPoints[0].x;
                chartMinX = Math.min(minBrew, minPointX);
                chartMaxX = chartPoints.reduce((m, p) => (p.x > m ? p.x : m), chartMinX);
              }
            }
            updateChartSize();
            if (analysisView && !analysisView.classList.contains('hidden')) {
              scheduleChart();
            }
          }

          function drawChart() {
            if (!ENABLE_ANALYSIS) return;
            if (!chartCanvas || !chartCtx) return;
            const w = chartCanvas.clientWidth || 0;
            const h = chartCanvas.clientHeight || 0;
            if (w === 0 || h === 0) return;
            chartCtx.clearRect(0, 0, w, h);
            chartCtx.fillStyle = "#0f1113";
            chartCtx.fillRect(0, 0, w, h);

            if (chartPoints.length === 0) {
              chartCtx.fillStyle = "#7a8a99";
              chartCtx.font = "12px Arial, sans-serif";
              chartCtx.fillText("No data yet", 12, 20);
              return;
            }

            let minX = chartMinX;
            let maxX = chartMaxX;
            let maxY = chartPoints[0].y;
            for (const p of chartPoints) {
              const px = Number.isFinite(p.plotX) ? p.plotX : p.x;
              if (px > maxX) maxX = px;
              if (p.y > maxY) maxY = p.y;
            }
            if (!Number.isFinite(minX)) minX = 0;
            if (!Number.isFinite(maxX)) maxX = minX + 1;
            if (minX === maxX) { maxX = minX + 1; }
            const yStep = 2;
            let yMax = Math.ceil(maxY / yStep) * yStep;
            if (yMax < yStep) yMax = yStep;
            const yMin = 0;

            const padL = 50;
            const padR = 16;
            const padT = 16;
            const padB = 32;
            const plotW = w - padL - padR;
            const plotH = h - padT - padB;

            function xFor(x) {
              return padL + ((x - minX) / (maxX - minX)) * plotW;
            }
            function yFor(y) {
              return padT + (1 - (y - yMin) / (yMax - yMin)) * plotH;
            }

            // grid
            chartCtx.strokeStyle = "#1f2a33";
            chartCtx.lineWidth = 1;
            const gridY = Math.round((yMax - yMin) / yStep);
            for (let i = 0; i <= gridY; i++) {
              const yVal = yMin + i * yStep;
              const y = yFor(yVal);
              chartCtx.beginPath();
              chartCtx.moveTo(padL, y);
              chartCtx.lineTo(padL + plotW, y);
              chartCtx.stroke();
            }

            // x grid (step 1)
            chartCtx.strokeStyle = "#151d24";
            for (let xVal = minX; xVal <= maxX; xVal += 1) {
              const x = xFor(xVal);
              chartCtx.beginPath();
              chartCtx.moveTo(x, padT);
              chartCtx.lineTo(x, padT + plotH);
              chartCtx.stroke();
            }

            // line
            chartCtx.strokeStyle = "#7fdcff";
            chartCtx.lineWidth = 2;
            chartCtx.beginPath();
            chartPoints.forEach((p, i) => {
              const px = Number.isFinite(p.plotX) ? p.plotX : p.x;
              const x = xFor(px);
              const y = yFor(p.y);
              if (i === 0) chartCtx.moveTo(x, y);
              else chartCtx.lineTo(x, y);
            });
            chartCtx.stroke();

            // points
            chartCtx.fillStyle = "#7fdcff";
            for (const p of chartPoints) {
              const px = Number.isFinite(p.plotX) ? p.plotX : p.x;
              const x = xFor(px);
              const y = yFor(p.y);
              chartCtx.beginPath();
              chartCtx.arc(x, y, 2.5, 0, Math.PI * 2);
              chartCtx.fill();
            }

            // labels
            chartCtx.fillStyle = "#9aa7b3";
            chartCtx.font = "11px Arial, sans-serif";
            chartCtx.fillText("Brew number", padL, h - 10);
            chartCtx.save();
            chartCtx.translate(26, padT + plotH / 2);
            chartCtx.rotate(-Math.PI / 2);
            chartCtx.textAlign = "center";
            chartCtx.textBaseline = "middle";
            chartCtx.fillText("Seconds", 0, 0);
            chartCtx.restore();

            // axis min/max
            chartCtx.fillStyle = "#7a8a99";
            if (dayFilterEl && dayFilterEl.value !== "all") {
              for (const p of chartPoints) {
                const px = Number.isFinite(p.plotX) ? p.plotX : p.x;
                const x = xFor(px);
                const label = (p.label !== undefined && p.label !== null) ? p.label : p.x;
                chartCtx.fillText(String(label), x - 4, h - 22);
              }
            } else {
              for (let xVal = minX; xVal <= maxX; xVal += 1) {
                const x = xFor(xVal);
                chartCtx.fillText(String(xVal), x - 4, h - 22);
              }
            }
            for (let i = 0; i <= gridY; i++) {
              const yVal = yMin + i * yStep;
              const y = yFor(yVal);
              chartCtx.fillText(String(yVal), 8, y + 4);
            }
          }

                    
                              let wsFastPoll = null;
                              let wsRetryDelay = 300;
                              let wsConnectTimer = null;

                              async function fastPollLatest() {
                                try {
                                  const res = await fetch('/api/shots?limit=5', { cache: 'no-store' });
                                  const json = await res.json();
                                  const data = json.data || [];
                                  for (let i = data.length - 1; i >= 0; i--) {
                                    prependRow(data[i]);
                                  }
                                } catch (e) {
                                  // ignore
                                }
                              }

                              function startFastPoll() {
                                if (wsFastPoll) return;
                                wsFastPoll = setInterval(fastPollLatest, 1000);
                              }

                              function stopFastPoll() {
                                if (!wsFastPoll) return;
                                clearInterval(wsFastPoll);
                                wsFastPoll = null;
                              }

          function connectWs() {
            if (window._shotWs && (window._shotWs.readyState === 0 || window._shotWs.readyState === 1)) {
              return;
            }
            setStatus("Connecting...");
            startFastPoll();
            const proto = location.protocol === "https:" ? "wss" : "ws";
            let ws = null;
            try {
              ws = new WebSocket(proto + "://" + location.host + "/api/ws");
            } catch (e) {
              setStatus("Polling...");
              startFastPoll();
              const delay = wsRetryDelay || 300;
              setTimeout(connectWs, delay);
              wsRetryDelay = Math.min((wsRetryDelay || 300) * 2, 2000);
              return;
            }
            window._shotWs = ws;
            if (wsConnectTimer) {
              clearTimeout(wsConnectTimer);
              wsConnectTimer = null;
            }
            wsConnectTimer = setTimeout(() => {
              if (ws && ws.readyState !== 1) {
                setStatus("Polling...");
                startFastPoll();
              }
            }, 2000);
            ws.onopen = () => {
              if (wsConnectTimer) {
                clearTimeout(wsConnectTimer);
                wsConnectTimer = null;
              }
              setStatus("Live");
              wsRetryDelay = 300;
              stopFastPoll();
              if (window._shotWsPing) {
                clearInterval(window._shotWsPing);
                window._shotWsPing = null;
              }
              window._shotWsPing = setInterval(() => {
                try { ws.send("ping"); } catch (e) {}
              }, 10000);
            };
            ws.onmessage = (ev) => {
              try {
                if (ev.data === "pong") return;
                const data = JSON.parse(ev.data);
                if (data) prependRow(data);
              } catch (e) {
                // ignore bad payloads
              }
            };
            ws.onclose = () => {
              if (wsConnectTimer) {
                clearTimeout(wsConnectTimer);
                wsConnectTimer = null;
              }
              setStatus("Reconnecting...");
              if (window._shotWsPing) {
                clearInterval(window._shotWsPing);
                window._shotWsPing = null;
              }
              startFastPoll();
              const delay = wsRetryDelay || 300;
              setTimeout(connectWs, delay);
              wsRetryDelay = Math.min((wsRetryDelay || 300) * 2, 2000);
            };
            ws.onerror = () => {
              setStatus("Reconnecting...");
              try { ws.close(); } catch (e) {}
            };
          }

          try {
            loadShots();
            setStatus("Polling...");
            startFastPoll();
            connectWs();
          } catch (e) {
            setStatus("JS error: " + (e && e.message ? e.message : "init failed"));
          }
          setInterval(loadShots, 30000);
          window.addEventListener('resize', () => {
            if (!ENABLE_ANALYSIS) return;
            updateChartSize();
            scheduleChart();
          });
        
`;

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

    if (request.method === "GET" && url.pathname === "/app.js") {
      return new Response(CLIENT_SCRIPT, {
        headers: {
          "Content-Type": "application/javascript; charset=utf-8",
          "Cache-Control": "no-store",
        },
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
      const key =
        request.headers.get("x-api-key") ||
        url.searchParams.get("key") ||
        "";

      if (!env.API_KEY || key !== env.API_KEY) {
        return new Response("unauthorized", { status: 401 });
      }
      if (request.headers.get("Upgrade") !== "websocket") {
        return new Response("Expected websocket", { status: 400 });
      }
      const pair = new WebSocketPair();
      const client = pair[0];
      const server = pair[1];
      server.accept();
      server.addEventListener("message", (event) => {
        ctx.waitUntil(handleWsMessage(event, env, ctx));
      });
      return new Response(null, { status: 101, webSocket: client });
    }

    if (request.method === "GET" && url.pathname === "/") {
      if (!env.DB) {
        return new Response("DB not found", { status: 500 });
      }
      const limit = clampInt(url.searchParams.get("limit"), 1, 200, 300);
      const { results } = await env.DB.prepare(
        "SELECT id, created_at, shot_ms, shot_index FROM shots ORDER BY created_at DESC LIMIT ?"
      ).bind(limit).all();

      const rows = results.map(r => {
        const dt = new Date(r.created_at);
        const timeText = formatTime(dt); // HHhMM dd/mm/yy
        const shotText = formatShot(r.shot_ms); // 00.00s
        const idx = Number.isFinite(r.shot_index) ? `#${r.shot_index}` : "";
        return `<tr>
          <td>${idx}</td>
          <td>${timeText}</td>
          <td>${shotText}</td>
        </tr>`;
      }).join("");

      const isLocal = url.hostname === "localhost" || url.hostname === "127.0.0.1";
      const analysisButtonHtml = isLocal ? "" : `<div class="actions">
            <button class="btn" id="analysisBtn">See Detailed Analysis</button>
          </div>`;
      const analysisViewHtml = isLocal ? "" : `<div id="analysisView" class="panel hidden">
            <div class="analysis-title">Detailed Analysis</div>
            <div class="analysis-controls">
              <label>Start brew #
                <input id="brewStart" type="number" min="0" value="0" />
              </label>
              <label>Date
                <select id="dayFilter">
                  <option value="all">All</option>
                </select>
              </label>
            </div>
            <div class="chart-wrap">
              <div class="chart-scroll" id="chartScroll">
                <canvas id="chart"></canvas>
              </div>
              <div class="chart-legend">X: Brew number, Y: Shot seconds</div>
            </div>
          </div>`;

      const html = `<!doctype html>
      <html>
      <head>
        <meta charset="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <title>Shot Log</title>
        <style>
          body { font-family: Arial, sans-serif; background:#0b0b0b; color:#eaeaea; margin:0; }
          header { padding:16px 20px; font-size:20px; font-weight:600; text-align:center; }
          table { width:100%; border-collapse: collapse; }
          th, td { padding:10px 12px; border-bottom:1px solid #222; text-align:left; }
          th { color:#7fdcff; font-weight:600; }
          tr:hover { background:#111; }
          .wrap { max-width:900px; margin:0 auto; padding:0 16px 24px; }
          .sub { color:#888; font-size:13px; margin-bottom:8px; }
          .stats { color:#cfcfcf; font-size:14px; display:flex; gap:24px; flex-wrap:wrap; margin-bottom:10px; }
          .actions { display:flex; gap:10px; margin:10px 0 14px; }
          .btn { background:#141a1f; color:#cfefff; border:1px solid #243040; padding:8px 12px; border-radius:8px; cursor:pointer; font-weight:600; }
          .btn:hover { background:#1c2731; }
          .btn:active { transform: translateY(1px); }
          .panel { margin-top:8px; }
          .hidden { display:none; }
          .chart-wrap { background:#0f1113; border:1px solid #1f2a33; border-radius:12px; padding:12px; }
          .chart-scroll {
            overflow-x:auto;
            overflow-y:hidden;
            padding-bottom:6px;
            scrollbar-width: thin;
            scrollbar-color: #4b6b7c #11161b;
          }
          .chart-scroll::-webkit-scrollbar { height: 10px; }
          .chart-scroll::-webkit-scrollbar-track {
            background: linear-gradient(90deg, #0f1216, #121820);
            border-radius: 999px;
            box-shadow: inset 0 0 0 1px #1b2530;
          }
          .chart-scroll::-webkit-scrollbar-thumb {
            background: linear-gradient(90deg, #4aa3c7, #7fdcff);
            border-radius: 999px;
            box-shadow: 0 0 0 1px rgba(0,0,0,0.4);
          }
          .chart-scroll::-webkit-scrollbar-thumb:hover {
            background: linear-gradient(90deg, #5ab7de, #9fe6ff);
          }
          #chart { width:100%; height:320px; display:block; }
          .chart-legend { color:#7a8a99; font-size:12px; margin-top:8px; }
          .analysis-title { color:#cfefff; font-weight:600; margin:2px 0 10px; }
          .analysis-controls { display:flex; gap:12px; align-items:center; flex-wrap:wrap; margin:4px 0 10px; }
          .analysis-controls label { color:#9aa7b3; font-size:12px; display:flex; gap:6px; align-items:center; }
          .analysis-controls input,
          .analysis-controls select { background:#0f1113; color:#cfefff; border:1px solid #243040; border-radius:8px; padding:6px 8px; font-size:12px; }
          .analysis-controls input { width:64px; text-align:center; }
          .analysis-controls input:disabled,
          .analysis-controls select:disabled { opacity:0.5; cursor:not-allowed; }
        </style>
      </head>
      <body>
        <div class="wrap">
          <header>BREW RECORDED - CASADIO UNDICI</header>
          <div class="sub" id="status">Connecting...</div>
          <div class="stats">
            <div id="brewCounter">Brew counter: --</div>
            <div id="avgBrew">Avg Brew Time: --.--s</div>
          </div>
          ${analysisButtonHtml}
          <div id="mainView" class="panel">
            <table>
              <thead>
                <tr><th>Brew number</th><th>Time</th><th>Shot</th></tr>
              </thead>
              <tbody id="shots">
                ${rows || `<tr><td colspan="3">No data</td></tr>`}
              </tbody>
            </table>
          </div>
          ${analysisViewHtml}
        </div>

        <script src="/app.js"></script>
      </body>
      </html>`;
      return new Response(html, {
        headers: {
          "Content-Type": "text/html; charset=utf-8",
          "Cache-Control": "no-store",
        },
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
      if (!Number.isFinite(shotMs)) {
        return json({ ok: false, error: "invalid_shot_ms" }, origin, allowedOrigin, 400);
      }
      if (ctx) {
        ctx.waitUntil(ingestPayload(payload, env, ctx));
      } else {
        await ingestPayload(payload, env, ctx);
      }
      return new Response(null, {
        status: 204,
        headers: {
          ...corsHeaders(origin, allowedOrigin),
          "Connection": "keep-alive",
          "Keep-Alive": "timeout=30"
        },
      });
    }

    if (request.method === "GET" && url.pathname === "/api/shots") {
      if (!env.DB) {
        return json({ ok: false, error: "DB not bound" }, origin, allowedOrigin, 500);
      }
      const limit = clampInt(url.searchParams.get("limit"), 1, 200, 300);
      const { results } = await env.DB.prepare(
        "SELECT id, created_at, shot_ms, shot_index, payload FROM shots ORDER BY created_at DESC LIMIT ?"
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

async function handleWsMessage(event, env, ctx) {
  let payload = null;
  try {
    payload = JSON.parse(event.data);
  } catch {
    return;
  }
  const prep = preparePayload(payload);
  if (!prep.ok) return;
  if (env.SHOT_HUB) {
    await broadcastShot(prep.hubMessage, env);
  }
  if (env.DB && ctx) {
    ctx.waitUntil(insertShot(prep, env));
  } else if (env.DB) {
    await insertShot(prep, env);
  }
}

async function ingestPayload(payload, env, ctx) {
  const prep = preparePayload(payload);
  if (!prep.ok) return prep;
  if (env.SHOT_HUB && ctx) {
    ctx.waitUntil(broadcastShot(prep.hubMessage, env));
  } else if (env.SHOT_HUB) {
    await broadcastShot(prep.hubMessage, env);
  }
  if (env.DB && ctx) {
    ctx.waitUntil(insertShot(prep, env));
    return { ok: true, id: prep.id, created_at: prep.createdAtMs };
  }
  if (!env.DB) {
    return { ok: false, error: "DB not bound", status: 500 };
  }
  await insertShot(prep, env);
  return { ok: true, id: prep.id, created_at: prep.createdAtMs };
}

function preparePayload(payload) {
  const shotMs = num(payload.shot_ms ?? payload.ms ?? payload.duration_ms);
  const shotEpochSec = num(payload.epoch ?? payload.ts);
  const createdAtMs = shotEpochSec ? shotEpochSec * 1000 : Date.now();
  const deviceId = payload.device_id ? String(payload.device_id) : null;
  const shotIndex = num(payload.shot_index ?? payload.shotIndex ?? payload.index);
  const bootId = num(payload.boot_id ?? payload.bootId ?? payload.boot);
  const brewCounter = num(payload.brew_counter ?? payload.brewCounter);
  const avgMs = num(payload.avg_ms ?? payload.avgMs);

  if (!Number.isFinite(shotMs)) {
    return { ok: false, error: "invalid_shot_ms", status: 400 };
  }

  let id = payload.id ? String(payload.id) : null;
  if (!id) {
    if (deviceId && Number.isFinite(bootId) && Number.isFinite(shotIndex)) {
      id = `${deviceId}:${bootId}:${shotIndex}`;
    } else if (deviceId && Number.isFinite(shotIndex) && Number.isFinite(shotEpochSec)) {
      id = `${deviceId}:${shotIndex}:${shotEpochSec}`;
    } else {
      id = crypto.randomUUID();
    }
  }

  const hubMessage = JSON.stringify({
    id,
    created_at: createdAtMs,
    shot_ms: shotMs,
    shot_index: shotIndex,
    brew_counter: brewCounter,
    avg_ms: avgMs,
  });

  return {
    ok: true,
    id,
    createdAtMs,
    shotMs,
    deviceId,
    shotIndex,
    payloadJson: JSON.stringify(payload),
    hubMessage,
  };
}

async function broadcastShot(hubMessage, env) {
  const hub = env.SHOT_HUB.get(env.SHOT_HUB.idFromName(HUB_NAME));
  await hub.fetch("https://hub/broadcast", {
    method: "POST",
    body: hubMessage,
  });
}

async function insertShot(prep, env) {
  return env.DB.prepare(
    "INSERT OR IGNORE INTO shots (id, created_at, shot_ms, device_id, shot_index, payload) VALUES (?, ?, ?, ?, ?, ?)"
  ).bind(
    prep.id,
    prep.createdAtMs,
    prep.shotMs,
    prep.deviceId,
    prep.shotIndex,
    prep.payloadJson
  ).run();
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
