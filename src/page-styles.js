export const PAGE_STYLES = `
:root {
  color-scheme: dark;
  --bg: #0a0908;
  --surface: rgba(21, 20, 18, 0.84);
  --surface-strong: #171614;
  --surface-soft: #1d1b18;
  --line: rgba(245, 238, 225, 0.12);
  --line-strong: rgba(245, 238, 225, 0.22);
  --text: #f3eee6;
  --muted: #aaa39a;
  --dim: #777168;
  --cream: #eee8de;
  --ink: #171513;
  --accent: #c99b64;
  --accent-soft: rgba(201, 155, 100, 0.15);
  --green: #92b79c;
  --red: #d08c7d;
  --blue: #899eb7;
  --radius-xl: 30px;
  --radius-lg: 22px;
  --radius-md: 15px;
  --shadow: 0 28px 80px rgba(0, 0, 0, 0.32);
  --max: 1200px;
}

* { box-sizing: border-box; }
html { scroll-behavior: smooth; scroll-padding-top: 110px; }
body {
  margin: 0;
  min-width: 320px;
  overflow-x: hidden;
  background:
    radial-gradient(circle at 50% -10%, rgba(111, 83, 55, 0.12), transparent 34%),
    var(--bg);
  color: var(--text);
  font-family: Inter, ui-sans-serif, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
  line-height: 1.5;
  -webkit-font-smoothing: antialiased;
}

button, input { font: inherit; }
button, a { -webkit-tap-highlight-color: transparent; }
a { color: inherit; text-decoration: none; }
button { color: inherit; }

.ambient {
  position: fixed;
  z-index: -1;
  width: 520px;
  height: 520px;
  border-radius: 50%;
  filter: blur(110px);
  pointer-events: none;
  opacity: 0.13;
}
.ambient-one { top: 12%; left: -330px; background: #a96d38; }
.ambient-two { top: 55%; right: -350px; background: #735f46; }

.site-header {
  position: sticky;
  top: 0;
  z-index: 20;
  padding: 18px 24px 0;
}
.nav-shell {
  width: min(var(--max), calc(100vw - 48px));
  min-height: 64px;
  margin: 0 auto;
  padding: 10px 12px 10px 18px;
  display: grid;
  grid-template-columns: 1fr auto 1fr;
  align-items: center;
  gap: 18px;
  background: rgba(13, 12, 11, 0.78);
  border: 1px solid var(--line);
  border-radius: 18px;
  box-shadow: 0 10px 40px rgba(0, 0, 0, 0.24);
  backdrop-filter: blur(22px);
}
.brand {
  width: fit-content;
  display: inline-flex;
  align-items: center;
  gap: 10px;
  font-family: Georgia, "Times New Roman", serif;
  font-size: 18px;
  letter-spacing: -0.02em;
}
.brand-symbol {
  display: grid;
  width: 30px;
  height: 30px;
  place-items: center;
  border: 1px solid var(--line-strong);
  border-radius: 50%;
  font-family: ui-sans-serif, sans-serif;
  color: var(--cream);
}
.nav-links { display: flex; align-items: center; gap: 6px; }
.nav-links a {
  padding: 9px 14px;
  border-radius: 999px;
  color: var(--muted);
  font-size: 13px;
  transition: color 180ms ease, background 180ms ease;
}
.nav-links a:hover,
.nav-links a.active { color: var(--text); background: rgba(255, 255, 255, 0.07); }
.live-pill {
  justify-self: end;
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 9px 13px;
  border: 1px solid var(--line);
  border-radius: 999px;
  color: var(--muted);
  font-size: 12px;
}
.live-dot {
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background: var(--accent);
  box-shadow: 0 0 0 5px rgba(201, 155, 100, 0.1);
}
.live-pill[data-state="live"] .live-dot {
  background: var(--green);
  box-shadow: 0 0 0 5px rgba(146, 183, 156, 0.1);
  animation: pulse 2s infinite;
}

main { width: min(var(--max), calc(100vw - 48px)); margin: 0 auto; }
.hero {
  min-height: 760px;
  padding: 126px 0 54px;
  display: grid;
  grid-template-columns: 1.1fr 0.9fr;
  align-items: center;
  gap: 70px;
  position: relative;
}
.hero-copy { max-width: 680px; }
.micro-pill,
.period-pill {
  width: fit-content;
  display: inline-flex;
  align-items: center;
  gap: 10px;
  padding: 8px 12px;
  border: 1px solid var(--line);
  border-radius: 999px;
  color: var(--muted);
  font-size: 12px;
  background: rgba(255, 255, 255, 0.025);
}
.hero h1 {
  margin: 26px 0 24px;
  font: 400 clamp(62px, 7.2vw, 104px) / 0.91 Georgia, "Times New Roman", serif;
  letter-spacing: -0.065em;
}
.hero h1 em { color: var(--accent); font-weight: 400; }
.hero-copy > p {
  max-width: 530px;
  margin: 0;
  color: var(--muted);
  font-size: 17px;
  line-height: 1.7;
}
.hero-actions { display: flex; flex-wrap: wrap; gap: 10px; margin-top: 36px; }
.button {
  min-height: 48px;
  padding: 0 19px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 18px;
  border-radius: 999px;
  font-size: 13px;
  transition: transform 180ms ease, background 180ms ease, border-color 180ms ease;
}
.button:hover { transform: translateY(-2px); }
.button-light { background: var(--cream); color: var(--ink); }
.button-ghost { border: 1px solid var(--line-strong); color: var(--text); }
.button-ghost:hover { background: rgba(255,255,255,.06); }

.hero-visual {
  min-height: 490px;
  display: grid;
  place-items: center;
  position: relative;
  isolation: isolate;
}
.hero-visual::before {
  content: "";
  position: absolute;
  inset: 10% 2%;
  z-index: -2;
  border-radius: 46% 54% 52% 48%;
  background:
    radial-gradient(circle at 55% 38%, rgba(219, 184, 144, 0.26), transparent 18%),
    radial-gradient(circle at 50% 50%, #5d422d, #1d1712 48%, transparent 69%);
  filter: blur(14px);
  opacity: 0.92;
  animation: breathe 7s ease-in-out infinite;
}
.brew-orbit {
  width: min(360px, 76vw);
  aspect-ratio: 1;
  display: grid;
  place-items: center;
  position: relative;
  border: 1px solid rgba(245, 238, 225, 0.12);
  border-radius: 50%;
  box-shadow: inset 0 0 80px rgba(0,0,0,.45), 0 30px 90px rgba(0,0,0,.35);
  background: rgba(12, 10, 8, 0.32);
  backdrop-filter: blur(16px);
}
.orbit { position: absolute; border: 1px solid rgba(245,238,225,.13); border-radius: 50%; }
.orbit-one { inset: 16%; animation: spin 18s linear infinite; }
.orbit-one::after {
  content: "";
  position: absolute;
  top: 7%;
  left: 17%;
  width: 9px;
  height: 9px;
  border-radius: 50%;
  background: var(--accent);
  box-shadow: 0 0 24px var(--accent);
}
.orbit-two { inset: 31%; border-style: dashed; opacity: .65; animation: spin 25s linear infinite reverse; }
.orbit-core {
  display: flex;
  align-items: baseline;
  gap: 5px;
  font: 400 68px/1 Georgia, serif;
  letter-spacing: -0.06em;
}
.orbit-core small { color: var(--muted); font: 12px/1 ui-sans-serif, sans-serif; letter-spacing: .08em; text-transform: uppercase; }
.floating-card {
  position: absolute;
  min-width: 166px;
  padding: 14px 16px;
  display: grid;
  gap: 4px;
  border: 1px solid var(--line);
  border-radius: 15px;
  background: rgba(20, 18, 16, 0.78);
  box-shadow: var(--shadow);
  backdrop-filter: blur(18px);
}
.floating-card span { color: var(--muted); font-size: 10px; text-transform: uppercase; letter-spacing: .08em; }
.floating-card strong { font: 400 24px/1.25 Georgia, serif; }
.floating-top { top: 13%; right: -2%; }
.floating-bottom { bottom: 14%; left: -4%; }
.hero-metrics {
  grid-column: 1 / -1;
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  border-top: 1px solid var(--line);
  border-bottom: 1px solid var(--line);
}
.hero-metrics article { padding: 24px 26px; display: grid; gap: 8px; border-right: 1px solid var(--line); }
.hero-metrics article:first-child { padding-left: 0; }
.hero-metrics article:last-child { border-right: 0; }
.hero-metrics span { color: var(--dim); font-size: 11px; text-transform: uppercase; letter-spacing: .09em; }
.hero-metrics strong { font: 400 26px/1.2 Georgia, serif; }
.hero-metrics small { display: block; margin-top: 4px; color: var(--muted); font-size: 10px; }

.log-section,
.analysis-section { padding: 120px 0 30px; }
.analysis-section { padding-bottom: 130px; }
.section-heading {
  margin-bottom: 32px;
  display: flex;
  align-items: end;
  justify-content: space-between;
  gap: 30px;
}
.eyebrow {
  margin: 0 0 13px;
  color: var(--accent);
  font-size: 11px;
  font-weight: 600;
  letter-spacing: .12em;
  text-transform: uppercase;
}
.section-heading h2,
.shot-dialog h2 {
  margin: 0;
  font: 400 clamp(42px, 5vw, 66px)/1 Georgia, serif;
  letter-spacing: -.045em;
}
.section-heading > div > p:last-child { margin: 13px 0 0; color: var(--muted); }
.date-controls { display: flex; align-items: center; gap: 8px; }
.icon-button,
.date-picker {
  height: 44px;
  border: 1px solid var(--line);
  border-radius: 999px;
  background: rgba(255,255,255,.025);
}
.icon-button {
  width: 44px;
  display: grid;
  place-items: center;
  cursor: pointer;
  font-size: 24px;
  transition: background 160ms ease, transform 160ms ease;
}
.icon-button:hover:not(:disabled) { background: rgba(255,255,255,.08); transform: translateY(-1px); }
.icon-button:disabled { opacity: .3; cursor: not-allowed; }
.icon-button.disabled { opacity: .3; cursor: not-allowed; pointer-events: none; }
.date-picker { padding: 0 15px; display: flex; align-items: center; gap: 10px; }
.date-picker span { color: var(--accent); }
.date-picker input { width: 126px; border: 0; outline: 0; color: var(--text); background: transparent; color-scheme: dark; }
.analysis-date-controls { display: flex; align-items: end; justify-content: flex-end; gap: 8px; flex-wrap: wrap; }
.analysis-date-controls label {
  min-width: 150px;
  height: 58px;
  padding: 8px 14px;
  display: grid;
  align-content: center;
  gap: 4px;
  border: 1px solid var(--line);
  border-radius: 14px;
  background: rgba(255,255,255,.025);
}
.analysis-date-controls label span { color: var(--dim); font-size: 9px; font-weight: 600; letter-spacing: .1em; text-transform: uppercase; }
.analysis-date-controls input { border: 0; outline: 0; color: var(--text); background: transparent; color-scheme: dark; }
.analysis-date-controls .icon-button { width: 58px; height: 58px; border-radius: 14px; }
.analysis-date-controls .icon-button.active { color: var(--ink); background: var(--cream); }
.range-arrow { align-self: center; color: var(--dim); }
.analysis-period { margin: -18px 0 24px; color: var(--dim); font-size: 11px; text-align: right; }

.panel {
  border: 1px solid var(--line);
  border-radius: var(--radius-xl);
  background: linear-gradient(145deg, rgba(26,24,21,.9), rgba(17,16,14,.92));
  box-shadow: var(--shadow);
  overflow: hidden;
}
.table-toolbar {
  min-height: 75px;
  padding: 16px 20px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  border-bottom: 1px solid var(--line);
}
.filter-chips { display: flex; gap: 6px; flex-wrap: wrap; }
.chip {
  padding: 8px 12px;
  border: 1px solid transparent;
  border-radius: 999px;
  background: transparent;
  color: var(--muted);
  cursor: pointer;
  font-size: 12px;
  transition: color 160ms ease, background 160ms ease, border-color 160ms ease;
}
.chip:hover { color: var(--text); }
.chip.active { color: var(--text); background: rgba(255,255,255,.07); border-color: var(--line); }
.result-count { color: var(--dim); font-size: 12px; white-space: nowrap; }
.table-wrap { overflow-x: auto; }
table { width: 100%; border-collapse: collapse; min-width: 790px; }
th {
  padding: 15px 20px;
  color: var(--dim);
  font-size: 10px;
  font-weight: 600;
  letter-spacing: .1em;
  text-align: left;
  text-transform: uppercase;
  background: rgba(255,255,255,.018);
}
td { height: 71px; padding: 13px 20px; border-top: 1px solid var(--line); color: #d8d2ca; font-size: 13px; }
tbody tr { cursor: pointer; transition: background 150ms ease; }
tbody tr:hover { background: rgba(255,255,255,.035); }
.brew-number { display: inline-flex; align-items: center; gap: 10px; color: var(--text); font-weight: 600; }
.brew-number::before { content: ""; width: 7px; height: 7px; border-radius: 50%; background: var(--accent); }
.shot-value { color: var(--text); font: 400 19px/1 Georgia, serif; }
.delta { color: var(--muted); }
.delta.positive { color: var(--red); }
.delta.negative { color: var(--blue); }
.class-tag {
  width: fit-content;
  padding: 5px 9px;
  border-radius: 999px;
  background: rgba(255,255,255,.055);
  color: var(--muted);
  font-size: 11px;
}
.class-tag.target { color: var(--green); background: rgba(146,183,156,.09); }
.row-arrow { color: var(--dim); font-size: 17px; }
.empty-state { height: 190px; text-align: center; color: var(--muted); cursor: default; }
.loading-row { cursor: default; }
.loading-line { display: block; height: 10px; border-radius: 999px; background: linear-gradient(90deg, rgba(255,255,255,.04), rgba(255,255,255,.1), rgba(255,255,255,.04)); background-size: 200% 100%; animation: shimmer 1.4s infinite; }
.analysis-grid { display: grid; grid-template-columns: .86fr 1.14fr; gap: 18px; }
.distribution-panel,
.trend-panel { padding: 28px; min-height: 470px; }
.panel-title { display: flex; align-items: start; justify-content: space-between; gap: 20px; margin-bottom: 32px; }
.panel-title > div { display: grid; gap: 7px; }
.panel-title span { color: var(--dim); font-size: 11px; letter-spacing: .08em; text-transform: uppercase; }
.panel-title strong { font: 400 22px/1.2 Georgia, serif; }
.panel-symbol { width: 34px; height: 34px; display: grid; place-items: center; border: 1px solid var(--line); border-radius: 50%; color: var(--text) !important; }
.distribution-list { display: grid; gap: 13px; }
.distribution-row {
  padding: 10px 12px;
  display: grid;
  grid-template-columns: 70px 1fr 42px;
  align-items: center;
  gap: 13px;
  border: 1px solid transparent;
  border-radius: 12px;
  cursor: pointer;
  transition: background 160ms ease, border-color 160ms ease;
}
.distribution-row:hover { background: rgba(255,255,255,.035); border-color: var(--line); }
.distribution-label { color: #cec8bf; font-size: 12px; }
.bar-track { height: 6px; overflow: hidden; border-radius: 999px; background: rgba(255,255,255,.06); }
.bar-fill { display: block; width: 0; height: 100%; border-radius: inherit; background: var(--accent); transition: width 700ms cubic-bezier(.2,.8,.2,1); }
.distribution-value { text-align: right; font: 400 18px/1 Georgia, serif; }
.interaction-hint { margin: 27px 0 0; color: var(--dim); font-size: 11px; }
.target-legend { display: inline-flex; align-items: center; gap: 7px; }
.target-legend i { display: inline-block; width: 16px; border-top: 1px dashed var(--accent); }
.chart-shell { height: 350px; position: relative; }
.trend-chart { width: 100%; height: 100%; display: grid; place-items: center; }
.trend-chart svg { width: 100%; height: 100%; overflow: visible; }
.trend-grid { stroke: rgba(245,238,225,.09); stroke-width: 1; vector-effect: non-scaling-stroke; }
.trend-axis { fill: var(--dim); font: 10px Arial, sans-serif; }
.consistency-band { fill: rgba(146,183,156,.07); }
.target-line { stroke: rgba(201,155,100,.72); stroke-width: 1; stroke-dasharray: 5 6; vector-effect: non-scaling-stroke; }
.trend-area { fill: url(#trendGradient); }
.trend-line { fill: none; stroke: var(--accent); stroke-width: 2.25; stroke-linecap: round; stroke-linejoin: round; vector-effect: non-scaling-stroke; }
.trend-point { fill: var(--cream); stroke: #171513; stroke-width: 2; vector-effect: non-scaling-stroke; cursor: help; transition: opacity 160ms ease; }
.trend-point:hover { opacity: .62; }
.chart-empty { color: var(--dim); font-size: 12px; }

footer {
  width: min(var(--max), calc(100vw - 48px));
  min-height: 130px;
  margin: 0 auto;
  display: grid;
  grid-template-columns: 1fr auto 1fr;
  align-items: center;
  gap: 20px;
  border-top: 1px solid var(--line);
  color: var(--dim);
  font-size: 11px;
}
footer p { margin: 0; }
footer > a:last-child { justify-self: end; }
.footer-brand { color: var(--text); }

.shot-dialog {
  width: min(520px, calc(100vw - 32px));
  padding: 34px;
  border: 1px solid var(--line-strong);
  border-radius: 26px;
  background: #171513;
  color: var(--text);
  box-shadow: 0 40px 120px rgba(0,0,0,.65);
}
.shot-dialog::backdrop { background: rgba(4,3,3,.7); backdrop-filter: blur(8px); }
.dialog-close { position: absolute; top: 18px; right: 18px; width: 36px; height: 36px; border: 1px solid var(--line); border-radius: 50%; background: transparent; cursor: pointer; font-size: 22px; }
.dialog-time { margin: 36px 0; color: var(--accent); font: 400 76px/.9 Georgia, serif; letter-spacing: -.06em; }
.dialog-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
.dialog-grid > div { padding: 15px; display: grid; gap: 5px; border: 1px solid var(--line); border-radius: 13px; }
.dialog-grid span { color: var(--dim); font-size: 10px; text-transform: uppercase; letter-spacing: .08em; }
.dialog-grid strong { font-size: 13px; font-weight: 500; }

.toast {
  position: fixed;
  z-index: 30;
  left: 50%;
  bottom: 24px;
  max-width: calc(100vw - 32px);
  padding: 12px 16px;
  border: 1px solid var(--line-strong);
  border-radius: 999px;
  background: rgba(18,16,14,.9);
  box-shadow: var(--shadow);
  color: var(--text);
  font-size: 12px;
  opacity: 0;
  pointer-events: none;
  transform: translate(-50%, 14px);
  transition: opacity 180ms ease, transform 180ms ease;
  backdrop-filter: blur(16px);
}
.toast.show { opacity: 1; transform: translate(-50%, 0); }
.sr-only { position: absolute; width: 1px; height: 1px; padding: 0; margin: -1px; overflow: hidden; clip: rect(0,0,0,0); white-space: nowrap; border: 0; }

.reveal { animation: reveal 700ms both; animation-timeline: view(); animation-range: entry 5% cover 24%; }
@keyframes reveal { from { opacity: 0; transform: translateY(24px); } to { opacity: 1; transform: none; } }
@keyframes spin { to { transform: rotate(360deg); } }
@keyframes breathe { 50% { transform: scale(1.04) rotate(2deg); opacity: 1; } }
@keyframes pulse { 50% { box-shadow: 0 0 0 8px rgba(146,183,156,0); } }
@keyframes shimmer { to { background-position: -200% 0; } }

button:focus-visible,
a:focus-visible,
input:focus-visible,
tbody tr:focus-visible {
  outline: 2px solid var(--accent);
  outline-offset: 3px;
}

@media (max-width: 980px) {
  .hero { grid-template-columns: 1fr; padding-top: 90px; gap: 30px; }
  .hero-copy { text-align: center; margin: 0 auto; }
  .micro-pill, .hero-actions { margin-left: auto; margin-right: auto; }
  .hero-copy > p { margin-left: auto; margin-right: auto; }
  .hero-visual { min-height: 450px; }
  .floating-top { right: 8%; }
  .floating-bottom { left: 8%; }
  .analysis-grid { grid-template-columns: 1fr; }
  .distribution-panel, .trend-panel { min-height: 430px; }
}

@media (max-width: 720px) {
  .site-header { padding: 10px 12px 0; }
  .nav-shell { width: 100%; grid-template-columns: 1fr auto; padding-left: 13px; }
  .nav-links { position: fixed; left: 50%; bottom: 12px; z-index: 25; width: min(430px, calc(100vw - 24px)); padding: 7px; justify-content: space-around; border: 1px solid var(--line); border-radius: 16px; background: rgba(13,12,11,.9); box-shadow: 0 16px 50px rgba(0,0,0,.45); backdrop-filter: blur(22px); transform: translateX(-50%); }
  .nav-links a { flex: 1; text-align: center; padding: 10px 5px; }
  .live-pill { grid-column: 2; grid-row: 1; }
  main, footer { width: min(100% - 28px, var(--max)); }
  .hero { min-height: auto; padding: 82px 0 40px; }
  .hero h1 { font-size: clamp(52px, 15vw, 78px); }
  .hero-visual { min-height: 390px; }
  .hero-metrics { grid-template-columns: 1fr 1fr; }
  .hero-metrics article { padding: 18px 15px; border-bottom: 1px solid var(--line); }
  .hero-metrics article:first-child { padding-left: 15px; }
  .hero-metrics article:nth-child(2) { border-right: 0; }
  .hero-metrics article:nth-child(3), .hero-metrics article:nth-child(4) { border-bottom: 0; }
  .section-heading { align-items: start; flex-direction: column; }
  .date-controls { width: 100%; }
  .date-picker { flex: 1; justify-content: center; }
  .analysis-date-controls { width: 100%; justify-content: stretch; }
  .analysis-date-controls label { flex: 1 1 145px; }
  .analysis-period { margin-top: -12px; text-align: left; }
  .table-toolbar { align-items: start; flex-direction: column; }
  .filter-chips { width: 100%; flex-wrap: nowrap; overflow-x: auto; padding-bottom: 3px; }
  .chip { flex: 0 0 auto; }
  .analysis-section { padding-bottom: 80px; }
  footer { margin-bottom: 82px; grid-template-columns: 1fr auto; }
  footer p { display: none; }
}

@media (max-width: 480px) {
  .brand { font-size: 16px; }
  .live-pill { padding: 8px 10px; }
  .live-pill span:last-child { display: none; }
  .hero-copy > p { font-size: 15px; }
  .hero-actions { display: grid; }
  .brew-orbit { width: 280px; }
  .floating-card { min-width: 142px; }
  .floating-top { right: 0; }
  .floating-bottom { left: 0; }
  .hero-metrics strong { font-size: 21px; }
  .section-heading h2 { font-size: 44px; }
  .panel { border-radius: 22px; }
  .distribution-panel, .trend-panel { padding: 21px 16px; }
  .distribution-row { grid-template-columns: 62px 1fr 34px; padding-left: 5px; padding-right: 5px; }
  .dialog-time { font-size: 62px; }
  .dialog-grid { grid-template-columns: 1fr; }
}

@media (prefers-reduced-motion: reduce) {
  html { scroll-behavior: auto; }
  *, *::before, *::after { animation-duration: .01ms !important; animation-iteration-count: 1 !important; transition-duration: .01ms !important; }
}
`;
