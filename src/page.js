export function renderHomePage() {
  const html = `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="theme-color" content="#0b0a09">
  <meta name="description" content="A refined realtime shot log for the Casadio Undici espresso machine.">
  <title>BrewLedger — Casadio Shot Log</title>
  <link rel="stylesheet" href="/assets/app.css">
  <script src="/assets/app.js" defer></script>
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
          <strong id="heroLatest">--.--s</strong>
        </div>
        <div class="floating-card floating-bottom">
          <span>30-day consistency</span>
          <strong id="heroConsistency">--%</strong>
        </div>
      </div>

      <div class="hero-metrics reveal">
        <article><span>Total / 30 days</span><strong id="metricTotal">—</strong></article>
        <article><span>Average time</span><strong id="metricAverage">—</strong></article>
        <article><span>Selected day</span><strong id="metricSelected">—</strong></article>
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
            <input id="dateInput" type="date" aria-label="Select shot date">
          </label>
          <button class="icon-button" id="nextDay" type="button" aria-label="Next day">›</button>
        </div>
      </div>

      <div class="panel table-panel reveal">
        <div class="table-toolbar">
          <div class="filter-chips" id="filterChips" aria-label="Filter by extraction time">
            <button class="chip active" type="button" data-filter="all">All</button>
            <button class="chip" type="button" data-filter="under20">&lt;20s</button>
            <button class="chip" type="button" data-filter="20to25">20–25s</button>
            <button class="chip" type="button" data-filter="25to28">25–28s</button>
            <button class="chip" type="button" data-filter="28to30">28–30s</button>
            <button class="chip" type="button" data-filter="over30">&gt;30s</button>
          </div>
          <span class="result-count" id="resultCount">Loading shots…</span>
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
            <tbody id="shotsTable">
              <tr class="loading-row"><td colspan="6"><span class="loading-line"></span></td></tr>
            </tbody>
          </table>
        </div>

        <div class="pagination-shell">
          <p id="pageSummary">Page 1 of 1</p>
          <nav class="pagination" id="pagination" aria-label="Shot log pagination"></nav>
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
            <div><span>Shot distribution</span><strong id="distributionTotal">0 extractions</strong></div>
            <span class="panel-symbol">↗</span>
          </div>
          <div class="distribution-list" id="distributionList"></div>
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

  <div class="toast" id="toast" role="status" aria-live="polite"></div>
</body>
</html>`;

  return new Response(html, {
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "no-store, no-cache, must-revalidate",
    },
  });
}
