import { CLIENT_SCRIPT } from "./page-client.js";

const TARGET_MS = 25_000;

export function renderHomePage(model = {}) {
  const shots = model.shots || null;
  const analysis = model.analysis || null;
  const rowsHtml = shots ? renderShotRows(shots.data) : '<tr class="loading-row"><td colspan="6"><span class="loading-line"></span></td></tr>';
  const page = shots && shots.pagination ? shots.pagination : { page: 1, total: 0, total_pages: 1 };
  const selectedDate = shots && shots.selected_date ? shots.selected_date : "";
  const selectedBucket = shots && shots.bucket ? shots.bucket : "all";
  const scriptNonce = escapeHtml(model.nonce || "");
  const latestShot = shots && shots.data && shots.data[0] ? formatShot(shots.data[0].shot_ms) : "--.--s";
  const analysisTotal = analysis ? Number(analysis.total) || 0 : 0;
  const analysisAverage = analysis ? formatShot(analysis.average_ms) : "—";
  const consistency = analysis ? consistencyPercent(analysis) : 0;
  const html = `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="theme-color" content="#0b0a09">
  <meta name="description" content="A refined realtime shot log for the Casadio Undici espresso machine.">
  <title>BrewLedger — Casadio Shot Log</title>
  <link rel="stylesheet" href="/assets/app.css?v=inline1">
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
          <strong id="heroConsistency">${consistency}%</strong>
        </div>
      </div>

      <div class="hero-metrics reveal">
        <article><span>Total / 30 days</span><strong id="metricTotal">${analysisTotal}</strong></article>
        <article><span>Average time</span><strong id="metricAverage">${analysisAverage}</strong></article>
        <article><span>Selected day</span><strong id="metricSelected">${page.total}</strong></article>
        <article><span>Target range</span><strong>25–28s</strong></article>
      </div>
    </section>

    <section class="log-section section-anchor" id="shot-log">
      <div class="section-heading reveal">
        <div>
          <p class="eyebrow">◫ Daily archive</p>
          <h2>Your recent extractions</h2>
          <p>Browse up to 30 days of brew history.</p>
        </div>
        <div class="date-controls">
          <button class="icon-button" id="previousDay" type="button" aria-label="Previous day">‹</button>
          <label class="date-picker">
            <span aria-hidden="true">◷</span>
            <input id="dateInput" type="date" aria-label="Select shot date" value="${selectedDate}" min="${shots && shots.window ? shots.window.min_date : ""}" max="${shots && shots.window ? shots.window.max_date : ""}">
          </label>
          <button class="icon-button" id="nextDay" type="button" aria-label="Next day">›</button>
        </div>
      </div>

      <div class="panel table-panel reveal">
        <div class="table-toolbar">
          <div class="filter-chips" id="filterChips" aria-label="Filter by extraction time">
            ${renderFilterButtons(selectedBucket)}
          </div>
          <span class="result-count" id="resultCount">${page.total} ${selectedBucket === "all" ? "shots" : "filtered shots"}</span>
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

        <div class="pagination-shell">
          <p id="pageSummary">Page ${page.page} of ${page.total_pages}</p>
          <nav class="pagination" id="pagination" aria-label="Shot log pagination">${renderPagination(page, selectedDate, selectedBucket)}</nav>
        </div>
      </div>
    </section>

    <section class="analysis-section section-anchor" id="analysis">
      <div class="section-heading reveal">
        <div>
          <p class="eyebrow">◌ Performance map</p>
          <h2>Extraction analysis</h2>
          <p>A clear breakdown of every shot from the last 30 days.</p>
        </div>
        <span class="period-pill">Last 30 days</span>
      </div>

      <div class="analysis-grid">
        <div class="panel distribution-panel reveal">
          <div class="panel-title">
            <div><span>Shot distribution</span><strong id="distributionTotal">${analysisTotal} extractions</strong></div>
            <span class="panel-symbol">↗</span>
          </div>
          <div class="distribution-list" id="distributionList">${renderDistribution(analysis)}</div>
          <p class="interaction-hint">Select a range to filter the shot log.</p>
        </div>

        <div class="panel trend-panel reveal">
          <div class="panel-title">
            <div><span>Daily rhythm</span><strong>Average extraction time</strong></div>
            <span class="target-legend"><i></i> 25s target</span>
          </div>
          <div class="chart-shell" id="chartShell">
            <canvas id="trendChart" role="img" aria-label="Daily average extraction time chart"></canvas>
            <div class="chart-tooltip" id="chartTooltip" hidden></div>
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
      <td><span class="class-tag ${bucket.key === "25to28" ? "target" : ""}">${bucket.name}</span></td>
      <td><span class="row-arrow" aria-hidden="true">↗</span></td>
    </tr>`;
  }).join("");
}

function renderFilterButtons(selected) {
  const filters = [
    ["all", "All"],
    ["under20", "&lt;20s"],
    ["20to25", "20–25s"],
    ["25to28", "25–28s"],
    ["28to30", "28–30s"],
    ["over30", "&gt;30s"],
  ];
  return filters.map(([key, label]) =>
    `<button class="chip${key === selected ? " active" : ""}" type="button" data-filter="${key}">${label}</button>`
  ).join("");
}

function renderPagination(pagination, selectedDate, selectedBucket) {
  const current = Number(pagination.page) || 1;
  const total = Number(pagination.total_pages) || 1;
  const items = [];
  items.push(current <= 1
    ? '<span class="page-button disabled">‹</span>'
    : pageLink(current - 1, "‹", selectedDate, selectedBucket));
  paginationItems(current, total).forEach((item) => {
    if (typeof item === "string") items.push('<span class="page-ellipsis">…</span>');
    else items.push(pageLink(item, String(item), selectedDate, selectedBucket, item === current));
  });
  items.push(current >= total
    ? '<span class="page-button disabled">›</span>'
    : pageLink(current + 1, "›", selectedDate, selectedBucket));
  return items.join("");
}

function paginationItems(current, total) {
  if (total <= 7) return Array.from({ length: total }, (_, index) => index + 1);
  const pages = new Set([1, 2, total - 1, total, current - 1, current, current + 1]);
  const values = Array.from(pages).filter((page) => page >= 1 && page <= total).sort((a, b) => a - b);
  const items = [];
  values.forEach((page, index) => {
    if (index > 0 && page - values[index - 1] > 1) items.push(`ellipsis-${index}`);
    items.push(page);
  });
  return items;
}

function pageLink(page, label, selectedDate, selectedBucket, active = false) {
  const query = `date=${encodeURIComponent(selectedDate)}&amp;page=${page}&amp;bucket=${encodeURIComponent(selectedBucket)}`;
  return `<a class="page-button${active ? " active" : ""}" data-page="${page}" aria-label="Page ${page}" href="/?${query}#shot-log"${active ? ' aria-current="page"' : ""}>${label}</a>`;
}

function renderDistribution(analysis) {
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
    return `<button class="distribution-row" type="button" data-bucket="${key}">
      <span class="distribution-label">${label}</span>
      <span class="bar-track"><i class="bar-fill" style="width:${width.toFixed(1)}%;background:${color}"></i></span>
      <strong class="distribution-value">${count}</strong>
    </button>`;
  }).join("");
}

function bucketInfo(ms) {
  const value = Number(ms);
  if (value < 20_000) return { key: "under20", name: "Very fast" };
  if (value < 25_000) return { key: "20to25", name: "Fast" };
  if (value < 28_000) return { key: "25to28", name: "In range" };
  if (value <= 30_000) return { key: "28to30", name: "Slow" };
  return { key: "over30", name: "Very slow" };
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

function consistencyPercent(analysis) {
  const total = Number(analysis.total) || 0;
  if (total === 0) return 0;
  const buckets = analysis.buckets || {};
  return Math.round(((Number(buckets["25to28"]) || 0) + (Number(buckets["28to30"]) || 0)) * 100 / total);
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}
