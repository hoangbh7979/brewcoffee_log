import { CLIENT_SCRIPT } from "./page-client.js";

const TARGET_MS = 25_000;
const ASSET_VERSION = "header-logo1";

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
  const chartMode = model.view === "daily" ? "daily" : "shots";
  const html = `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="theme-color" content="#0b0a09">
  <meta name="description" content="A refined realtime shot log for the Casadio Undici espresso machine.">
  <title>BrewLedger — Casadio Shot Log</title>
  <link rel="icon" type="image/png" sizes="1024x1024" href="/favicon_logo2_transparent.png?v=7">
  <link rel="icon" type="image/x-icon" href="/favicon.ico?v=7" sizes="any">
  <link rel="shortcut icon" type="image/png" href="/favicon_logo2_transparent.png?v=7">
  <link rel="apple-touch-icon" sizes="1024x1024" href="/favicon_logo2_transparent.png?v=7">
  <link rel="stylesheet" href="/assets/app.css?v=${ASSET_VERSION}">
</head>
<body>
  <div class="ambient ambient-one" aria-hidden="true"></div>
  <div class="ambient ambient-two" aria-hidden="true"></div>
  <header class="site-header" id="top">
    <div class="header-layout">
      <nav class="nav-shell" aria-label="Primary navigation">
        <a class="header-brand" href="#overview" aria-label="UT-TAM Brew Coffee home">
          <img src="/ut_tam_logo_dark.png" width="152" height="100" alt="UT-TAM Brew Coffee">
        </a>
        <div class="nav-links">
          <a href="#overview" data-nav="overview">Overview</a>
          <a href="#shot-log" data-nav="shot-log">Shot Log</a>
          <a href="#analysis" data-nav="analysis">Analysis</a>
        </div>
        <div class="live-pill" id="livePill" data-state="booting" aria-live="polite">
          <span class="live-dot"></span>
          <span id="liveStatus">Starting</span>
        </div>
      </nav>
    </div>
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
        <div class="brand-planet" role="img" aria-label="Espresso extraction target visual">
          <span class="planet-ring planet-ring-one"></span>
          <span class="planet-ring planet-ring-two"></span>
          <span class="planet-satellite planet-satellite-one"></span>
          <span class="planet-satellite planet-satellite-two"></span>
          <span class="planet-core" aria-hidden="true"><b>25</b><small>sec<br>target</small></span>
          <span class="planet-readout">25<small>s target</small></span>
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
        ${renderPagination(shots)}

      </div>
    </section>

    <section class="analysis-section section-anchor" id="analysis">
      <div class="section-heading reveal">
        <div>
          <p class="eyebrow">◌ Performance map</p>
          <h2>Extraction analysis</h2>
          <p>Explore daily averages across any date range stored in D1.</p>
        </div>
        ${renderAnalysisControls(analysisRange, analysisWindow, selectedDate, selectedBucket, chartMode, shots && shots.pagination && shots.pagination.page)}
      </div>
      <script nonce="${scriptNonce}">(()=>{const f=document.getElementById("analysisDateForm");if(f)f.querySelectorAll('input[type="date"]').forEach(i=>i.addEventListener("change",()=>f.requestSubmit?f.requestSubmit():f.submit()));})();</script>

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

        <div class="panel mix-panel reveal">
          <div class="panel-title">
            <div><span>Bucket mix</span><strong>Share by extraction time</strong></div>
            <span class="panel-symbol">◔</span>
          </div>
          <div class="bucket-mix" id="bucketMix">${renderBucketMix(analysis)}</div>
        </div>

        <div class="panel trend-panel reveal">
          <div class="panel-title">
            <div><span>Daily rhythm</span><strong>Average extraction time</strong></div>
            <div class="chart-tools">
              ${renderChartModeControls(chartMode, selectedDate, selectedBucket, analysisRange, shots && shots.pagination && shots.pagination.page)}
              <span class="target-legend"><i></i> 25s target</span>
            </div>
          </div>
          <div class="chart-shell" id="chartShell">
            <div class="trend-chart" id="trendChart" role="img" aria-label="Daily average extraction time chart">${renderTrendChart(analysis, chartMode)}</div>
          </div>
          <p class="chart-scroll-hint" aria-hidden="true"><span>←</span> Swipe horizontally to explore the chart <span>→</span></p>
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
  <script nonce="${scriptNonce}">(()=>{const fail=(kind,detail)=>{const pill=document.getElementById("livePill"),label=document.getElementById("liveStatus");if(!pill||!label)return;const text=String(detail||kind).slice(0,96);pill.dataset.state="error";pill.dataset.event=kind;label.textContent="Client error · "+text;pill.title="Realtime bootstrap: "+text;};window.addEventListener("error",event=>fail("error",event.message||(event.error&&event.error.message)));window.addEventListener("unhandledrejection",event=>fail("rejection",event.reason&&(event.reason.message||event.reason)));})();</script>
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

function renderPagination(shots) {
  const total = Number(shots && shots.total) || 0;
  const meta = shots && shots.pagination ? shots.pagination : {};
  const pageSize = Math.max(1, Number(meta.page_size) || 12);
  const pageCount = Math.max(1, Number(meta.page_count) || Math.ceil(total / pageSize) || 1);
  const page = Math.min(pageCount, Math.max(1, Number(meta.page) || 1));
  const start = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const end = Math.min(total, page * pageSize);
  const summary = total === 0
    ? "No shots on this day"
    : `Showing ${start}\u2013${end} of ${total} shots`;
  if (total === 0 || pageCount === 1) {
    return `<div class="pagination-shell${total === 0 ? " is-empty" : ""}" id="pagination"><span class="page-summary" id="pageSummary">${summary}</span></div>`;
  }

  const hrefFor = (targetPage) => {
    const params = new URLSearchParams();
    params.set("date", shots.selected_date || "");
    if (shots.bucket && shots.bucket !== "all") params.set("bucket", shots.bucket);
    if (targetPage > 1) params.set("page", String(targetPage));
    return `/${params.toString() ? `?${params.toString()}` : ""}#shot-log`;
  };
  const control = (targetPage, label, direction) => targetPage < 1 || targetPage > pageCount
    ? `<span class="page-button disabled" aria-disabled="true"><span aria-hidden="true">${label}</span><span class="sr-only">${direction} page</span></span>`
    : `<a class="page-button" href="${escapeHtml(hrefFor(targetPage))}" aria-label="${direction} page"><span aria-hidden="true">${label}</span></a>`;
  const pages = paginationItems(page, pageCount).map((item) => item === "ellipsis"
    ? '<span class="page-ellipsis" aria-hidden="true">\u2026</span>'
    : `<a class="page-number${item === page ? " active" : ""}" href="${escapeHtml(hrefFor(item))}"${item === page ? ' aria-current="page"' : ""}>${item}</a>`
  ).join("");
  return `<nav class="pagination-shell" id="pagination" aria-label="Shot log pages">
    <span class="page-summary" id="pageSummary">${summary}</span>
    <div class="pagination-controls">
      ${control(page - 1, "‹", "Previous")}
      <span class="page-numbers">${pages}</span>
      ${control(page + 1, "›", "Next")}
    </div>
  </nav>`;
}

function paginationItems(page, pageCount) {
  if (pageCount <= 7) return Array.from({ length: pageCount }, (_, index) => index + 1);
  const visible = page <= 4
    ? [1, 2, 3, 4, 5, "ellipsis", pageCount]
    : page >= pageCount - 3
      ? [1, "ellipsis", pageCount - 4, pageCount - 3, pageCount - 2, pageCount - 1, pageCount]
      : [1, "ellipsis", page - 1, page, page + 1, "ellipsis", pageCount];
  return visible;
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

function renderAnalysisControls(range, dateWindow, selectedDate, bucket, chartMode = "shots", selectedPage = 1) {
  const safeRange = range || { start_date: "", end_date: "" };
  const safeWindow = dateWindow || { min_date: "", max_date: "" };
  const resetParams = new URLSearchParams();
  if (selectedDate) resetParams.set("date", selectedDate);
  if (bucket && bucket !== "all") resetParams.set("bucket", bucket);
  if (Number(selectedPage) > 1) resetParams.set("page", String(selectedPage));
  resetParams.set("analysis_all", "1");
  if (chartMode === "daily") resetParams.set("view", "daily");
  const resetHref = "/" + (resetParams.toString() ? "?" + resetParams.toString() : "") + "#analysis";
  return `<form class="analysis-date-controls" id="analysisDateForm" method="get" action="/#analysis">
    <input type="hidden" name="date" value="${escapeHtml(selectedDate)}">
    <input type="hidden" name="bucket" value="${escapeHtml(bucket || "all")}">
    <input type="hidden" name="page" value="${escapeHtml(Number(selectedPage) > 1 ? String(selectedPage) : "")}">
    <input type="hidden" name="view" value="${escapeHtml(chartMode)}">
    <label><span>From</span><input id="analysisStart" name="analysis_start" type="date" value="${escapeHtml(safeRange.start_date)}" min="${escapeHtml(safeWindow.min_date)}" max="${escapeHtml(safeWindow.max_date)}" required></label>
    <span class="range-arrow" aria-hidden="true">→</span>
    <label><span>To</span><input id="analysisEnd" name="analysis_end" type="date" value="${escapeHtml(safeRange.end_date)}" min="${escapeHtml(safeWindow.min_date)}" max="${escapeHtml(safeWindow.max_date)}" required></label>
    <button class="icon-button date-submit" type="submit" aria-label="Apply analysis date range" title="Apply analysis date range">↵</button>
    <a class="icon-button" id="analysisAll" href="${escapeHtml(resetHref)}" aria-label="Show all history" title="Show all history">↺</a>
  </form>`;
}

function renderChartModeControls(chartMode, selectedDate, bucket, range, selectedPage = 1) {
  const safeRange = range || { start_date: "", end_date: "" };
  const hrefFor = (view) => {
    const params = new URLSearchParams();
    if (selectedDate) params.set("date", selectedDate);
    if (bucket && bucket !== "all") params.set("bucket", bucket);
    if (Number(selectedPage) > 1) params.set("page", String(selectedPage));
    if (safeRange.start_date) params.set("analysis_start", safeRange.start_date);
    if (safeRange.end_date) params.set("analysis_end", safeRange.end_date);
    if (view === "daily") params.set("view", "daily");
    return `/${params.toString() ? `?${params.toString()}` : ""}#analysis`;
  };
  const option = (view, label) => `<a class="chart-mode-link${chartMode === view ? " active" : ""}" href="${escapeHtml(hrefFor(view))}"${chartMode === view ? ' aria-current="page"' : ""}><i aria-hidden="true"></i><span>${label}</span></a>`;
  return `<div class="chart-mode" aria-label="Chart view">${option("shots", "By shot")}${option("daily", "By day")}</div>`;
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

function renderBucketMix(analysis) {
  const buckets = analysis && analysis.buckets ? analysis.buckets : {};
  const total = analysis ? Number(analysis.total) || 0 : 0;
  const cx = 132;
  const cy = 122;
  const outerRadius = 104;
  const innerRadius = 54;
  let angle = -90;
  const segments = [
    ["under20", "<20s", "#899eb7"],
    ["20to25", "20–25s", "#b49f82"],
    ["25to28", "25–28s", "#92b79c"],
    ["28to30", "28–30s", "#c99b64"],
    ["over30", ">30s", "#d08c7d"],
  ].map(([key, label, color], index) => {
    const count = Number(buckets[key]) || 0;
    const span = total > 0 ? count / total * 360 : 0;
    const start = angle;
    const end = angle + Math.min(span, 359.99);
    angle = end;
    return { index, key, label, color, count, start, end, span };
  });
  const slices = segments.map(({ index, key, label, count, start, end, span }) => {
    if (span <= 0) return "";
    const percent = total > 0 ? Math.round(count * 100 / total) : 0;
    return `<path class="pie-slice slice-${key}" style="--slice-delay:${index * 70}ms" d="${pieSlicePath(cx, cy, outerRadius, innerRadius, start, end)}" fill="url(#donut-slice-${key})"><title>${escapeHtml(label)} · ${count} shots · ${percent}%</title></path>`;
  }).join("");
  const labels = segments.map(({ count, start, span }) => {
    const percent = total > 0 ? Math.round(count * 100 / total) : 0;
    if (span <= 0 || percent < 8) return "";
    const mid = start + span / 2;
    const point = polarPoint(cx, cy, (outerRadius + innerRadius) / 2, mid);
    return `<text class="pie-slice-label" x="${point.x.toFixed(2)}" y="${(point.y + 3).toFixed(2)}" text-anchor="middle">${percent}%</text>`;
  }).join("");
  const legend = segments.map(({ label, color, count }) => {
    const percent = total > 0 ? Math.round(count * 100 / total) : 0;
    return `<div class="donut-legend-row"><span><i style="background:${color}"></i>${escapeHtml(label)}</span><strong>${percent}%<small>${count} ${count === 1 ? "shot" : "shots"}</small></strong></div>`;
  }).join("");
  return `<div class="donut-shell">
    <svg class="donut-chart" viewBox="0 0 264 244" role="img" aria-label="Shot distribution by extraction time">
      ${renderDonutDefs()}
      <circle class="donut-aura" cx="${cx}" cy="${cy}" r="124"></circle>
      <circle class="donut-track" cx="${cx}" cy="${cy}" r="${outerRadius}"></circle>
      <g class="donut-slices" filter="url(#donut-depth)">${slices}</g>
      ${labels}
      <circle class="donut-rim" cx="${cx}" cy="${cy}" r="${outerRadius}"></circle>
      <circle class="donut-hole" cx="${cx}" cy="${cy}" r="${innerRadius}"></circle>
      <circle class="donut-hole-ring" cx="${cx}" cy="${cy}" r="${innerRadius - 4}"></circle>
      <text class="donut-total" x="${cx}" y="${cy - 3}" text-anchor="middle">${total}</text>
      <text class="donut-caption" x="${cx}" y="${cy + 19}" text-anchor="middle">shots</text>
    </svg>
  </div>
  <div class="donut-legend">${legend}</div>`;
}

function renderDonutDefs() {
  return `<defs>
    <radialGradient id="donut-aura" cx="50%" cy="45%" r="65%"><stop offset="0" stop-color="#c99b64" stop-opacity=".22"></stop><stop offset=".52" stop-color="#8b6b4e" stop-opacity=".06"></stop><stop offset="1" stop-color="#171513" stop-opacity="0"></stop></radialGradient>
    <radialGradient id="donut-core" cx="42%" cy="34%" r="76%"><stop offset="0" stop-color="#302a25"></stop><stop offset=".72" stop-color="#171513"></stop><stop offset="1" stop-color="#0e0d0c"></stop></radialGradient>
    <linearGradient id="donut-slice-under20" x1=".1" y1="0" x2=".92" y2="1"><stop offset="0" stop-color="#c6d6e8"></stop><stop offset=".54" stop-color="#899eb7"></stop><stop offset="1" stop-color="#5d7692"></stop></linearGradient>
    <linearGradient id="donut-slice-20to25" x1=".1" y1="0" x2=".92" y2="1"><stop offset="0" stop-color="#e5d3b6"></stop><stop offset=".54" stop-color="#b49f82"></stop><stop offset="1" stop-color="#84745e"></stop></linearGradient>
    <linearGradient id="donut-slice-25to28" x1=".1" y1="0" x2=".92" y2="1"><stop offset="0" stop-color="#c0dec5"></stop><stop offset=".54" stop-color="#92b79c"></stop><stop offset="1" stop-color="#668d72"></stop></linearGradient>
    <linearGradient id="donut-slice-28to30" x1=".1" y1="0" x2=".92" y2="1"><stop offset="0" stop-color="#ecc998"></stop><stop offset=".54" stop-color="#c99b64"></stop><stop offset="1" stop-color="#9c7044"></stop></linearGradient>
    <linearGradient id="donut-slice-over30" x1=".1" y1="0" x2=".92" y2="1"><stop offset="0" stop-color="#ebbbb2"></stop><stop offset=".54" stop-color="#d08c7d"></stop><stop offset="1" stop-color="#9e5e55"></stop></linearGradient>
    <filter id="donut-depth" x="-25%" y="-25%" width="150%" height="160%"><feDropShadow dx="0" dy="8" stdDeviation="7" flood-color="#000" flood-opacity=".48"></feDropShadow><feDropShadow dx="0" dy="1" stdDeviation="1" flood-color="#fff" flood-opacity=".14"></feDropShadow></filter>
  </defs>`;
}

function polarPoint(cx, cy, radius, angle) {
  const radians = angle * Math.PI / 180;
  return { x: cx + radius * Math.cos(radians), y: cy + radius * Math.sin(radians) };
}

function pieSlicePath(cx, cy, outerRadius, innerRadius, start, end) {
  const outerStart = polarPoint(cx, cy, outerRadius, start);
  const outerEnd = polarPoint(cx, cy, outerRadius, end);
  const innerEnd = polarPoint(cx, cy, innerRadius, end);
  const innerStart = polarPoint(cx, cy, innerRadius, start);
  const large = end - start > 180 ? 1 : 0;
  return `M${outerStart.x.toFixed(2)} ${outerStart.y.toFixed(2)} A${outerRadius} ${outerRadius} 0 ${large} 1 ${outerEnd.x.toFixed(2)} ${outerEnd.y.toFixed(2)} L${innerEnd.x.toFixed(2)} ${innerEnd.y.toFixed(2)} A${innerRadius} ${innerRadius} 0 ${large} 0 ${innerStart.x.toFixed(2)} ${innerStart.y.toFixed(2)} Z`;
}

function renderAnalysisPeriod(analysis) {
  if (!analysis || !analysis.range) return "No analysis range available";
  const range = analysis.range;
  const window = analysis.window || {};
  const allHistory = range.start_date === window.min_date && range.end_date === window.max_date;
  const label = allHistory ? "All history" : "Selected range";
  return `${label} · ${formatDateLabel(range.start_date)} → ${formatDateLabel(range.end_date)} · ${Number(analysis.total) || 0} shots · ${Number(analysis.consistency_percent) || 0}% consistent at 24–27s`;
}

function renderTrendChart(analysis, mode = "shots") {
  if (mode === "shots") return renderShotScatterChart(analysis);
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
    `<circle class="trend-point" cx="${point.x.toFixed(2)}" cy="${point.y.toFixed(2)}" r="${rows.length === 1 ? 6 : 4}"><title>${escapeHtml(formatDateLabel(point.row.date))} · ${Number(point.row.count) || 0} shots · ${formatShot(point.row.average_ms)} average · ${Number(point.row.consistency_percent) || 0}% consistent</title></circle>`
  ).join("");
  const bandTop = yFor(27);
  const bandBottom = yFor(24);
  const singleDayLabel = rows.length === 1
    ? `<text class="trend-single-value" x="${width / 2}" y="${pad.top + 25}" text-anchor="middle">${formatShot(rows[0].average_ms)} average · ${Number(rows[0].count) || 0} shots</text>`
    : "";

  return `<svg viewBox="0 0 ${width} ${height}" aria-hidden="true">
    <defs><linearGradient id="trendGradient" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#c99b64" stop-opacity=".3"></stop><stop offset="1" stop-color="#c99b64" stop-opacity="0"></stop></linearGradient></defs>
    <rect class="consistency-band" x="${pad.left}" y="${bandTop.toFixed(2)}" width="${plotWidth}" height="${(bandBottom - bandTop).toFixed(2)}"></rect>
    ${grid}
    <line class="target-line" x1="${pad.left}" y1="${yFor(25).toFixed(2)}" x2="${width - pad.right}" y2="${yFor(25).toFixed(2)}"></line>
    ${areaPath ? `<path class="trend-area" d="${areaPath}"></path>` : ""}
    <path class="trend-line" d="${linePath}"></path>
    ${dots}
    ${labels}
    ${singleDayLabel}
  </svg>`;
}

function renderShotScatterChart(analysis) {
  const points = analysis && Array.isArray(analysis.shot_points)
    ? analysis.shot_points.filter((point) => Number.isFinite(Number(point.created_at)) && Number.isFinite(Number(point.shot_ms)))
    : [];
  if (points.length === 0) return '<p class="chart-empty">No shot data in this date range.</p>';

  const width = 960;
  const height = 370;
  const pad = { top: 24, right: 22, bottom: 46, left: 48 };
  const plotWidth = width - pad.left - pad.right;
  const plotHeight = height - pad.top - pad.bottom;
  const xFor = (minutes) => pad.left + Math.max(0, Math.min(1, minutes / (23 * 60 + 30))) * plotWidth;
  const yFor = (seconds) => pad.top + (40 - Math.max(0, Math.min(40, seconds))) * plotHeight / 40;
  const yTicks = [0, 10, 20, 30, 40];
  const yGrid = yTicks.map((value) => {
    const y = yFor(value);
    return `<g><line class="scatter-grid" x1="${pad.left}" y1="${y.toFixed(2)}" x2="${width - pad.right}" y2="${y.toFixed(2)}"></line><text class="scatter-axis" x="${pad.left - 10}" y="${(y + 3).toFixed(2)}" text-anchor="end">${value}s</text></g>`;
  }).join("");
  const xTicks = Array.from({ length: 48 }, (_, index) => index * 30);
  const xGrid = xTicks.map((minutes) => {
    const x = xFor(minutes);
    const major = minutes % 60 === 0 || minutes === 1410;
    return `<g><line class="scatter-grid${major ? " major" : ""}" x1="${x.toFixed(2)}" y1="${pad.top}" x2="${x.toFixed(2)}" y2="${height - pad.bottom}"></line>${major ? `<text class="scatter-axis" x="${x.toFixed(2)}" y="${height - 13}" text-anchor="${minutes === 0 ? "start" : minutes === 1410 ? "end" : "middle"}">${formatTimeOfDay(minutes)}</text>` : ""}</g>`;
  }).join("");
  const dots = points.map((point) => {
    const seconds = Number(point.shot_ms) / 1000;
    const minutes = bangkokMinutes(point.created_at);
    const bucket = bucketInfo(point.shot_ms);
    return `<circle class="scatter-point" cx="${xFor(minutes).toFixed(2)}" cy="${yFor(seconds).toFixed(2)}" r="3.4" fill="${bucketColor(bucket.key)}"><title>${escapeHtml(formatTimeOfDay(minutes))} · ${formatShot(point.shot_ms)} · ${escapeHtml(bucket.name)}</title></circle>`;
  }).join("");
  const bandTop = yFor(27);
  const bandBottom = yFor(24);

  return `<svg class="scatter-chart" viewBox="0 0 ${width} ${height}" role="img" aria-label="Shot extraction time by time of day">
    <rect class="consistency-band" x="${pad.left}" y="${bandTop.toFixed(2)}" width="${plotWidth}" height="${(bandBottom - bandTop).toFixed(2)}"></rect>
    ${yGrid}
    ${xGrid}
    <line class="target-line" x1="${pad.left}" y1="${yFor(25).toFixed(2)}" x2="${width - pad.right}" y2="${yFor(25).toFixed(2)}"></line>
    ${dots}
  </svg>`;
}

function bangkokMinutes(timestamp) {
  const shifted = ((Number(timestamp) + 7 * 60 * 60 * 1000) % (24 * 60 * 60 * 1000) + (24 * 60 * 60 * 1000)) % (24 * 60 * 60 * 1000);
  return Math.floor(shifted / 60_000) + (shifted % 60_000) / 60_000;
}

function formatTimeOfDay(minutes) {
  const safe = Math.max(0, Math.min(1439, Math.round(Number(minutes) || 0)));
  return `${String(Math.floor(safe / 60)).padStart(2, "0")}:${String(safe % 60).padStart(2, "0")}`;
}

function bucketColor(key) {
  return {
    under20: "#899eb7",
    "20to25": "#b49f82",
    "25to28": "#92b79c",
    "28to30": "#c99b64",
    over30: "#d08c7d",
  }[key] || "#777168";
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
