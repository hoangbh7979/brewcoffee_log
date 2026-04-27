export const PAGE_STYLES = `
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
`;
