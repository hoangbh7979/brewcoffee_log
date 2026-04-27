export const PAGE_STYLES = `
          :root {
            --binance-yellow: #F0B90B;
            --binance-gold: #FFD000;
            --active-yellow: #D0980B;
            --focus-blue: #1EAEDB;
            --white: #FFFFFF;
            --snow: #F5F5F5;
            --dark: #222126;
            --dark-card: #2B2F36;
            --ink: #1E2026;
            --secondary: #32313A;
            --slate: #848E9C;
            --steel: #686A6C;
            --border: #E6E8EA;
            --green: #0ECB81;
            --red: #F6465D;
            --shadow-subtle: rgba(32, 32, 37, 0.05) 0px 3px 5px 0px;
            --shadow-hover: rgba(8, 8, 8, 0.05) 0px 3px 5px 5px;
            --pill-shadow: rgb(153,153,153) 0px 2px 10px -3px;
          }

          * { box-sizing: border-box; }
          html { background: var(--white); scroll-behavior: smooth; }
          body {
            margin: 0;
            font-family: BinancePlex, Arial, sans-serif;
            background: var(--white);
            color: var(--ink);
            font-size: 16px;
            font-weight: 500;
            line-height: 1.5;
          }
          a { color: inherit; text-decoration: none; }
          .wrap { width: min(1200px, calc(100% - 64px)); margin: 0 auto; }
          .hidden { display: none !important; }

          .topbar {
            position: sticky;
            top: 0;
            z-index: 10;
            background: var(--white);
            border-bottom: 1px solid var(--border);
          }
          .nav-inner {
            width: min(1200px, calc(100% - 64px));
            height: 64px;
            margin: 0 auto;
            display: flex;
            align-items: center;
            justify-content: space-between;
            gap: 24px;
          }
          .brand { display: flex; align-items: center; gap: 10px; min-width: 0; }
          .brand-mark {
            width: 34px;
            height: 34px;
            border-radius: 8px;
            display: inline-flex;
            align-items: center;
            justify-content: center;
            background: var(--binance-yellow);
            color: var(--ink);
            font-size: 20px;
            font-weight: 700;
            line-height: 1;
            box-shadow: var(--shadow-subtle);
          }
          .brand-word {
            color: var(--ink);
            font-size: 16px;
            font-weight: 700;
            line-height: 1;
          }
          .nav-links { display: flex; align-items: center; justify-content: center; gap: 28px; }
          .nav-links a {
            min-height: 44px;
            display: inline-flex;
            align-items: center;
            color: var(--secondary);
            font-size: 14px;
            font-weight: 600;
            transition: color 200ms ease;
          }
          .nav-links a:hover { color: #1A1A1A; }
          .status-pill {
            min-height: 44px;
            display: inline-flex;
            align-items: center;
            gap: 8px;
            padding: 0 14px;
            border: 1px solid var(--border);
            border-radius: 50px;
            background: var(--snow);
            color: var(--secondary);
            font-size: 14px;
            font-weight: 600;
            white-space: nowrap;
          }
          .status-dot {
            width: 8px;
            height: 8px;
            border-radius: 50%;
            background: var(--binance-yellow);
            box-shadow: 0 0 0 4px rgba(240, 185, 11, 0.14);
          }
          .status-pill[data-state="live"] .status-dot {
            background: var(--green);
            box-shadow: 0 0 0 4px rgba(14, 203, 129, 0.12);
          }

          .hero-section {
            background: var(--white);
            padding: 64px 0 48px;
          }
          .hero-grid {
            display: grid;
            grid-template-columns: minmax(0, 1fr) 380px;
            gap: 48px;
            align-items: center;
          }
          .hero-copy { min-width: 0; }
          .eyebrow {
            margin: 0 0 12px;
            color: var(--binance-yellow);
            font-size: 12px;
            font-weight: 700;
            line-height: 1;
            letter-spacing: 0;
            text-transform: uppercase;
          }
          h1, h2 { margin: 0; color: var(--ink); letter-spacing: 0; }
          h1 {
            max-width: 760px;
            font-size: 60px;
            font-weight: 700;
            line-height: 1.08;
          }
          h2 {
            font-size: 24px;
            font-weight: 700;
            line-height: 1;
          }
          .hero-subtitle {
            max-width: 620px;
            margin: 20px 0 0;
            color: var(--slate);
            font-size: 20px;
            font-weight: 500;
            line-height: 1.5;
          }
          .hero-actions {
            min-height: 48px;
            display: flex;
            align-items: center;
            gap: 12px;
            margin-top: 32px;
          }
          .btn {
            min-height: 48px;
            display: inline-flex;
            align-items: center;
            justify-content: center;
            border: 1px solid transparent;
            border-radius: 50px;
            padding: 10px 32px;
            cursor: pointer;
            font-family: inherit;
            font-size: 16px;
            font-weight: 600;
            line-height: 1.25;
            letter-spacing: 0.16px;
            transition: background 200ms ease, color 200ms ease, border-color 200ms ease;
          }
          .primary-pill {
            background: var(--binance-yellow);
            border-color: var(--binance-yellow);
            color: var(--ink);
            box-shadow: var(--pill-shadow);
          }
          .primary-pill:hover,
          .primary-pill:focus-visible {
            background: var(--focus-blue);
            border-color: var(--focus-blue);
            color: var(--white);
            outline: 2px solid #000000;
            outline-offset: 2px;
          }
          .primary-pill:active {
            background: var(--active-yellow);
            border-color: var(--active-yellow);
            color: var(--ink);
          }

          .summary-panel {
            background: var(--dark);
            border-radius: 12px;
            padding: 8px;
            box-shadow: var(--shadow-subtle);
          }
          .summary-row {
            min-height: 82px;
            display: flex;
            align-items: center;
            justify-content: space-between;
            gap: 18px;
            padding: 18px 20px;
            border-bottom: 1px solid rgba(255, 255, 255, 0.08);
          }
          .summary-row:last-child { border-bottom: 0; }
          .summary-label {
            color: var(--slate);
            font-size: 14px;
            font-weight: 600;
            line-height: 1.5;
          }
          .summary-row strong {
            color: var(--white);
            font-size: 28px;
            font-weight: 700;
            line-height: 1;
            font-variant-numeric: tabular-nums;
            text-align: right;
            white-space: nowrap;
          }
          #avgBrew { color: var(--binance-gold); }

          .ticker-strip {
            background: var(--snow);
            border-top: 1px solid var(--border);
            border-bottom: 1px solid var(--border);
          }
          .ticker-inner {
            min-height: 56px;
            display: flex;
            align-items: center;
            gap: 28px;
            overflow-x: auto;
            color: var(--slate);
            font-size: 14px;
            font-weight: 600;
            white-space: nowrap;
          }
          .ticker-inner strong {
            margin-right: 8px;
            color: var(--ink);
            font-weight: 700;
          }

          .content-section {
            background: var(--dark);
            padding: 48px 0 64px;
          }
          .panel {
            border-radius: 12px;
            box-shadow: var(--shadow-subtle);
            transition: box-shadow 200ms ease;
          }
          .panel:hover { box-shadow: var(--shadow-hover); }
          .table-panel {
            overflow: hidden;
            background: var(--white);
            border: 1px solid var(--border);
          }
          .panel-head {
            min-height: 80px;
            display: flex;
            align-items: center;
            justify-content: space-between;
            gap: 16px;
            padding: 24px;
            border-bottom: 1px solid var(--border);
          }
          .data-chip {
            min-height: 32px;
            display: inline-flex;
            align-items: center;
            justify-content: center;
            padding: 0 12px;
            border: 1px solid var(--border);
            border-radius: 50px;
            background: var(--snow);
            color: var(--secondary);
            font-size: 12px;
            font-weight: 700;
            line-height: 1;
            white-space: nowrap;
          }
          .data-chip.dark {
            border-color: rgba(255, 208, 0, 0.45);
            background: rgba(240, 185, 11, 0.10);
            color: var(--binance-gold);
          }
          .table-shell { width: 100%; overflow-x: auto; }
          table {
            width: 100%;
            min-width: 520px;
            border-collapse: collapse;
            font-variant-numeric: tabular-nums;
          }
          th, td {
            padding: 16px 24px;
            border-bottom: 1px solid var(--border);
            text-align: left;
            white-space: nowrap;
          }
          th {
            background: var(--snow);
            color: var(--slate);
            font-size: 12px;
            font-weight: 700;
            line-height: 1;
            text-transform: uppercase;
          }
          td {
            color: var(--secondary);
            font-size: 16px;
            font-weight: 600;
            line-height: 1.3;
          }
          tbody tr:nth-child(even) { background: #FAFAFA; }
          tbody tr:hover { background: rgba(240, 185, 11, 0.08); }
          tbody tr:last-child td { border-bottom: 0; }
          .brew-cell { color: var(--ink); font-weight: 700; }
          .shot-cell { color: var(--ink); font-weight: 700; }
          .empty-row td {
            padding: 32px 24px;
            color: var(--slate);
            text-align: center;
          }

          .analysis-panel {
            margin-top: 24px;
            padding: 0 24px 24px;
            background: var(--dark);
            border: 1px solid rgba(255, 255, 255, 0.08);
            color: var(--white);
          }
          .analysis-panel .panel-head {
            margin: 0 -24px 20px;
            border-bottom-color: rgba(255, 255, 255, 0.08);
          }
          .analysis-panel h2 { color: var(--white); }
          .analysis-title,
          .analysis-subtitle {
            color: var(--white);
            font-size: 14px;
            font-weight: 700;
            line-height: 1.5;
          }
          .analysis-title { margin: 0 0 10px; }
          .analysis-subtitle { margin: 20px 0 10px; }
          .chart-wrap {
            display: flex;
            align-items: flex-start;
            gap: 8px;
            padding: 12px;
            border: 1px solid rgba(255, 255, 255, 0.08);
            border-radius: 8px;
            background: var(--dark-card);
          }
          #chartAxis,
          #dayTimeChartAxis {
            width: 50px;
            height: 320px;
            display: block;
            flex: 0 0 auto;
          }
          .chart-scroll {
            overflow-x: auto;
            overflow-y: hidden;
            padding-bottom: 6px;
            flex: 1 1 auto;
          }
          .chart-scroll::-webkit-scrollbar { height: 8px; }
          .chart-scroll::-webkit-scrollbar-track { background: rgba(255, 255, 255, 0.08); border-radius: 50px; }
          .chart-scroll::-webkit-scrollbar-thumb { background: var(--binance-yellow); border-radius: 50px; }
          #chart,
          #dayTimeChart {
            width: 100%;
            height: 320px;
            display: block;
          }

          @media (max-width: 896px) {
            .wrap,
            .nav-inner { width: min(100% - 32px, 1200px); }
            .nav-links { display: none; }
            .hero-section { padding: 48px 0 40px; }
            .hero-grid { grid-template-columns: 1fr; gap: 32px; }
            h1 { font-size: 44px; }
            .summary-panel { max-width: none; }
          }

          @media (max-width: 599px) {
            .wrap,
            .nav-inner { width: min(100% - 32px, 1200px); }
            .brand-word { display: none; }
            .status-pill { padding: 0 12px; font-size: 12px; }
            .hero-section { padding: 32px 0; }
            h1 { font-size: 34px; }
            .hero-subtitle { font-size: 16px; }
            .hero-actions { margin-top: 24px; }
            .btn { width: 100%; justify-content: center; }
            .summary-row { min-height: 72px; padding: 16px; }
            .summary-row strong { font-size: 24px; }
            .ticker-inner { gap: 20px; }
            .content-section { padding: 32px 0 48px; }
            .panel-head { align-items: flex-start; flex-direction: column; padding: 20px; }
            th, td { padding: 14px 16px; }
            .analysis-panel { padding: 0 16px 16px; }
            .analysis-panel .panel-head { margin: 0 -16px 16px; }
          }
`;
