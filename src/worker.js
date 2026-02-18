const ALLOWED_ORIGIN = "https://shotlog.barista-homelife.cloud";
const HUB_NAME = "global";
const DEV_ORIGINS = new Set(["http://localhost:8787", "http://127.0.0.1:8787"]);
const DAY_TZ_OFFSET = "+7 hours";

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
      const limit = clampInt(url.searchParams.get("limit"), 1, 500, 500);
      const { results } = await env.DB.prepare(
        "SELECT id, created_at, shot_ms, brew_counter, avg_ms, shot_index, payload FROM shots ORDER BY created_at DESC LIMIT ?"
      ).bind(limit).all();

      const rows = results.map(r => {
        const dt = new Date(r.created_at);
        const timeText = formatTime(dt); // HHhMM dd/mm/yy
        const shotText = formatShot(r.shot_ms); // 00.00s
        const idx = Number.isFinite(r.brew_counter) ? `#${r.brew_counter}` : "";
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
            <div class="analysis-title">Based on Brews</div>
            <div class="chart-wrap">
              <canvas id="chartAxis"></canvas>
              <div class="chart-scroll" id="chartScroll">
                <canvas id="chart"></canvas>
              </div>
            </div>
            <div class="analysis-subtitle">Latest Date</div>
            <div class="chart-wrap">
              <canvas id="dayChartAxis"></canvas>
              <div class="chart-scroll" id="dayChartScroll">
                <canvas id="dayChart"></canvas>
              </div>
            </div>
            <div class="analysis-subtitle">Latest Date (timeline)</div>
            <div class="chart-wrap">
              <canvas id="dayTimeChartAxis"></canvas>
              <div class="chart-scroll" id="dayTimeChartScroll">
                <canvas id="dayTimeChart"></canvas>
              </div>
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
          .chart-wrap { background:#0f1113; border:1px solid #1f2a33; border-radius:12px; padding:12px; display:flex; gap:8px; align-items:flex-start; }
          #chartAxis { width:50px; height:320px; display:block; flex:0 0 auto; }
          .chart-scroll { overflow-x:auto; overflow-y:hidden; padding-bottom:6px; flex:1 1 auto; }
          .chart-scroll::-webkit-scrollbar { height: 8px; }
          .chart-scroll::-webkit-scrollbar-track { background:#10161c; border-radius:999px; }
          .chart-scroll::-webkit-scrollbar-thumb { background:#2e4a5a; border-radius:999px; }
          #chart { width:100%; height:320px; display:block; }
          .chart-legend { color:#7a8a99; font-size:12px; margin-top:8px; }
          .analysis-title { color:#cfefff; font-weight:600; margin:2px 0 10px; }
          .analysis-subtitle { color:#9fbfd4; font-weight:600; margin:14px 0 8px; }
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

        <script>
          const MAX_ROWS = 500;
          const MAX_POINTS = 500;
          const TARGET_TIME_SEC = 25;
          const DAY_TIME_MAX_HOUR = 23 + (59 / 60);
          const CHART_RESYNC_DEBOUNCE_MS = 1500;
          const seen = new Set();
          const statusEl = document.getElementById('status');
          const brewEl = document.getElementById('brewCounter');
          const avgEl = document.getElementById('avgBrew');
          const mainView = document.getElementById('mainView');
          const analysisView = document.getElementById('analysisView');
          const analysisBtn = document.getElementById('analysisBtn');
          const chartCanvas = document.getElementById('chart');
          const chartAxisCanvas = document.getElementById('chartAxis');
          const chartScroll = document.getElementById('chartScroll');
          const dayChartCanvas = document.getElementById('dayChart');
          const dayChartAxisCanvas = document.getElementById('dayChartAxis');
          const dayChartScroll = document.getElementById('dayChartScroll');
          const dayTimeChartCanvas = document.getElementById('dayTimeChart');
          const dayTimeChartAxisCanvas = document.getElementById('dayTimeChartAxis');
          const dayTimeChartScroll = document.getElementById('dayTimeChartScroll');
          let chartCtx = chartCanvas ? chartCanvas.getContext('2d') : null;
          let chartAxisCtx = chartAxisCanvas ? chartAxisCanvas.getContext('2d') : null;
          let dayChartCtx = dayChartCanvas ? dayChartCanvas.getContext('2d') : null;
          let dayChartAxisCtx = dayChartAxisCanvas ? dayChartAxisCanvas.getContext('2d') : null;
          let dayTimeChartCtx = dayTimeChartCanvas ? dayTimeChartCanvas.getContext('2d') : null;
          let dayTimeChartAxisCtx = dayTimeChartAxisCanvas ? dayTimeChartAxisCanvas.getContext('2d') : null;
          let chartPoints = [];
          let chartIds = new Set();
          let dayChartPoints = [];
          let dayChartIds = new Set();
          let dayChartMaxIndex = 0;
          let dayTimeChartPoints = [];
          let dayTimeChartIds = new Set();
          let dayChartLabel = "";
          let chartScheduled = false;
          let chartResyncTimer = null;
          let chartResyncInFlight = false;
          let chartMaxIndex = 0;
          const ENABLE_ANALYSIS = !!analysisBtn && !!chartCanvas && !!dayChartCanvas && !!dayTimeChartCanvas;

          function setStatus(text) {
            if (statusEl) statusEl.textContent = text;
          }

          function showMain() {
            if (mainView) mainView.classList.remove('hidden');
            if (analysisView) analysisView.classList.add('hidden');
            if (analysisBtn) analysisBtn.textContent = "See Detailed Analysis";
          }

          async function showAnalysis() {
            if (!ENABLE_ANALYSIS) return;
            await loadShots();
            if (mainView) mainView.classList.add('hidden');
            if (analysisView) analysisView.classList.remove('hidden');
            if (analysisBtn) analysisBtn.textContent = "Back to main";
            updateChartSize();
            resizeChart();
            if (chartScroll) chartScroll.scrollLeft = 0;
            if (dayChartScroll) dayChartScroll.scrollLeft = 0;
            if (dayTimeChartScroll) dayTimeChartScroll.scrollLeft = 0;
            scheduleChart();
          }

          async function toggleAnalysis() {
            if (!ENABLE_ANALYSIS) return;
            if (analysisView && !analysisView.classList.contains('hidden')) {
              showMain();
            } else {
              await showAnalysis();
            }
          }

          if (analysisBtn) analysisBtn.addEventListener('click', toggleAnalysis);

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
            const idx = Number.isFinite(r.brew_counter) ? '#' + r.brew_counter : '';
            return \`<tr><td>\${idx}</td><td>\${timeText}</td><td>\${shotText}</td></tr>\`;
          }

          function trimRows(tbody) {
            while (tbody.children.length > MAX_ROWS) {
              tbody.removeChild(tbody.lastElementChild);
            }
          }

          function toPoint(r) {
            if (!r) return null;
            const x = Number(r.brew_counter);
            const y = Number(r.shot_ms);
            if (!Number.isFinite(x) || !Number.isFinite(y)) return null;
            const ySec = Math.floor(y / 10) / 100;
            const key = String(r.id || ((r.brew_counter || "") + ":" + (r.shot_ms || "")));
            return { id: key, x, y: ySec };
          }

          function dateKey(v) {
            const d = new Date(v);
            if (!Number.isFinite(d.getTime())) return "";
            const t = d.getTime() + (7 * 60 * 60 * 1000);
            const tz = new Date(t);
            const y = tz.getUTCFullYear();
            const m = pad2(tz.getUTCMonth() + 1);
            const day = pad2(tz.getUTCDate());
            return y + "-" + m + "-" + day;
          }

          function dateLabel(v) {
            const d = new Date(v);
            if (!Number.isFinite(d.getTime())) return "";
            const t = d.getTime() + (7 * 60 * 60 * 1000);
            const tz = new Date(t);
            return pad2(tz.getUTCDate()) + "/" + pad2(tz.getUTCMonth() + 1) + "/" + String(tz.getUTCFullYear()).slice(-2);
          }

          function timeOfDayHour(v) {
            const d = new Date(v);
            if (!Number.isFinite(d.getTime())) return null;
            const t = d.getTime() + (7 * 60 * 60 * 1000);
            const tz = new Date(t);
            const hh = tz.getUTCHours();
            const mm = tz.getUTCMinutes();
            const ss = tz.getUTCSeconds();
            return hh + (mm / 60) + (ss / 3600);
          }

          function resetChart() {
            chartPoints = [];
            chartIds = new Set();
            chartMaxIndex = 0;
            dayChartPoints = [];
            dayChartIds = new Set();
            dayChartMaxIndex = 0;
            dayTimeChartPoints = [];
            dayTimeChartIds = new Set();
            dayChartLabel = "";
            scheduleChart();
          }

          function filterToLatestSession(data) {
            const idx = data.findIndex(r => Number(r && r.brew_counter) === 1);
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
            chartPoints = trimmed;
            chartIds = new Set(trimmed.map(p => p.id));
            chartMaxIndex = trimmed.reduce((m, p) => (p.x > m ? p.x : m), 0);

            const latestDayKey = data.length > 0 ? dateKey(data[0].created_at) : "";
            dayChartLabel = data.length > 0 ? dateLabel(data[0].created_at) : "";
            const dayRowsDesc = latestDayKey ? data.filter(r => dateKey(r && r.created_at) === latestDayKey) : [];
            const dayRows = dayRowsDesc.slice().reverse();
            const dayPts = [];
            const dayIds = new Set();
            dayRows.forEach((r, i) => {
              const y = Number(r && r.shot_ms);
              if (!Number.isFinite(y)) return;
              const idx = Number(r && r.shot_index);
              const key = String(r.id || ((r.brew_counter || "") + ":" + (r.shot_ms || "") + ":" + (r.created_at || "")));
              if (dayIds.has(key)) return;
              dayIds.add(key);
              dayPts.push({ id: key, x: Number.isFinite(idx) ? idx : (i + 1), y: Math.floor(y / 10) / 100 });
            });
            dayPts.sort((a, b) => a.x - b.x);
            const dayTrimmed = dayPts.length > MAX_POINTS ? dayPts.slice(dayPts.length - MAX_POINTS) : dayPts;
            dayChartPoints = dayTrimmed;
            dayChartIds = new Set(dayTrimmed.map(p => p.id));
            dayChartMaxIndex = dayTrimmed.reduce((m, p) => (p.x > m ? p.x : m), 0);
            const dayTimePts = [];
            const dayTimeIds = new Set();
            dayRows.forEach(r => {
              const y = Number(r && r.shot_ms);
              const x = timeOfDayHour(r && r.created_at);
              if (!Number.isFinite(y) || !Number.isFinite(x)) return;
              const key = String(r.id || ((r.brew_counter || "") + ":" + (r.shot_ms || "") + ":" + (r.created_at || "")));
              if (dayTimeIds.has(key)) return;
              dayTimeIds.add(key);
              dayTimePts.push({ id: key, x, y: Math.floor(y / 10) / 100 });
            });
            dayTimePts.sort((a, b) => a.x - b.x);
            const dayTimeTrimmed = dayTimePts.length > MAX_POINTS ? dayTimePts.slice(dayTimePts.length - MAX_POINTS) : dayTimePts;
            dayTimeChartPoints = dayTimeTrimmed;
            dayTimeChartIds = new Set(dayTimeTrimmed.map(p => p.id));

            if (analysisView && !analysisView.classList.contains('hidden')) {
              updateChartSize();
              scheduleChart();
            }
          }

          function addChartPoint(r) {
            if (!ENABLE_ANALYSIS) return;
            const idx = Number(r && r.brew_counter);
            if (Number.isFinite(idx)) {
              if (idx === 1 || (chartMaxIndex > 0 && idx < chartMaxIndex)) {
                resetChart();
              }
            }
            const pt = toPoint(r);
            if (!pt || chartIds.has(pt.id)) return;
            chartIds.add(pt.id);
            chartPoints.push(pt);
            chartPoints.sort((a, b) => a.x - b.x);
            if (chartPoints.length > MAX_POINTS) {
              const excess = chartPoints.length - MAX_POINTS;
              const removed = chartPoints.splice(0, excess);
              removed.forEach(p => chartIds.delete(p.id));
            }
            if (pt.x > chartMaxIndex) chartMaxIndex = pt.x;

            const dk = dateKey(r && r.created_at);
            if (dk) {
              const dl = dateLabel(r.created_at);
              if (!dayChartLabel || dayChartLabel !== dl) {
                dayChartPoints = [];
                dayChartIds = new Set();
                dayChartMaxIndex = 0;
                dayTimeChartPoints = [];
                dayTimeChartIds = new Set();
                dayChartLabel = dl;
              }
              const dkey = String(r.id || ((r.brew_counter || "") + ":" + (r.shot_ms || "") + ":" + (r.created_at || "")));
              if (!dayChartIds.has(dkey)) {
                const dayIdx = Number(r && r.shot_index);
                dayChartIds.add(dkey);
                const x = Number.isFinite(dayIdx) ? dayIdx : (dayChartMaxIndex + 1);
                dayChartPoints.push({ id: dkey, x, y: pt.y });
                dayChartPoints.sort((a, b) => a.x - b.x);
                if (x > dayChartMaxIndex) dayChartMaxIndex = x;
                if (dayChartPoints.length > MAX_POINTS) {
                  const excess = dayChartPoints.length - MAX_POINTS;
                  const removed = dayChartPoints.splice(0, excess);
                  removed.forEach(p => dayChartIds.delete(p.id));
                }
              }
              if (!dayTimeChartIds.has(dkey)) {
                const dayTimeX = timeOfDayHour(r && r.created_at);
                if (Number.isFinite(dayTimeX)) {
                  dayTimeChartIds.add(dkey);
                  dayTimeChartPoints.push({ id: dkey, x: dayTimeX, y: pt.y });
                  dayTimeChartPoints.sort((a, b) => a.x - b.x);
                  if (dayTimeChartPoints.length > MAX_POINTS) {
                    const excess = dayTimeChartPoints.length - MAX_POINTS;
                    const removed = dayTimeChartPoints.splice(0, excess);
                    removed.forEach(p => dayTimeChartIds.delete(p.id));
                  }
                }
              }
            }

            if (analysisView && !analysisView.classList.contains('hidden')) {
              updateChartSize();
              scheduleChart();
            }
          }

          function rowKey(r) {
            return String(r && r.id ? r.id : "");
          }

          function prependRow(r) {
            const tbody = document.getElementById('shots');
            if (!tbody) return;
            const key = rowKey(r);
            if (!key) return;
            if (seen.has(key)) return;
            seen.add(key);
            tbody.insertAdjacentHTML('afterbegin', renderRow(r));
            trimRows(tbody);
            extractStats(r);
            addChartPoint(r);
            scheduleChartResync();
          }

          function scheduleChartResync() {
            if (!ENABLE_ANALYSIS) return;
            if (!analysisView || analysisView.classList.contains('hidden')) return;
            if (chartResyncTimer) return;
            chartResyncTimer = setTimeout(async () => {
              chartResyncTimer = null;
              if (chartResyncInFlight) return;
              chartResyncInFlight = true;
              try {
                const res = await fetch('/api/shots?limit=500', { cache: 'no-store' });
                const json = await res.json();
                const data = Array.isArray(json && json.data) ? json.data : [];
                setChartFromData(data);
              } catch (e) {
                // ignore resync errors
              } finally {
                chartResyncInFlight = false;
              }
            }, CHART_RESYNC_DEBOUNCE_MS);
          }

          async function loadShots() {
            try {
              const res = await fetch('/api/shots?limit=500', { cache: 'no-store' });
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
              data.forEach(r => {
                const key = rowKey(r);
                if (key) seen.add(key);
              });
              tbody.innerHTML = data.map(r => renderRow(r)).join('');
              trimRows(tbody);
              extractStats(data[0]);
              setChartFromData(data);
              updateChartSize();
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
          function scheduleChart() {
            if (!ENABLE_ANALYSIS) return;
            if (!chartCanvas || !chartCtx) return;
            if (chartScheduled) return;
            chartScheduled = true;
            requestAnimationFrame(() => {
              chartScheduled = false;
              drawChart();
              drawDayChart();
              drawDayTimeChart();
            });
          }

          function updateSingleChartSize(canvas, axisCanvas, scrollEl, points, opts) {
            if (!canvas || !scrollEl) return;
            const options = opts || {};
            const containerW = scrollEl.clientWidth || 0;
            const minX = Number.isFinite(options.minX) ? options.minX : 0;
            const maxX = Number.isFinite(options.maxX)
              ? options.maxX
              : (points.length > 0 ? points.reduce((m, p) => (p.x > m ? p.x : m), minX) : minX);
            const span = Math.max(1, (maxX - minX + 1));
            const spacing = Number.isFinite(options.spacing) ? options.spacing : 28;
            const desired = span * spacing + 70;
            const width = Math.max(containerW, desired);
            canvas.style.width = width + "px";
            canvas.style.height = "320px";
            if (axisCanvas) {
              axisCanvas.style.width = "50px";
              axisCanvas.style.height = "320px";
            }
          }

          function getDayDisplayPoints() {
            if (!Array.isArray(dayChartPoints) || dayChartPoints.length === 0) return [];
            const minX = dayChartPoints.reduce((m, p) => (p.x < m ? p.x : m), dayChartPoints[0].x);
            return dayChartPoints.map(p => ({ id: p.id, x: (p.x - minX + 1), y: p.y }));
          }

          function updateChartSize() {
            if (!ENABLE_ANALYSIS) return;
            updateSingleChartSize(chartCanvas, chartAxisCanvas, chartScroll, chartPoints);
            updateSingleChartSize(dayChartCanvas, dayChartAxisCanvas, dayChartScroll, getDayDisplayPoints());
            updateSingleChartSize(dayTimeChartCanvas, dayTimeChartAxisCanvas, dayTimeChartScroll, dayTimeChartPoints, {
              minX: 0,
              maxX: DAY_TIME_MAX_HOUR,
              spacing: 36
            });
            resizeChart();
          }

          function resizeChart() {
            if (!ENABLE_ANALYSIS) return;
            const dpr = window.devicePixelRatio || 1;
            function resizeOne(canvas, ctx, axisCanvas, axisCtx) {
              if (!canvas || !ctx) return;
              const w = canvas.clientWidth || 0;
              const h = canvas.clientHeight || 0;
              if (w === 0 || h === 0) return;
              canvas.width = Math.floor(w * dpr);
              canvas.height = Math.floor(h * dpr);
              ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
              if (axisCanvas && axisCtx) {
                const aw = axisCanvas.clientWidth || 0;
                const ah = axisCanvas.clientHeight || 0;
                if (aw > 0 && ah > 0) {
                  axisCanvas.width = Math.floor(aw * dpr);
                  axisCanvas.height = Math.floor(ah * dpr);
                  axisCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
                }
              }
            }
            resizeOne(chartCanvas, chartCtx, chartAxisCanvas, chartAxisCtx);
            resizeOne(dayChartCanvas, dayChartCtx, dayChartAxisCanvas, dayChartAxisCtx);
            resizeOne(dayTimeChartCanvas, dayTimeChartCtx, dayTimeChartAxisCanvas, dayTimeChartAxisCtx);
          }

          function drawLineChart(canvas, ctx, axisCanvas, axisCtx, scrollEl, points, xLabel, opts) {
            if (!canvas || !ctx) return;
            const options = opts || {};
            const xMode = options.xMode === "time" ? "time" : "index";
            const timeMinX = Number.isFinite(options.minX) ? options.minX : 0;
            const timeMaxX = Number.isFinite(options.maxX) ? options.maxX : 24;
            const xGridStep = Number.isFinite(options.xGridStep) ? options.xGridStep : (xMode === "time" ? 2 : 1);
            const xLabelStep = Number.isFinite(options.xLabelStep) ? options.xLabelStep : (xMode === "time" ? 2 : 1);
            const showLine = options.showLine !== false;
            const lineColor = typeof options.lineColor === "string" ? options.lineColor : "#7fdcff";
            const pointColor = typeof options.pointColor === "string" ? options.pointColor : "#7fdcff";
            const pointRadius = Number.isFinite(options.pointRadius) ? options.pointRadius : 2.5;
            const w = canvas.clientWidth || 0;
            const h = canvas.clientHeight || 0;
            if (w === 0 || h === 0) return;
            ctx.clearRect(0, 0, w, h);
            ctx.fillStyle = "#0f1113";
            ctx.fillRect(0, 0, w, h);

            if (points.length === 0) {
              ctx.fillStyle = "#7a8a99";
              ctx.font = "12px Arial, sans-serif";
              ctx.fillText("No data yet", 12, 20);
              return;
            }

            let minX = xMode === "time" ? timeMinX : 0;
            let maxX = xMode === "time" ? timeMaxX : points[0].x;
            let maxY = points[0].y;
            for (const p of points) {
              if (xMode !== "time" && p.x > maxX) maxX = p.x;
              if (p.y > maxY) maxY = p.y;
            }
            if (minX === maxX) { maxX = minX + 1; }
            const yValsRaw = points.map(p => Number(p.y)).filter(v => Number.isFinite(v));
            const rawMin = yValsRaw.length > 0 ? Math.min(...yValsRaw) : 0;
            const rawMax = yValsRaw.length > 0 ? Math.max(...yValsRaw) : maxY;
            const rawMinWithTarget = Math.min(rawMin, TARGET_TIME_SEC);
            const rawMaxWithTarget = Math.max(rawMax, TARGET_TIME_SEC);
            const yStep = 2;
            let yMin = Math.floor(rawMinWithTarget / yStep) * yStep;
            let yMax = Math.ceil(rawMaxWithTarget / yStep) * yStep;
            if (yMin === yMax) yMax = yMin + yStep;
            const yVals = [];
            for (let y = yMin; y <= yMax + 0.0001; y += yStep) {
              yVals.push(Math.round(y * 100) / 100);
            }

            const padL = 10;
            const padR = 16;
            const padT = 16;
            const padB = 32;
            const plotW = Math.max(1, w - padL - padR);
            const plotH = Math.max(1, h - padT - padB);
            const axisX = padL;

            function xFor(x) {
              return padL + ((x - minX) / (maxX - minX)) * plotW;
            }
            function yFor(y) {
              return padT + (1 - (y - yMin) / (yMax - yMin)) * plotH;
            }

            // axis line
            ctx.strokeStyle = "#22303a";
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.moveTo(padL, padT + plotH);
            ctx.lineTo(padL + plotW, padT + plotH);
            ctx.stroke();

            // grid
            ctx.strokeStyle = "#1f2a33";
            ctx.lineWidth = 1;
            for (const yVal of yVals) {
              const y = yFor(yVal);
              ctx.beginPath();
              ctx.moveTo(axisX, y);
              ctx.lineTo(axisX + plotW, y);
              ctx.stroke();
            }

            // x grid
            ctx.strokeStyle = "#151d24";
            for (let xVal = minX; xVal <= maxX + 0.0001; xVal += xGridStep) {
              const x = xFor(xVal);
              ctx.beginPath();
              ctx.moveTo(x, padT);
              ctx.lineTo(x, padT + plotH);
              ctx.stroke();
            }

            // fixed target line (25s)
            const targetY = yFor(TARGET_TIME_SEC);
            ctx.strokeStyle = "#f1d44a";
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.moveTo(axisX, targetY);
            ctx.lineTo(axisX + plotW, targetY);
            ctx.stroke();

            // legend (top-right)
            const legendText = "Target Time";
            ctx.font = "12px Arial, sans-serif";
            const legendTextW = ctx.measureText(legendText).width;
            const legendPad = 6;
            const sampleW = 20;
            const legendW = sampleW + 8 + legendTextW + legendPad * 2;
            const legendH = 20;
            const viewRight = scrollEl ? (scrollEl.scrollLeft + scrollEl.clientWidth) : (axisX + plotW);
            const rightClamp = axisX + plotW - 6;
            const leftClamp = axisX + legendW + 6;
            const legendRight = Math.min(rightClamp, Math.max(leftClamp, viewRight - 8));
            const legendX = legendRight - legendW;
            const legendY = Math.max(2, padT - legendH - 4);
            ctx.fillStyle = "rgba(10, 14, 18, 0.78)";
            ctx.fillRect(legendX, legendY, legendW, legendH);
            ctx.strokeStyle = "#23313c";
            ctx.lineWidth = 1;
            ctx.strokeRect(legendX, legendY, legendW, legendH);
            const sampleY = legendY + Math.floor(legendH / 2) + 0.5;
            const sampleX1 = legendX + legendPad;
            const sampleX2 = sampleX1 + sampleW;
            ctx.strokeStyle = "#f1d44a";
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.moveTo(sampleX1, sampleY);
            ctx.lineTo(sampleX2, sampleY);
            ctx.stroke();
            ctx.fillStyle = "#f1d44a";
            ctx.textBaseline = "middle";
            ctx.fillText(legendText, sampleX2 + 8, sampleY);
            ctx.textBaseline = "alphabetic";

            // line
            if (showLine) {
              ctx.strokeStyle = lineColor;
              ctx.lineWidth = 2;
              ctx.beginPath();
              points.forEach((p, i) => {
                const x = xFor(p.x);
                const y = yFor(p.y);
                if (i === 0) ctx.moveTo(x, y);
                else ctx.lineTo(x, y);
              });
              ctx.stroke();
            }

            // points
            ctx.fillStyle = pointColor;
            for (const p of points) {
              const x = xFor(p.x);
              const y = yFor(p.y);
              ctx.beginPath();
              ctx.arc(x, y, pointRadius, 0, Math.PI * 2);
              ctx.fill();
            }

            // labels
            ctx.fillStyle = "#7a8a99";
            ctx.font = "11px Arial, sans-serif";
            ctx.fillText(xLabel, padL, h - 10);
            if (xMode === "time") {
              for (let xVal = minX; xVal <= maxX + 0.0001; xVal += xLabelStep) {
                const x = xFor(xVal);
                const hh = Math.round(xVal) % 24;
                const label = pad2(hh) + ":00";
                ctx.fillText(label, x - 14, h - 22);
              }
            } else {
              for (let xVal = minX; xVal <= maxX; xVal += xLabelStep) {
                const x = xFor(xVal);
                ctx.fillText(String(xVal), x - 4, h - 22);
              }
            }

            if (axisCtx && axisCanvas) {
              const ax = axisCanvas.clientWidth || 0;
              const ay = axisCanvas.clientHeight || 0;
              axisCtx.clearRect(0, 0, ax, ay);
              axisCtx.fillStyle = "#0b0f13";
              axisCtx.fillRect(0, 0, ax, ay);
              axisCtx.strokeStyle = "#22303a";
              axisCtx.lineWidth = 1;
              axisCtx.beginPath();
              axisCtx.moveTo(ax - 1, padT);
              axisCtx.lineTo(ax - 1, padT + plotH);
              axisCtx.stroke();
              axisCtx.fillStyle = "#7a8a99";
              axisCtx.textAlign = "right";
              axisCtx.textBaseline = "middle";
              for (const yVal of yVals) {
                const y = yFor(yVal);
                axisCtx.fillText(String(yVal) + "s", ax - 8, y - 2);
              }
            }
          }

          function drawChart() {
            if (!ENABLE_ANALYSIS) return;
            drawLineChart(chartCanvas, chartCtx, chartAxisCanvas, chartAxisCtx, chartScroll, chartPoints, "Brew count");
          }

          function drawDayChart() {
            if (!ENABLE_ANALYSIS) return;
            const label = dayChartLabel ? ("Shot index (" + dayChartLabel + ")") : "Shot index (day)";
            drawLineChart(dayChartCanvas, dayChartCtx, dayChartAxisCanvas, dayChartAxisCtx, dayChartScroll, getDayDisplayPoints(), label);
          }

          function drawDayTimeChart() {
            if (!ENABLE_ANALYSIS) return;
            const label = dayChartLabel ? ("Time of day (" + dayChartLabel + ")") : "Time of day (day)";
            drawLineChart(dayTimeChartCanvas, dayTimeChartCtx, dayTimeChartAxisCanvas, dayTimeChartAxisCtx, dayTimeChartScroll, dayTimeChartPoints, label, {
              xMode: "time",
              minX: 0,
              maxX: DAY_TIME_MAX_HOUR,
              xGridStep: 1,
              xLabelStep: 1,
              showLine: false,
              pointColor: "#ff4d4f",
              pointRadius: 3.5
            });
          }

                    
                              let wsFastPoll = null;
                              let wsRetryDelay = 300;
                              let wsLastSeenMs = 0;
                              const WS_PING_INTERVAL_MS = 10000;
                              const WS_STALE_TIMEOUT_MS = 30000;

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
            setStatus("Connecting...");
            const proto = location.protocol === "https:" ? "wss" : "ws";
            const ws = new WebSocket(proto + "://" + location.host + "/api/ws");
            window._shotWs = ws;
            stopFastPoll();
            ws.onopen = () => {
              setStatus("Live");
              wsRetryDelay = 300;
              wsLastSeenMs = Date.now();
              scheduleChartResync();
              if (window._shotWsPing) {
                clearInterval(window._shotWsPing);
                window._shotWsPing = null;
              }
              window._shotWsPing = setInterval(() => {
                const now = Date.now();
                if (now - wsLastSeenMs > WS_STALE_TIMEOUT_MS) {
                  try { ws.close(); } catch (e) {}
                  return;
                }
                try { ws.send("ping"); } catch (e) {}
              }, WS_PING_INTERVAL_MS);
            };
            ws.onmessage = (ev) => {
              try {
                wsLastSeenMs = Date.now();
                if (ev.data === "pong") return;
                const data = JSON.parse(ev.data);
                if (data) prependRow(data);
              } catch (e) {
                // ignore bad payloads
              }
            };
            ws.onclose = () => {
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
              ws.close();
            };
          }

          loadShots();
          connectWs();
          if (chartScroll) {
            chartScroll.addEventListener('scroll', () => {
              if (!ENABLE_ANALYSIS) return;
              scheduleChart();
            }, { passive: true });
          }
          if (dayChartScroll) {
            dayChartScroll.addEventListener('scroll', () => {
              if (!ENABLE_ANALYSIS) return;
              scheduleChart();
            }, { passive: true });
          }
          if (dayTimeChartScroll) {
            dayTimeChartScroll.addEventListener('scroll', () => {
              if (!ENABLE_ANALYSIS) return;
              scheduleChart();
            }, { passive: true });
          }
          window.addEventListener('resize', () => {
            if (!ENABLE_ANALYSIS) return;
            updateChartSize();
            scheduleChart();
          });
        </script>
      </body>
      </html>`;
      return new Response(html, {
        headers: {
          "Content-Type": "text/html; charset=utf-8",
          "Cache-Control": "no-store, no-cache, must-revalidate",
        }
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
      await ingestPayload(payload, env);
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
      const limit = clampInt(url.searchParams.get("limit"), 1, 500, 500);
      const { results } = await env.DB.prepare(
        "SELECT id, created_at, shot_ms, brew_counter, avg_ms, shot_index, payload FROM shots ORDER BY created_at DESC LIMIT ?"
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
      "Cache-Control": "no-store, no-cache, must-revalidate",
      ...corsHeaders(origin, allowedOrigin),
    },
  });
}

async function ingestPayload(payload, env) {
  const prep = preparePayload(payload);
  if (!prep.ok) return prep;
  if (!env.DB) {
    return { ok: false, error: "DB not bound", status: 500 };
  }
  await processIngest(prep, env);
  return { ok: true, created_at: prep.createdAtMs };
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

function buildHubMessage(prep, shotIndex) {
  return JSON.stringify({
    id: prep.id,
    created_at: prep.createdAtMs,
    shot_ms: prep.shotMs,
    brew_counter: prep.brewCounter,
    avg_ms: prep.avgMs,
    shot_index: shotIndex,
  });
}

async function processIngest(prep, env) {
  const shotIndex = await insertShot(prep, env);
  if (env.SHOT_HUB) {
    try {
      await broadcastShot(buildHubMessage(prep, shotIndex), env);
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
    `INSERT OR IGNORE INTO shots (id, created_at, shot_ms, brew_counter, avg_ms, shot_index, payload)
     VALUES (
       ?, ?, ?, ?, ?,
       COALESCE((
         SELECT MAX(s.shot_index) + 1
         FROM shots s
         WHERE date(s.created_at / 1000, 'unixepoch', ?) = date(? / 1000, 'unixepoch', ?)
       ), 1),
       ?
     )`
  ).bind(
    prep.id,
    prep.createdAtMs,
    prep.shotMs,
    prep.brewCounter,
    prep.avgMs,
    DAY_TZ_OFFSET,
    prep.createdAtMs,
    DAY_TZ_OFFSET,
    prep.payloadJson
  ).run();
  const row = await env.DB.prepare("SELECT shot_index FROM shots WHERE id = ?").bind(prep.id).first();
  const shotIndex = Number(row && row.shot_index);
  return Number.isFinite(shotIndex) ? shotIndex : null;
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
