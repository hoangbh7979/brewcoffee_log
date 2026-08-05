import { CLIENT_SCRIPT } from "./page-client.js";

const TARGET_MS = 25_000;

export function renderHomePage(model = {}) {
  const shots = model.shots || null;
  const analysis = model.analysis || null;
  const rowsHtml = shots ? renderShotRows(shots.data) : '<tr class="loading-row"><td colspan="6"><span class="loading-line"></span></td></tr>';
  const selectedDate = shots && shots.selected_date ? shots.selected_date : "";
  const selectedBucket = shots && shots.bucket ? shots.bucket : "all";
  const shotTotal = shots ? Number(shots.total) || 0 : 0;
  const daySummary = shots && shots.day_summary ? shots.day_summary : { total: 0, consistency_percent: 0 };
  const analysisWindow = analysis && analysis.window ? analysis.window : { min_date: "", max_date: "" };
  const analysisRange = analysis && analysis.range ? analysis.range : { start_date: "", end_date: "" };
  const scriptNonce = escapeHtml(model.nonce || "");
  const latestShot = shots && shots.data && shots.data[0] ? formatShot(shots.data[0].shot_ms) : "--.--s";
  const analysisTotal = analysis ? Number(analysis.total) || 0 : 0;
  const analysisAverage = analysis ? formatShot(analysis.average_ms) : "—";
  const consistency30d = analysis ? Number(analysis.consistency_30d_percent) || 0 : 0;
  const html = `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="theme-color" content="#0b0a09">
  <meta name="description" content="A refined realtime shot log for the Casadio Undici espresso machine.">
  <title>BrewLedger — Casadio Shot Log</title>
  <link rel="stylesheet" href="/assets/app.css?v=history1">
</head>
<body>
  <div class="ambient ambient-one" aria-hidden="true"></div>
  <div class="ambient ambient-two" aria-hidden="true"></div>

  <header class="site-header" id="top">
    <nav class="nav-shell" aria-label="Primary navigation">
      <a class="brand" href="#overview" aria-label="BrewLedger home">
        <span class="brand-symbol" aria-hidden="true">◒</span>
        <span>BrewLedger</span>
      </a>
      <div class="nav-links">
        <a href="#overview" data-nav="overview">Overview</a>
        <a href="#shot-log" data-nav="shot-log">Shot Log</a>
        <a href="#analysis" data-nav="analysis">Analysis</a>
      </div>
      <div class="live-pill" id="livePill" data-state="connecting" aria-live="polite">
        <span class="live-dot"></span>
        <span id="liveStatus">Connecting</span>
      </div>
    </nav>
  </header>

  <main>
    <section class="hero section-anchor" id="overview">
      <div class="hero-copy reveal">
        <div class="micro-pill"><span>○</span> Live coffee intelligence <span>→</span></div>
        <h1>Every shot tells<br><em>a story.</em></h1>
        <p>Track every extraction, understand your rhythm, and make each cup more consistent than the last.</p>
        <div class="hero-actions">
          <a class="button button-light" href="#shot-log">View today’s log <span>→</span></a>
          <a class="button button-ghost" href="#analysis">Open analysis <span>↗</span></a>
        </div>
      </div>

      <div class="hero-visual reveal" aria-label="Live brew summary">
        <div class="brew-orbit" aria-hidden="true">
          <span class="orbit orbit-one"></span>
          <span class="orbit orbit-two"></span>
          <span class="orbit-core">25<small>sec</small></span>
        </div>
        <div class="floating-card floating-top">
          <span>Latest extraction</span>
          <strong id="heroLatest">${latestShot}</strong>
        </div>
        <div class="floating-card floating-bottom">
          <span>30-day consistency</span>
          <strong id="heroConsistency">${consistency30d}%</strong>
        </div>
      </div>

      <div class="hero-metrics reveal">
        <article><span>Total / analysis range</span><strong id="metricTotal">${analysisTotal}</strong></article>
        <article><span>Average time</span><strong id="metricAverage">${analysisAverage}</strong></article>
        <article><span>Selected date</span><strong id="metricSelectedDate">${formatDateCompact(selectedDate)}</strong><small id="metricSelectedCount">${Number(daySummary.total) || 0} shots</small></article>
        <article><span>Daily consistency</span><strong id="metricDailyConsistency">${Number(daySummary.consistency_percent) || 0}%</strong></article>
      </div>
    </section>

    <section class="log-section section-anchor" id="shot-log">
      <div class="section-heading reveal">
        <div>
          <p class="eyebrow">◫ Daily archive</p>
          <h2>Your recent extractions</h2>
          <p>Select a date to view every extraction recorded on that day.</p>
        </div>
        ${renderDateControls(selectedDate, shots && shots.window, selectedBucket)}
      </div>
      <script nonce="${scriptNonce}">(()=>{const f=document.getElementById("dateForm"),i=document.getElementById("dateInput");if(f&&i)i.addEventListener("change",()=>f.requestSubmit?f.requestSubmit():f.submit());})();</script>

      <div class="panel table-panel reveal">
        <div class="table-toolbar">
          <div class="filter-chips" id="filterChips" aria-label="Filter by extraction time">
            ${renderFilterButtons(selectedBucket, selectedDate)}
          </div>
          <span class="result-count" id="resultCount">${shotTotal} ${selectedBucket === "all" ? "shots" : "filtered shots"}</span>
        </div>

        <div class="table-wrap">
          <table>
            <thead>
              <tr>
                <th scope="col">Brew</th>
                <th scope="col">Time</th>
                <th scope="col">Extraction</th>
                <th scope="col">Delta</th>
                <th scope="col">Classification</th>
                <th scope="col"><span class="sr-only">Open details</span></th>
              </tr>
            </thead>
            <tbody id="shotsTable">${rowsHtml}</tbody>
          </table>
        </div>

      </div>
    </section>

    <section class="analysis-section section-anchor" id="analysis">
      <div class="section-heading reveal">
        <div>
          <p class="eyebrow">◌ Performance map</p>
          <h2>Extraction analysis</h2>
          <p>Explore daily averages across any date range stored in D1.</p>
        </div>
        <div class="analysis-date-controls" aria-label="Analysis date range">
          <label><span>From</span><input id="analysisStart" type="date" value="${analysisRange.start_date}" min="${analysisWindow.min_date}" max="${analysisWindow.max_date}"></label>
          <span class="range-arrow" aria-hidden="true">→</span>
          <label><span>To</span><input id="analysisEnd" type="date" value="${analysisRange.end_date}" min="${analysisWindow.min_date}" max="${analysisWindow.max_date}"></label>
          <button class="icon-button" id="analysisAll" type="button" aria-label="Show all history" title="Show all history">↺</button>
        </div>
      </div>

      <p class="analysis-period" id="analysisPeriod">${renderAnalysisPeriod(analysis)}</p>

      <div class="analysis-grid">
        <div class="panel distribution-panel reveal">
          <div class="panel-title">
            <div><span>Shot distribution</span><strong id="distributionTotal">${analysisTotal} extractions</strong></div>
            <span class="panel-symbol">↗</span>
          </div>
          <div class="distribution-list" id="distributionList">${renderDistribution(analysis, selectedDate)}</div>
          <p class="interaction-hint">Select a range to filter the currently selected day.</p>
        </div>

        <div class="panel trend-panel reveal">
          <div class="panel-title">
            <div><span>Daily rhythm</span><strong>Average extraction time</strong></div>
            <span class="target-legend"><i></i> 25s target</span>
          </div>
          <div class="chart-shell" id="chartShell">
            <div class="trend-chart" id="trendChart" role="img" aria-label="Daily average extraction time chart">${renderTrendChart(analysis)}</div>
          </div>
        </div>
      </div>
    </section>
  </main>

  <footer>
    <a class="brand footer-brand" href="#top"><span class="brand-symbol">◒</span><span>BrewLedger</span></a>
    <p>Casadio Undici · Live on Cloudflare</p>
    <a href="#top">Back to top ↑</a>
  </footer>

  <dialog class="shot-dialog" id="shotDialog" aria-labelledby="dialogTitle">
    <button class="dialog-close" id="dialogClose" type="button" aria-label="Close details">×</button>
    <p class="eyebrow">Extraction detail</p>
    <h2 id="dialogTitle">Brew <span id="dialogBrew">—</span></h2>
    <div class="dialog-time" id="dialogTime">--.--s</div>
    <div class="dialog-grid">
      <div><span>Recorded</span><strong id="dialogRecorded">—</strong></div>
      <div><span>Target delta</span><strong id="dialogDelta">—</strong></div>
      <div><span>Average</span><strong id="dialogAverage">—</strong></div>
      <div><span>Class</span><strong id="dialogClass">—</strong></div>
    </div>
  </dialog>

  <template id="initialState">${escapeHtml(JSON.stringify({ shots, analysis }))}</template>
  <div class="toast" id="toast" role="status" aria-live="polite"></div>
  <script nonce="${scriptNonce}">${CLIENT_SCRIPT}</script>
</body>
</html>`;

  return new Response(html, {
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "no-store, no-cache, must-revalidate",
    },
  });
}

function renderShotRows(rows) {
  if (!Array.isArray(rows) || rows.length === 0) {
    return '<tr><td class="empty-state" colspan="6">No extractions were recorded on this day.</td></tr>';
  }
  return rows.map((row) => {
    const bucket = bucketInfo(row.shot_ms);
    const delta = deltaInfo(row.shot_ms);
    const brew = Number.isFinite(Number(row.brew_counter)) ? `#${Math.trunc(Number(row.brew_counter))}` : "—";
    return `<tr>
      <td><span class="brew-number">${escapeHtml(brew)}</span></td>
      <td>${formatClock(row.created_at)}</td>
      <td><span class="shot-value">${formatShot(row.shot_ms)}</span></td>
      <td><span class="delta ${delta.className}">${delta.text}</span></td>
      <td><span class="class-tag ${isConsistentShot(row.shot_ms) ? "target" : ""}">${bucket.name}</span></td>
      <td><span class="row-arrow" aria-hidden="true">↗</span></td>
    </tr>`;
  }).join("");
}

function renderDateControls(selectedDate, dateWindow, bucket) {
  const window = dateWindow || { min_date: selectedDate, max_date: selectedDate };
  const previous = shiftDateText(selectedDate, -1);
  const next = shiftDateText(selectedDate, 1);
  const previousDisabled = !previous || previous < window.min_date;
  const nextDisabled = !next || next > window.max_date;
  const dateHref = (date) => `/?${encodeURIComponent("date")}=${encodeURIComponent(date)}&${encodeURIComponent("bucket")}=${encodeURIComponent(bucket)}#shot-log`;
  const link = (date, label, disabled) => disabled
    ? `<span class="icon-button disabled" aria-disabled="true">${label}</span>`
    : `<a class="icon-button" href="${escapeHtml(dateHref(date))}" aria-label="${label === "‹" ? "Previous day" : "Next day"}">${label}</a>`;
  return `<form class="date-controls" id="dateForm" method="get" action="/">
    ${link(previous, "‹", previousDisabled)}
    <label class="date-picker">
      <span aria-hidden="true">◷</span>
      <input id="dateInput" name="date" type="date" aria-label="Select shot date" value="${escapeHtml(selectedDate)}" min="${escapeHtml(window.min_date || "")}" max="${escapeHtml(window.max_date || "")}" required>
    </label>
    <input type="hidden" name="bucket" value="${escapeHtml(bucket)}">
    <button class="icon-button date-submit" type="submit" aria-label="Apply selected date">↵</button>
    ${link(next, "›", nextDisabled)}
  </form>`;
}

function shiftDateText(dateText, days) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(dateText || ""))) return "";
  const [year, month, day] = dateText.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day + days)).toISOString().slice(0, 10);
}

function renderFilterButtons(selected, selectedDate) {
  const filters = [
    ["all", "All"],
    ["under20", "&lt;20s"],
    ["20to25", "20–25s"],
    ["25to28", "25–28s"],
    ["28to30", "28–30s"],
    ["over30", "&gt;30s"],
  ];
  return filters.map(([key, label]) => {
    const query = `/?date=${encodeURIComponent(selectedDate)}&bucket=${encodeURIComponent(key)}#shot-log`;
    return `<a class="chip${key === selected ? " active" : ""}" data-filter="${key}" href="${escapeHtml(query)}">${label}</a>`;
  }).join("");
}

function renderDistribution(analysis, selectedDate) {
  const buckets = analysis && analysis.buckets ? analysis.buckets : {};
  const total = analysis ? Number(analysis.total) || 0 : 0;
  const definitions = [
    ["under20", "&lt;20s", "#899eb7"],
    ["20to25", "20–25s", "#b49f82"],
    ["25to28", "25–28s", "#92b79c"],
    ["28to30", "28–30s", "#c99b64"],
    ["over30", "&gt;30s", "#d08c7d"],
  ];
  return definitions.map(([key, label, color]) => {
    const count = Number(buckets[key]) || 0;
    const width = total > 0 ? Math.max(count > 0 ? 3 : 0, count * 100 / total) : 0;
    const query = `/?date=${encodeURIComponent(selectedDate || "")}&bucket=${encodeURIComponent(key)}#shot-log`;
    return `<a class="distribution-row" data-bucket="${key}" href="${escapeHtml(query)}">
      <span class="distribution-label">${label}</span>
      <span class="bar-track"><i class="bar-fill" style="width:${width.toFixed(1)}%;background:${color}"></i></span>
      <strong class="distribution-value">${count}</strong>
    </a>`;
  }).join("");
}

function renderAnalysisPeriod(analysis) {
  if (!analysis || !analysis.range) return "No analysis range available";
  const range = analysis.range;
  const window = analysis.window || {};
  const allHistory = range.start_date === window.min_date && range.end_date === window.max_date;
  const label = allHistory ? "All history" : "Selected range";
  return `${label} · ${formatDateLabel(range.start_date)} → ${formatDateLabel(range.end_date)} · ${Number(analysis.total) || 0} shots · ${Number(analysis.consistency_percent) || 0}% consistent at 24–27s`;
}

function renderTrendChart(analysis) {
  const rows = analysis && Array.isArray(analysis.daily)
    ? analysis.daily.filter((row) => Number.isFinite(Number(row.average_ms)))
    : [];
  if (rows.length === 0) {
    return '<p class="chart-empty">No analysis data in this date range.</p>';
  }

  const width = 720;
  const height = 320;
  const pad = { top: 20, right: 18, bottom: 38, left: 46 };
  const plotWidth = width - pad.left - pad.right;
  const plotHeight = height - pad.top - pad.bottom;
  const seconds = rows.map((row) => Number(row.average_ms) / 1000);
  const minY = Math.max(0, Math.floor(Math.min(20, ...seconds) - 2));
  const maxY = Math.ceil(Math.max(30, ...seconds) + 2);
  const xFor = (index) => pad.left + (rows.length === 1 ? plotWidth / 2 : index * plotWidth / (rows.length - 1));
  const yFor = (value) => pad.top + (maxY - value) * plotHeight / Math.max(1, maxY - minY);
  const points = rows.map((row, index) => ({
    x: xFor(index),
    y: yFor(Number(row.average_ms) / 1000),
    row,
  }));
  const linePath = points.map((point, index) => `${index === 0 ? "M" : "L"}${point.x.toFixed(2)} ${point.y.toFixed(2)}`).join(" ");
  const lastPoint = points[points.length - 1];
  const areaPath = rows.length > 1
    ? `${linePath} L${lastPoint.x.toFixed(2)} ${height - pad.bottom} L${points[0].x.toFixed(2)} ${height - pad.bottom} Z`
    : "";
  const grid = Array.from({ length: 5 }, (_, index) => {
    const value = minY + (maxY - minY) * index / 4;
    const y = yFor(value);
    return `<g><line class="trend-grid" x1="${pad.left}" y1="${y.toFixed(2)}" x2="${width - pad.right}" y2="${y.toFixed(2)}"></line><text class="trend-axis" x="${pad.left - 9}" y="${(y + 3).toFixed(2)}" text-anchor="end">${value.toFixed(0)}s</text></g>`;
  }).join("");
  const labelIndexes = Array.from(new Set([0, Math.floor((rows.length - 1) / 2), rows.length - 1]));
  const labels = labelIndexes.map((index) => {
    const anchor = index === 0 ? "start" : index === rows.length - 1 ? "end" : "middle";
    return `<text class="trend-axis" x="${points[index].x.toFixed(2)}" y="${height - 10}" text-anchor="${anchor}">${escapeHtml(formatDateLabel(rows[index].date))}</text>`;
  }).join("");
  const dots = points.map((point) =>
    `<circle class="trend-point" cx="${point.x.toFixed(2)}" cy="${point.y.toFixed(2)}" r="4"><title>${escapeHtml(formatDateLabel(point.row.date))} · ${Number(point.row.count) || 0} shots · ${formatShot(point.row.average_ms)} average · ${Number(point.row.consistency_percent) || 0}% consistent</title></circle>`
  ).join("");
  const bandTop = yFor(27);
  const bandBottom = yFor(24);

  return `<svg viewBox="0 0 ${width} ${height}" aria-hidden="true">
    <defs><linearGradient id="trendGradient" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#c99b64" stop-opacity=".3"></stop><stop offset="1" stop-color="#c99b64" stop-opacity="0"></stop></linearGradient></defs>
    <rect class="consistency-band" x="${pad.left}" y="${bandTop.toFixed(2)}" width="${plotWidth}" height="${(bandBottom - bandTop).toFixed(2)}"></rect>
    ${grid}
    <line class="target-line" x1="${pad.left}" y1="${yFor(25).toFixed(2)}" x2="${width - pad.right}" y2="${yFor(25).toFixed(2)}"></line>
    ${areaPath ? `<path class="trend-area" d="${areaPath}"></path>` : ""}
    <path class="trend-line" d="${linePath}"></path>
    ${dots}
    ${labels}
  </svg>`;
}

function bucketInfo(ms) {
  const value = Number(ms);
  if (value < 20_000) return { key: "under20", name: "Very fast" };
  if (value < 25_000) return { key: "20to25", name: "Fast" };
  if (value < 28_000) return { key: "25to28", name: "In range" };
  if (value <= 30_000) return { key: "28to30", name: "Slow" };
  return { key: "over30", name: "Very slow" };
}

function isConsistentShot(ms) {
  const value = Number(ms);
  return Number.isFinite(value) && value >= 24_000 && value <= 27_000;
}

function deltaInfo(ms) {
  const delta = (Number(ms) - TARGET_MS) / 1000;
  if (Math.abs(delta) < 0.005) return { text: "On target", className: "" };
  return {
    text: `${delta > 0 ? "+" : "−"}${Math.abs(delta).toFixed(2)}s`,
    className: delta > 0 ? "positive" : "negative",
  };
}

function formatShot(ms) {
  const value = Number(ms);
  return Number.isFinite(value) ? `${(value / 1000).toFixed(2)}s` : "--.--s";
}

function formatClock(ms) {
  const date = new Date(Number(ms) + 7 * 60 * 60 * 1000);
  if (!Number.isFinite(date.getTime())) return "—";
  return `${String(date.getUTCHours()).padStart(2, "0")}:${String(date.getUTCMinutes()).padStart(2, "0")}:${String(date.getUTCSeconds()).padStart(2, "0")}`;
}

function formatDateLabel(dateText) {
  if (!dateText) return "—";
  const parts = dateText.split("-");
  return parts.length === 3 ? `${parts[2]}/${parts[1]}/${parts[0]}` : dateText;
}

function formatDateCompact(dateText) {
  if (!dateText) return "—";
  const parts = dateText.split("-");
  if (parts.length !== 3) return dateText;
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  return `${parts[2]} ${months[Number(parts[1]) - 1] || parts[1]}`;
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}
