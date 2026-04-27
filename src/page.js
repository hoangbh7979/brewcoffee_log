import { formatClock, formatDate, formatShot } from "./format.js";
import { CLIENT_SCRIPT } from "./page-client.js";
import { PAGE_STYLES } from "./page-styles.js";

const TARGET_SHOT_MS = 25000;

export function renderHomePage(url, results) {
  const rows = results.map(renderShotRow).join("");
  const isLocal = url.hostname === "localhost" || url.hostname === "127.0.0.1";
  const analysisButtonHtml = isLocal ? "" : renderAnalysisButton();
  const analysisViewHtml = isLocal ? "" : renderAnalysisView();
  const analysisNavHtml = isLocal ? "" : `<a href="#analysisView">Analysis</a>`;
  const heroActionsHtml = analysisButtonHtml ? `<div class="hero-actions">${analysisButtonHtml}</div>` : "";

  const html = `<!doctype html>
      <html>
      <head>
        <meta charset="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <title>Casadio Shot Log</title>
        <style>
${PAGE_STYLES}
        </style>
      </head>
      <body>
        <header class="topbar">
          <div class="nav-inner">
            <div class="brand">
              <span class="brand-mark">B</span>
              <span class="brand-word">BrewLedger</span>
            </div>
            <nav class="nav-links" aria-label="Dashboard navigation">
              <a href="#mainView">Log</a>
              <a href="#summary">Metrics</a>
              ${analysisNavHtml}
            </nav>
            <div class="status-pill" aria-live="polite">
              <span class="status-dot"></span>
              <span id="status">Connecting...</span>
            </div>
          </div>
        </header>

        <main>
          <section class="hero-section">
            <div class="wrap hero-grid">
              <div class="hero-copy">
                <p class="eyebrow">LIVE BREW TERMINAL</p>
                <h1>Casadio Undici Shot Log</h1>
                <p class="hero-subtitle">Target 25.00s / Last 500 entries / Live session view</p>
                ${heroActionsHtml}
              </div>
              <section class="summary-panel" id="summary" aria-label="Brew metrics">
                <div class="summary-row">
                  <span class="summary-label">Brew counter</span>
                  <strong id="brewCounter">--</strong>
                </div>
                <div class="summary-row">
                  <span class="summary-label">Avg brew time</span>
                  <strong id="avgBrew">--.--s</strong>
                </div>
                <div class="summary-row">
                  <span class="summary-label">Target time</span>
                  <strong>25.00s</strong>
                </div>
              </section>
            </div>
          </section>

          <section class="ticker-strip" aria-label="Live indicators">
            <div class="wrap ticker-inner">
              <span><strong>MODE</strong> Realtime</span>
              <span><strong>LIMIT</strong> 500 rows</span>
              <span><strong>SOURCE</strong> D1 + WebSocket</span>
            </div>
          </section>

          <section class="content-section">
            <div class="wrap">
              <section id="mainView" class="panel table-panel">
                <div class="panel-head">
                  <div>
                    <p class="eyebrow">SHOT BOOK</p>
                    <h2>Recent brews</h2>
                  </div>
                  <span class="data-chip">Live feed</span>
                </div>
                <div class="table-shell">
                  <table>
                    <thead>
                      <tr>
                        <th scope="col">Brew</th>
                        <th scope="col">Date</th>
                        <th scope="col">Time</th>
                        <th scope="col">Shot</th>
                        <th scope="col">Delta</th>
                      </tr>
                    </thead>
                    <tbody id="shots">
                      ${rows || `<tr class="empty-row"><td colspan="5">No data</td></tr>`}
                    </tbody>
                  </table>
                </div>
              </section>
              ${analysisViewHtml}
            </div>
          </section>
        </main>

        <script>
${CLIENT_SCRIPT}
        </script>
      </body>
      </html>`;
  return new Response(html, {
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "no-store, no-cache, must-revalidate",
    },
  });
}

function renderShotRow(r) {
  const dt = new Date(r.created_at);
  const dateText = formatDate(dt);
  const clockText = formatClock(dt);
  const shotText = formatShot(r.shot_ms);
  const delta = buildShotDelta(r.shot_ms);
  const idx = Number.isFinite(r.brew_counter) ? `#${r.brew_counter}` : "";
  const key = String(r && r.id ? r.id : "");
  const brew = Number.isFinite(Number(r && r.brew_counter)) ? Number(r.brew_counter) : "";
  const createdAt = Number.isFinite(Number(r && r.created_at)) ? Number(r.created_at) : 0;
  return `<tr data-id="${key}" data-brew-counter="${brew}" data-created-at="${createdAt}" data-timing="${delta.timing}">
          <td class="brew-cell"><span class="brew-badge">${idx}</span></td>
          <td class="date-cell">${dateText}</td>
          <td class="time-cell">${clockText}</td>
          <td class="shot-cell">${shotText}</td>
          <td class="delta-cell"><span class="delta-badge ${delta.className}">${delta.text}</span></td>
        </tr>`;
}

function buildShotDelta(ms) {
  const shotMs = Number(ms);
  if (!Number.isFinite(shotMs)) {
    return { text: "--", className: "is-neutral", timing: "neutral" };
  }
  const deltaSec = (shotMs - TARGET_SHOT_MS) / 1000;
  const abs = Math.abs(deltaSec);
  if (abs < 0.005) {
    return { text: "Target", className: "is-target", timing: "target" };
  }
  const prefix = deltaSec > 0 ? "+" : "-";
  const timing = deltaSec > 0 ? "slow" : "fast";
  return {
    text: `${prefix}${abs.toFixed(2)}s`,
    className: deltaSec > 0 ? "is-slow" : "is-fast",
    timing,
  };
}

function renderAnalysisButton() {
  return `<button class="btn primary-pill" id="analysisBtn">Detailed Analysis</button>`;
}

function renderAnalysisView() {
  return `<section id="analysisView" class="panel analysis-panel hidden">
                <div class="panel-head">
                  <div>
                    <p class="eyebrow">SESSION ANALYSIS</p>
                    <h2>Based on brews</h2>
                  </div>
                  <span class="data-chip dark">Target 25.00s</span>
                </div>
                <div class="analysis-title">Brew count trend</div>
                <div class="chart-wrap">
                  <canvas id="chartAxis"></canvas>
                  <div class="chart-scroll" id="chartScroll">
                    <canvas id="chart"></canvas>
                  </div>
                </div>
                <div class="analysis-subtitle">Latest date</div>
                <div class="chart-wrap">
                  <canvas id="dayTimeChartAxis"></canvas>
                  <div class="chart-scroll" id="dayTimeChartScroll">
                    <canvas id="dayTimeChart"></canvas>
                  </div>
                </div>
              </section>`;
}
