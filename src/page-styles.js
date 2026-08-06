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
  --display-font: "Iowan Old Style", "Palatino Linotype", "Book Antiqua", Baskerville, Georgia, serif;
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
  font-family: "Avenir Next", "Segoe UI Variable", "Helvetica Neue", ui-sans-serif, sans-serif;
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
  position: relative;
  z-index: 3;
  padding: 20px 24px 0;
}
.header-layout {
  width: min(var(--max), calc(100vw - 48px));
  margin: 0 auto;
  min-height: 76px;
  display: grid;
  grid-template-columns: 1fr auto 1fr;
  align-items: center;
  gap: 24px;
}
.nav-shell {
  width: fit-content;
  min-height: 54px;
  margin: 0;
  padding: 5px;
  display: flex;
  align-items: center;
  justify-self: center;
  background: linear-gradient(120deg, rgba(30,27,23,.54), rgba(12,11,10,.26));
  border: 1px solid rgba(245,238,225,.1);
  border-radius: 19px;
  box-shadow: 0 14px 38px rgba(0,0,0,.18), inset 0 1px rgba(255,255,255,.025);
  backdrop-filter: blur(22px) saturate(115%);
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
.header-brand { width: 91px; height: 60px; padding-left: 3px; display: inline-flex; align-items: center; justify-self: start; transition: opacity 180ms ease, transform 180ms ease; }
.header-brand:hover { opacity: .88; transform: translateY(-1px); }
.header-brand img { width: 100%; height: 100%; display: block; object-fit: contain; object-position: left center; }
.nav-links { justify-self: center; display: flex; align-items: center; gap: 3px; }
.nav-links a {
  min-height: 42px;
  padding: 0 19px;
  display: inline-flex;
  align-items: center;
  position: relative;
  border-radius: 14px;
  color: var(--muted);
  font: 400 17px/1.1 var(--display-font);
  letter-spacing: -.01em;
  transition: color 180ms ease, background 180ms ease, transform 180ms ease;
}
.nav-links a::after { content: ""; position: absolute; left: 50%; right: 50%; bottom: 6px; height: 1px; border-radius: 999px; background: linear-gradient(90deg, transparent, var(--accent), transparent); box-shadow: 0 0 10px rgba(201,155,100,.45); opacity: 0; transition: left 220ms ease, right 220ms ease, opacity 220ms ease; }
.nav-links a:hover { color: var(--text); background: rgba(255,255,255,.025); transform: translateY(-1px); }
.nav-links a.active { color: var(--cream); background: rgba(255,255,255,.04); }
.nav-links a.active::after { left: 18px; right: 18px; opacity: 1; }
.live-pill {
  justify-self: end;
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 8px 12px;
  border: 1px solid rgba(245,238,225,.1);
  border-radius: 999px;
  color: var(--muted);
  font-size: 10px;
  font-weight: 600;
  letter-spacing: .04em;
  background: rgba(15,13,11,.24);
  backdrop-filter: blur(18px);
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
.live-pill[data-state="polling"] .live-dot {
  background: #899eb7;
  box-shadow: 0 0 0 5px rgba(137, 158, 183, 0.12);
}
.live-pill[data-state="error"] .live-dot {
  background: #d08c7d;
  box-shadow: 0 0 0 5px rgba(208, 140, 125, 0.12);
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
  font: 400 clamp(62px, 7.2vw, 104px) / 0.91 var(--display-font);
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
.brand-planet {
  width: min(430px, 82vw);
  aspect-ratio: 1;
  display: grid;
  place-items: center;
  position: relative;
  isolation: isolate;
  filter: drop-shadow(0 28px 55px rgba(0,0,0,.48));
}
.brand-planet::before {
  content: "";
  position: absolute;
  z-index: -3;
  inset: 15%;
  border-radius: 50%;
  background: radial-gradient(circle, rgba(205,153,97,.4), rgba(95,57,31,.2) 35%, transparent 69%);
  filter: blur(20px);
  animation: brand-glow 5s ease-in-out infinite;
}
.brand-planet::after {
  content: "";
  position: absolute;
  z-index: -2;
  inset: 7%;
  border: 1px solid rgba(245,238,225,.13);
  border-radius: 46% 54% 50% 50%;
  box-shadow: inset 0 0 80px rgba(0,0,0,.28);
  transform: rotate(-12deg);
}
.planet-ring { position: absolute; z-index: -1; display: block; border: 1px solid rgba(245,238,225,.15); border-radius: 50%; pointer-events: none; }
.planet-ring-one { inset: 3%; transform: rotate(-25deg); animation: planet-drift 18s linear infinite; }
.planet-ring-two { inset: 19%; border-style: dashed; opacity: .7; animation: planet-drift 13s linear infinite reverse; }
.planet-satellite { position: absolute; z-index: 2; width: 9px; height: 9px; border-radius: 50%; background: var(--accent); box-shadow: 0 0 0 5px rgba(201,155,100,.1), 0 0 22px rgba(201,155,100,.9); }
.planet-satellite-one { top: 17%; left: 22%; animation: satellite-float 5.5s ease-in-out infinite; }
.planet-satellite-two { right: 18%; bottom: 25%; width: 6px; height: 6px; background: var(--green); box-shadow: 0 0 0 5px rgba(146,183,156,.08), 0 0 16px rgba(146,183,156,.7); animation: satellite-float 4.3s ease-in-out infinite reverse; }
.planet-core { width: 154px; height: 154px; display: inline-flex; align-items: center; justify-content: center; gap: 10px; border: 1px solid rgba(245,238,225,.17); border-radius: 50%; color: var(--cream); background: radial-gradient(circle at 35% 28%, rgba(237,205,163,.32), rgba(90,58,33,.66) 42%, rgba(12,10,8,.87) 72%); box-shadow: inset 0 1px rgba(255,255,255,.22), inset 0 -25px 38px rgba(0,0,0,.42), 0 18px 40px rgba(0,0,0,.35), 0 0 42px rgba(201,155,100,.2); transform: rotate(-7deg); }
.planet-core b { font: 400 57px/.8 Georgia, "Times New Roman", serif; letter-spacing: -.08em; }
.planet-core small { color: rgba(243,238,230,.72); font: 700 9px/1.22 "Avenir Next", sans-serif; letter-spacing: .12em; text-transform: uppercase; }
.planet-readout { position: absolute; right: 4%; bottom: 11%; display: inline-flex; align-items: baseline; gap: 6px; color: var(--cream); font: 400 25px/1 Georgia, serif; letter-spacing: -.04em; }
.planet-readout small { color: var(--muted); font: 700 9px/1 "Avenir Next", sans-serif; letter-spacing: .12em; text-transform: uppercase; }
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
table { width: 100%; border-collapse: collapse; min-width: 830px; }
th {
  padding: 17px 24px;
  color: var(--dim);
  font-size: 11px;
  font-weight: 600;
  letter-spacing: .1em;
  text-align: left;
  text-transform: uppercase;
  background: rgba(255,255,255,.018);
}
td { height: 76px; padding: 14px 24px; border-top: 1px solid var(--line); color: #d8d2ca; font-size: 14px; }
tbody tr { cursor: pointer; transition: background 150ms ease; }
tbody tr:hover { background: rgba(255,255,255,.035); }
.brew-number { display: inline-flex; align-items: center; gap: 10px; color: var(--text); font-weight: 600; }
.brew-number::before { content: ""; width: 7px; height: 7px; border-radius: 50%; background: var(--accent); }
.shot-value { color: var(--text); font: 400 21px/1 Georgia, serif; }
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
.pagination-shell {
  min-height: 76px;
  padding: 14px 20px 16px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  border-top: 1px solid var(--line);
}
.pagination-shell.is-empty { justify-content: center; }
.page-summary { color: var(--dim); font-size: 11px; letter-spacing: .02em; }
.pagination-controls { display: inline-flex; align-items: center; gap: 8px; }
.page-numbers { display: inline-flex; align-items: center; gap: 4px; }
.page-button,
.page-number,
.page-ellipsis {
  width: 34px;
  height: 34px;
  display: inline-grid;
  place-items: center;
  border-radius: 50%;
  color: var(--muted);
  font-size: 12px;
  line-height: 1;
}
.page-button,
.page-number {
  border: 1px solid transparent;
  transition: transform 180ms cubic-bezier(.2,.8,.2,1), color 180ms ease, border-color 180ms ease, background 180ms ease, box-shadow 180ms ease;
}
.page-button { background: rgba(255,255,255,.035); border-color: var(--line); font-size: 19px; }
.page-button:hover,
.page-number:hover { color: var(--text); border-color: var(--line-strong); background: rgba(255,255,255,.075); transform: translateY(-2px); }
.page-button.disabled { color: rgba(181,174,165,.33); cursor: default; opacity: .58; }
.page-number.active { color: #171513; background: var(--accent); border-color: var(--accent); box-shadow: 0 8px 20px rgba(201,155,100,.22); animation: pagination-pop 260ms ease-out; }
.page-ellipsis { width: 20px; color: var(--dim); letter-spacing: .08em; }
.analysis-grid {
  display: grid;
  grid-template-columns: minmax(280px, .82fr) minmax(360px, 1.18fr);
  grid-template-areas: "distribution mix" "trend trend";
  gap: 18px;
}
.distribution-panel,
.mix-panel,
.trend-panel { padding: 28px; min-height: 470px; }
.distribution-panel { grid-area: distribution; }
.mix-panel { grid-area: mix; }
.trend-panel { grid-area: trend; }
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
.bucket-mix { display: grid; grid-template-columns: minmax(250px, .9fr) minmax(225px, 1fr); align-items: center; gap: 30px; }
.donut-shell { min-height: 270px; display: grid; place-items: center; position: relative; isolation: isolate; padding: 6px; overflow: visible; }
.donut-shell::before { content: ""; position: absolute; width: 235px; height: 235px; border-radius: 50%; background: radial-gradient(circle, rgba(201,155,100,.18) 0, rgba(144,108,72,.08) 34%, transparent 71%); filter: blur(13px); opacity: .9; animation: donut-glow 7s ease-in-out infinite; z-index: -1; }
.donut-shell::after { content: ""; position: absolute; width: 206px; height: 206px; border: 1px solid rgba(255,255,255,.045); border-radius: 50%; box-shadow: 0 0 38px rgba(201,155,100,.05), inset 0 0 24px rgba(255,255,255,.025); z-index: -1; }
.donut-chart { width: min(100%, 310px); height: auto; overflow: visible; filter: drop-shadow(0 18px 30px rgba(0,0,0,.34)); animation: donut-float 8s ease-in-out infinite; }
.donut-aura { fill: url(#donut-aura); opacity: .94; }
.donut-track { fill: rgba(255,255,255,.022); stroke: rgba(255,255,255,.075); stroke-width: 1.25; }
.donut-rim { fill: none; stroke: rgba(255,255,255,.18); stroke-width: 1; pointer-events: none; }
.donut-hole { fill: url(#donut-core); stroke: rgba(255,255,255,.16); stroke-width: 1.2; filter: drop-shadow(0 -2px 3px rgba(255,255,255,.08)); }
.donut-hole-ring { fill: none; stroke: rgba(201,155,100,.13); stroke-width: 1; stroke-dasharray: 2 4; }
.pie-slice { stroke: #171513; stroke-width: 2.8; stroke-linejoin: round; opacity: 0; transform-box: fill-box; transform-origin: center; animation: pie-enter 700ms cubic-bezier(.16,.88,.22,1) forwards; animation-delay: var(--slice-delay, 0ms); transition: filter 220ms ease, transform 220ms cubic-bezier(.2,.82,.2,1); cursor: default; }
.pie-slice:hover { filter: brightness(1.14) saturate(1.12) drop-shadow(0 5px 8px rgba(0,0,0,.24)); transform: scale(1.045); }
.pie-slice-label { fill: #1a1714; stroke: rgba(255,255,255,.44); stroke-width: .5; paint-order: stroke; font: 700 13px/1 Arial, sans-serif; letter-spacing: -.02em; pointer-events: none; opacity: .96; }
.donut-total { fill: var(--text); font: 400 31px/1 Georgia, serif; letter-spacing: -.03em; }
.donut-caption { fill: var(--dim); font: 10px Arial, sans-serif; letter-spacing: .14em; text-transform: uppercase; }
.donut-legend { display: grid; gap: 7px; padding: 12px; border: 1px solid rgba(255,255,255,.08); border-radius: 19px; background: linear-gradient(135deg, rgba(255,255,255,.065), rgba(255,255,255,.016)); box-shadow: inset 0 1px rgba(255,255,255,.055), 0 16px 32px rgba(0,0,0,.16); }
.donut-legend-row { min-height: 48px; padding: 9px 11px; display: flex; align-items: center; justify-content: space-between; gap: 15px; border-radius: 13px; color: var(--muted); font-size: 13px; transition: background 180ms ease, transform 180ms ease; }
.donut-legend-row:hover { background: rgba(255,255,255,.055); transform: translateX(2px); }
.donut-legend-row span { display: inline-flex; align-items: center; gap: 10px; }
.donut-legend-row i { width: 11px; height: 11px; display: inline-block; border-radius: 50%; box-shadow: 0 0 0 4px rgba(255,255,255,.04), 0 0 14px currentColor; }
.donut-legend-row strong { min-width: 54px; display: grid; justify-items: end; gap: 3px; color: var(--text); font: 400 18px/1 Georgia, serif; }
.donut-legend-row strong small { color: var(--dim); font: 11px/1 ui-sans-serif, sans-serif; letter-spacing: .01em; }
.target-legend { display: inline-flex; align-items: center; gap: 7px; }
.target-legend i { display: inline-block; width: 16px; border-top: 1px dashed var(--accent); }
.chart-tools { display: grid; justify-items: end; gap: 10px; }
.chart-mode { padding: 4px; display: inline-flex; align-items: center; gap: 3px; border: 1px solid var(--line); border-radius: 999px; background: rgba(255,255,255,.025); }
.chart-mode-link { min-height: 30px; padding: 0 11px; display: inline-flex; align-items: center; gap: 7px; border-radius: 999px; color: var(--dim); font-size: 10px; white-space: nowrap; transition: color 180ms ease, background 180ms ease, box-shadow 180ms ease; }
.chart-mode-link i { width: 8px; height: 8px; border: 1px solid currentColor; border-radius: 50%; opacity: .75; transition: background 180ms ease, transform 180ms ease; }
.chart-mode-link:hover { color: var(--text); background: rgba(255,255,255,.05); }
.chart-mode-link.active { color: var(--ink); background: var(--cream); box-shadow: 0 4px 12px rgba(0,0,0,.18); }
.chart-mode-link.active i { background: var(--ink); border-color: var(--ink); transform: scale(.75); }
.trend-single-value { fill: var(--text); font: 400 16px/1 Georgia, serif; }
.chart-shell { height: 350px; position: relative; }
.trend-chart { width: 100%; height: 100%; display: grid; place-items: center; }
.trend-chart svg { width: 100%; height: 100%; overflow: visible; }
.chart-scroll-hint { display: none; }
.trend-grid { stroke: rgba(245,238,225,.09); stroke-width: 1; vector-effect: non-scaling-stroke; }
.trend-axis { fill: var(--dim); font: 10px Arial, sans-serif; }
.consistency-band { fill: rgba(146,183,156,.07); }
.target-line { stroke: rgba(201,155,100,.72); stroke-width: 1; stroke-dasharray: 5 6; vector-effect: non-scaling-stroke; }
.trend-area { fill: url(#trendGradient); }
.trend-line { fill: none; stroke: var(--accent); stroke-width: 2.25; stroke-linecap: round; stroke-linejoin: round; vector-effect: non-scaling-stroke; }
.trend-point { fill: var(--cream); stroke: #171513; stroke-width: 2; vector-effect: non-scaling-stroke; cursor: help; transition: opacity 160ms ease; }
.trend-point:hover { opacity: .62; }
.scatter-chart { width: 100%; height: 100%; overflow: visible; }
.scatter-grid { stroke: rgba(245,238,225,.055); stroke-width: 1; vector-effect: non-scaling-stroke; }
.scatter-grid.major { stroke: rgba(245,238,225,.1); }
.scatter-axis { fill: var(--dim); font: 10px Arial, sans-serif; }
.scatter-point { stroke: #171513; stroke-width: 1.25; vector-effect: non-scaling-stroke; opacity: .9; transition: r 160ms ease, opacity 160ms ease; }
.scatter-point:hover { opacity: 1; r: 5.5; }
.chart-empty { color: var(--dim); font-size: 12px; }

@keyframes pie-enter {
  from { opacity: 0; transform: scale(.84) rotate(-7deg); }
  to { opacity: 1; transform: scale(1) rotate(0); }
}
@keyframes donut-float { 50% { transform: translateY(-4px) rotate(.6deg); } }
@keyframes donut-glow { 50% { transform: scale(1.09); opacity: .65; } }

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
@keyframes planet-drift { to { transform: rotate(360deg); } }
@keyframes satellite-float { 50% { transform: translate(8px, -9px) scale(1.18); } }
@keyframes brand-glow { 50% { transform: scale(1.13); opacity: .72; } }
@keyframes pulse { 50% { box-shadow: 0 0 0 8px rgba(146,183,156,0); } }
@keyframes shimmer { to { background-position: -200% 0; } }
@keyframes pagination-pop { from { transform: scale(.78); } to { transform: scale(1); } }

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
  .analysis-grid { grid-template-columns: 1fr; grid-template-areas: "distribution" "mix" "trend"; }
  .distribution-panel, .mix-panel, .trend-panel { min-height: 430px; }
}

@media (max-width: 720px) {
  .site-header { padding: 10px 12px 0; }
  .header-layout { width: 100%; min-height: 0; grid-template-columns: 1fr auto; grid-template-areas: "brand live" "nav nav"; gap: 8px 12px; }
  .header-brand { grid-area: brand; width: 76px; height: 50px; padding-left: 0; }
  .nav-shell { grid-area: nav; width: 100%; min-height: 52px; padding: 4px 6px; justify-self: stretch; }
  .nav-links { position: static; width: 100%; justify-self: start; padding: 0; justify-content: flex-start; overflow-x: auto; scrollbar-width: none; }
  .nav-links::-webkit-scrollbar { display: none; }
  .nav-links a { flex: 1 0 auto; min-height: 42px; padding: 0 14px; justify-content: center; font-size: 16px; }
  .live-pill { grid-area: live; display: inline-flex; justify-self: end; padding: 7px 9px; }
  main, footer { width: min(100% - 28px, var(--max)); }
  .hero { min-height: auto; padding: 82px 0 40px; }
  .hero h1 { font-size: clamp(52px, 15vw, 78px); }
  .hero-visual { min-height: 390px; }
  .brand-planet { width: min(380px, 88vw); }
  .hero-metrics { grid-template-columns: 1fr 1fr; }
  .hero-metrics article { padding: 18px 15px; border-bottom: 1px solid var(--line); }
  .hero-metrics article:first-child { padding-left: 15px; }
  .hero-metrics article:nth-child(2) { border-right: 0; }
  .hero-metrics article:nth-child(3), .hero-metrics article:nth-child(4) { border-bottom: 0; }
  .section-heading { align-items: start; flex-direction: column; }
  .date-controls { width: 100%; }
  .date-picker { flex: 1; justify-content: center; }
  .analysis-date-controls { width: 100%; justify-content: stretch; }
  .chart-tools { width: 100%; justify-items: start; }
  .bucket-mix { grid-template-columns: 1fr; }
  .donut-shell { min-height: 245px; }
  .analysis-date-controls label { flex: 1 1 145px; }
  .analysis-period { margin-top: -12px; text-align: left; }
  .table-toolbar { align-items: start; flex-direction: column; }
  .filter-chips { width: 100%; flex-wrap: nowrap; overflow-x: auto; padding-bottom: 3px; }
  .chip { flex: 0 0 auto; }
  .pagination-shell { align-items: flex-start; flex-direction: column; }
  .pagination-controls { width: 100%; justify-content: space-between; }
  .chart-shell { height: 380px; overflow-x: auto; overflow-y: hidden; overscroll-behavior-x: contain; -webkit-overflow-scrolling: touch; touch-action: pan-x pan-y; scrollbar-color: rgba(201,155,100,.62) transparent; scrollbar-width: thin; }
  .trend-chart { width: 920px; min-width: 920px; height: 360px; place-items: stretch; }
  .trend-chart svg, .scatter-chart { width: 920px; min-width: 920px; height: 360px; }
  .chart-scroll-hint { margin: 12px 2px 0; display: flex; align-items: center; justify-content: center; gap: 8px; color: var(--dim); font-size: 10px; letter-spacing: .08em; text-transform: uppercase; }
  .chart-scroll-hint span { color: var(--accent); font-size: 14px; }
  .analysis-section { padding-bottom: 48px; }
  footer { margin-bottom: 0; grid-template-columns: 1fr auto; }
  footer p { display: none; }
}

@media (max-width: 480px) {
  .brand { font-size: 16px; }
  .live-pill { padding: 7px 8px; gap: 6px; font-size: 9px; }
  .live-dot { width: 6px; height: 6px; }
  .header-brand { width: 68px; height: 45px; }
  .nav-links a { padding: 0 10px; font-size: 15px; }
  .hero-copy > p { font-size: 15px; }
  .hero-actions { display: grid; }
  .brand-planet { width: min(340px, 92vw); }
  .floating-card { min-width: 142px; }
  .floating-top { right: 0; }
  .floating-bottom { left: 0; }
  .hero-metrics strong { font-size: 21px; }
  .section-heading h2 { font-size: 44px; }
  .panel { border-radius: 22px; }
  .distribution-panel, .mix-panel, .trend-panel { padding: 21px 16px; }
  .distribution-row { grid-template-columns: 62px 1fr 34px; padding-left: 5px; padding-right: 5px; }
  .dialog-time { font-size: 62px; }
  .dialog-grid { grid-template-columns: 1fr; }
}

@media (prefers-reduced-motion: reduce) {
  html { scroll-behavior: auto; }
  *, *::before, *::after { animation-duration: .01ms !important; animation-iteration-count: 1 !important; transition-duration: .01ms !important; }
}
`;
