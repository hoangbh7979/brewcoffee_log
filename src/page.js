import { formatShot, formatTime } from "./format.js";
import { CLIENT_SCRIPT } from "./page-client.js";
import { PAGE_STYLES } from "./page-styles.js";

export function renderHomePage(url, results) {
  const rows = results.map(renderShotRow).join("");
  const isLocal = url.hostname === "localhost" || url.hostname === "127.0.0.1";
  const analysisButtonHtml = isLocal ? "" : renderAnalysisButton();
  const analysisViewHtml = isLocal ? "" : renderAnalysisView();

  const html = `<!doctype html>
      <html>
      <head>
        <meta charset="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <title>Shot Log</title>
        <style>
${PAGE_STYLES}
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
  const timeText = formatTime(dt);
  const shotText = formatShot(r.shot_ms);
  const idx = Number.isFinite(r.brew_counter) ? `#${r.brew_counter}` : "";
  return `<tr>
          <td>${idx}</td>
          <td>${timeText}</td>
          <td>${shotText}</td>
        </tr>`;
}

function renderAnalysisButton() {
  return `<div class="actions">
            <button class="btn" id="analysisBtn">See Detailed Analysis</button>
          </div>`;
}

function renderAnalysisView() {
  return `<div id="analysisView" class="panel hidden">
            <div class="analysis-title">Based on Brews</div>
            <div class="chart-wrap">
              <canvas id="chartAxis"></canvas>
              <div class="chart-scroll" id="chartScroll">
                <canvas id="chart"></canvas>
              </div>
            </div>
            <div class="analysis-subtitle">Latest Date</div>
            <div class="chart-wrap">
              <canvas id="dayTimeChartAxis"></canvas>
              <div class="chart-scroll" id="dayTimeChartScroll">
                <canvas id="dayTimeChart"></canvas>
              </div>
            </div>
          </div>`;
}
