export const CLIENT_SCRIPT = `
          const MAX_ROWS = 500;
          const MAX_POINTS = 500;
          const TARGET_TIME_SEC = 25;
          const DAY_TIME_MAX_HOUR = 23 + (59 / 60);
          const CHART_RESYNC_DEBOUNCE_MS = 1500;
          const seen = new Set();
          const statusEl = document.getElementById('status');
          const brewEl = document.getElementById('brewCounter');
          const avgEl = document.getElementById('avgBrew');
          const mainView = document.getElementById('mainView');
          const analysisView = document.getElementById('analysisView');
          const analysisBtn = document.getElementById('analysisBtn');
          const chartCanvas = document.getElementById('chart');
          const chartAxisCanvas = document.getElementById('chartAxis');
          const chartScroll = document.getElementById('chartScroll');
          const dayTimeChartCanvas = document.getElementById('dayTimeChart');
          const dayTimeChartAxisCanvas = document.getElementById('dayTimeChartAxis');
          const dayTimeChartScroll = document.getElementById('dayTimeChartScroll');
          let chartCtx = chartCanvas ? chartCanvas.getContext('2d') : null;
          let chartAxisCtx = chartAxisCanvas ? chartAxisCanvas.getContext('2d') : null;
          let dayTimeChartCtx = dayTimeChartCanvas ? dayTimeChartCanvas.getContext('2d') : null;
          let dayTimeChartAxisCtx = dayTimeChartAxisCanvas ? dayTimeChartAxisCanvas.getContext('2d') : null;
          let chartPoints = [];
          let chartIds = new Set();
          let dayTimeChartPoints = [];
          let dayTimeChartIds = new Set();
          let latestDayLabel = "";
          let chartScheduled = false;
          let chartResyncTimer = null;
          let chartResyncInFlight = false;
          let chartMaxIndex = 0;
          const ENABLE_ANALYSIS = !!analysisBtn && !!chartCanvas && !!dayTimeChartCanvas;
          const UI_REFRESH_INTERVAL_MS = 10000;

          function setStatus(text) {
            if (statusEl) statusEl.textContent = text;
          }

          async function showMain() {
            await syncShots();
            if (mainView) mainView.classList.remove('hidden');
            if (analysisView) analysisView.classList.add('hidden');
            if (analysisBtn) analysisBtn.textContent = "See Detailed Analysis";
          }

          async function showAnalysis() {
            if (!ENABLE_ANALYSIS) return;
            await syncShots();
            if (mainView) mainView.classList.add('hidden');
            if (analysisView) analysisView.classList.remove('hidden');
            if (analysisBtn) analysisBtn.textContent = "Back to main";
            updateChartSize();
            resizeChart();
            if (chartScroll) chartScroll.scrollLeft = 0;
            if (dayTimeChartScroll) dayTimeChartScroll.scrollLeft = 0;
            scheduleChart();
          }

          async function toggleAnalysis() {
            if (!ENABLE_ANALYSIS) return;
            if (analysisView && !analysisView.classList.contains('hidden')) {
              await showMain();
            } else {
              await showAnalysis();
            }
          }

          if (analysisBtn) analysisBtn.addEventListener('click', toggleAnalysis);

          function updateStats(brew, avg) {
            const hasBrew = Number.isFinite(brew);
            if (brewEl) {
              brewEl.textContent = "Brew counter: " + (hasBrew ? Math.trunc(brew) : "--");
            }
            if (avgEl) {
              const showAvg = hasBrew && brew > 0 && Number.isFinite(avg);
              avgEl.textContent = "Avg Brew Time: " + (showAvg ? formatShot(avg) : "--.--s");
            }
          }

          function extractStats(r) {
            let brew = null;
            let avg = null;
            if (r) {
              if (Number.isFinite(r.brew_counter)) brew = r.brew_counter;
              if (Number.isFinite(r.avg_ms)) avg = r.avg_ms;
              if ((brew === null || avg === null) && r.payload) {
                try {
                  const p = typeof r.payload === "string" ? JSON.parse(r.payload) : r.payload;
                  if (brew === null && Number.isFinite(p.brew_counter)) brew = p.brew_counter;
                  if (avg === null && Number.isFinite(p.avg_ms)) avg = p.avg_ms;
                } catch (e) {
                  // ignore invalid payload
                }
              }
            }
            updateStats(brew, avg);
          }

          function shotCreatedAtMs(r) {
            const direct = Number(r && r.created_at);
            if (Number.isFinite(direct)) return direct;
            const dt = new Date(r && r.created_at);
            const ms = dt.getTime();
            return Number.isFinite(ms) ? ms : 0;
          }

          function compareShotsDesc(a, b) {
            const aBrew = Number(a && a.brew_counter);
            const bBrew = Number(b && b.brew_counter);
            const aHasBrew = Number.isFinite(aBrew);
            const bHasBrew = Number.isFinite(bBrew);
            const aCreated = shotCreatedAtMs(a);
            const bCreated = shotCreatedAtMs(b);
            if (aCreated !== bCreated) {
              return bCreated - aCreated;
            }
            if (aHasBrew && bHasBrew && aBrew !== bBrew) {
              return bBrew - aBrew;
            }
            if (aHasBrew !== bHasBrew) {
              return aHasBrew ? -1 : 1;
            }
            const aId = String((a && a.id) || "");
            const bId = String((b && b.id) || "");
            if (aId === bId) return 0;
            return aId < bId ? 1 : -1;
          }

          function sortShotsData(rows) {
            return (Array.isArray(rows) ? rows.slice() : []).sort(compareShotsDesc);
          }

          function renderRow(r) {
            const dt = new Date(r.created_at);
            const timeText = formatTime(dt);
            const shotText = formatShot(r.shot_ms);
            const idx = Number.isFinite(r.brew_counter) ? '#' + r.brew_counter : '';
            const key = rowKey(r);
            const brew = Number.isFinite(Number(r && r.brew_counter)) ? Number(r.brew_counter) : "";
            const createdAt = shotCreatedAtMs(r);
            return \`<tr data-id="\${key}" data-brew-counter="\${brew}" data-created-at="\${createdAt}"><td>\${idx}</td><td>\${timeText}</td><td>\${shotText}</td></tr>\`;
          }

          function trimRows(tbody) {
            while (tbody.children.length > MAX_ROWS) {
              tbody.removeChild(tbody.lastElementChild);
            }
          }

          function toPoint(r) {
            if (!r) return null;
            const x = Number(r.brew_counter);
            const y = Number(r.shot_ms);
            if (!Number.isFinite(x) || !Number.isFinite(y)) return null;
            const ySec = Math.floor(y / 10) / 100;
            const key = String(r.id || ((r.brew_counter || "") + ":" + (r.shot_ms || "")));
            return { id: key, x, y: ySec };
          }

          function dateKey(v) {
            const d = new Date(v);
            if (!Number.isFinite(d.getTime())) return "";
            const t = d.getTime() + (7 * 60 * 60 * 1000);
            const tz = new Date(t);
            const y = tz.getUTCFullYear();
            const m = pad2(tz.getUTCMonth() + 1);
            const day = pad2(tz.getUTCDate());
            return y + "-" + m + "-" + day;
          }

          function dateLabel(v) {
            const d = new Date(v);
            if (!Number.isFinite(d.getTime())) return "";
            const t = d.getTime() + (7 * 60 * 60 * 1000);
            const tz = new Date(t);
            return pad2(tz.getUTCDate()) + "/" + pad2(tz.getUTCMonth() + 1) + "/" + String(tz.getUTCFullYear()).slice(-2);
          }

          function timeOfDayHour(v) {
            const d = new Date(v);
            if (!Number.isFinite(d.getTime())) return null;
            const t = d.getTime() + (7 * 60 * 60 * 1000);
            const tz = new Date(t);
            const hh = tz.getUTCHours();
            const mm = tz.getUTCMinutes();
            const ss = tz.getUTCSeconds();
            return hh + (mm / 60) + (ss / 3600);
          }

          function resetChart() {
            chartPoints = [];
            chartIds = new Set();
            chartMaxIndex = 0;
            dayTimeChartPoints = [];
            dayTimeChartIds = new Set();
            latestDayLabel = "";
            scheduleChart();
          }

          function filterToLatestSession(data) {
            const idx = data.findIndex(r => Number(r && r.brew_counter) === 1);
            if (idx >= 0) return data.slice(0, idx + 1);
            return data;
          }

          function setChartFromData(data) {
            if (!ENABLE_ANALYSIS) return;
            const sessionData = filterToLatestSession(data);
            const pts = [];
            const ids = new Set();
            sessionData.forEach(r => {
              const pt = toPoint(r);
              if (!pt || ids.has(pt.id)) return;
              ids.add(pt.id);
              pts.push(pt);
            });
            pts.sort((a, b) => a.x - b.x);
            const trimmed = pts.length > MAX_POINTS ? pts.slice(pts.length - MAX_POINTS) : pts;
            chartPoints = trimmed;
            chartIds = new Set(trimmed.map(p => p.id));
            chartMaxIndex = trimmed.reduce((m, p) => (p.x > m ? p.x : m), 0);

            const latestDayKey = data.length > 0 ? dateKey(data[0].created_at) : "";
            latestDayLabel = data.length > 0 ? dateLabel(data[0].created_at) : "";
            const dayRowsDesc = latestDayKey ? data.filter(r => dateKey(r && r.created_at) === latestDayKey) : [];
            const dayRows = dayRowsDesc.slice().reverse();
            const dayTimePts = [];
            const dayTimeIds = new Set();
            dayRows.forEach(r => {
              const y = Number(r && r.shot_ms);
              const x = timeOfDayHour(r && r.created_at);
              if (!Number.isFinite(y) || !Number.isFinite(x)) return;
              const key = String(r.id || ((r.brew_counter || "") + ":" + (r.shot_ms || "") + ":" + (r.created_at || "")));
              if (dayTimeIds.has(key)) return;
              dayTimeIds.add(key);
              dayTimePts.push({ id: key, x, y: Math.floor(y / 10) / 100 });
            });
            dayTimePts.sort((a, b) => a.x - b.x);
            const dayTimeTrimmed = dayTimePts.length > MAX_POINTS ? dayTimePts.slice(dayTimePts.length - MAX_POINTS) : dayTimePts;
            dayTimeChartPoints = dayTimeTrimmed;
            dayTimeChartIds = new Set(dayTimeTrimmed.map(p => p.id));

            if (analysisView && !analysisView.classList.contains('hidden')) {
              updateChartSize();
              scheduleChart();
            }
          }

          function addChartPoint(r) {
            if (!ENABLE_ANALYSIS) return;
            const idx = Number(r && r.brew_counter);
            if (Number.isFinite(idx)) {
              if (idx === 1 || (chartMaxIndex > 0 && idx < chartMaxIndex)) {
                resetChart();
              }
            }
            const pt = toPoint(r);
            if (!pt || chartIds.has(pt.id)) return;
            chartIds.add(pt.id);
            chartPoints.push(pt);
            chartPoints.sort((a, b) => a.x - b.x);
            if (chartPoints.length > MAX_POINTS) {
              const excess = chartPoints.length - MAX_POINTS;
              const removed = chartPoints.splice(0, excess);
              removed.forEach(p => chartIds.delete(p.id));
            }
            if (pt.x > chartMaxIndex) chartMaxIndex = pt.x;

            const dk = dateKey(r && r.created_at);
            if (dk) {
              const dl = dateLabel(r.created_at);
              if (!latestDayLabel || latestDayLabel !== dl) {
                dayTimeChartPoints = [];
                dayTimeChartIds = new Set();
                latestDayLabel = dl;
              }
              const dkey = String(r.id || ((r.brew_counter || "") + ":" + (r.shot_ms || "") + ":" + (r.created_at || "")));
              if (!dayTimeChartIds.has(dkey)) {
                const dayTimeX = timeOfDayHour(r && r.created_at);
                if (Number.isFinite(dayTimeX)) {
                  dayTimeChartIds.add(dkey);
                  dayTimeChartPoints.push({ id: dkey, x: dayTimeX, y: pt.y });
                  dayTimeChartPoints.sort((a, b) => a.x - b.x);
                  if (dayTimeChartPoints.length > MAX_POINTS) {
                    const excess = dayTimeChartPoints.length - MAX_POINTS;
                    const removed = dayTimeChartPoints.splice(0, excess);
                    removed.forEach(p => dayTimeChartIds.delete(p.id));
                  }
                }
              }
            }

            if (analysisView && !analysisView.classList.contains('hidden')) {
              updateChartSize();
              scheduleChart();
            }
          }

          function rowKey(r) {
            return String(r && r.id ? r.id : "");
          }

          function rowDataFromElement(tr) {
            if (!tr) return null;
            return {
              id: tr.dataset.id || "",
              brew_counter: tr.dataset.brewCounter === "" ? null : Number(tr.dataset.brewCounter),
              created_at: tr.dataset.createdAt === "" ? 0 : Number(tr.dataset.createdAt),
            };
          }

          function sortTbodyRows(tbody) {
            if (!tbody) return;
            const rows = Array.from(tbody.querySelectorAll('tr'));
            rows.sort((a, b) => compareShotsDesc(rowDataFromElement(a), rowDataFromElement(b)));
            rows.forEach(row => tbody.appendChild(row));
          }

          function prependRow(r) {
            const tbody = document.getElementById('shots');
            if (!tbody) return;
            const key = rowKey(r);
            if (!key) return;
            if (seen.has(key)) return;
            if (tbody.children.length === 1) {
              const onlyRow = tbody.firstElementChild;
              const onlyCell = onlyRow && onlyRow.children && onlyRow.children.length === 1 ? onlyRow.children[0] : null;
              if (onlyCell && onlyCell.getAttribute('colspan') === '3') {
                tbody.innerHTML = '';
              }
            }
            seen.add(key);
            tbody.insertAdjacentHTML('afterbegin', renderRow(r));
            sortTbodyRows(tbody);
            trimRows(tbody);
            const firstRow = tbody.firstElementChild;
            if (firstRow && firstRow.dataset && firstRow.dataset.id === key) {
              extractStats(r);
            }
            addChartPoint(r);
            scheduleChartResync();
          }

          function scheduleChartResync() {
            if (!ENABLE_ANALYSIS) return;
            if (!analysisView || analysisView.classList.contains('hidden')) return;
            if (chartResyncTimer) return;
            chartResyncTimer = setTimeout(async () => {
              chartResyncTimer = null;
              if (chartResyncInFlight) return;
              chartResyncInFlight = true;
              try {
                const res = await fetch('/api/shots?limit=500', { cache: 'no-store' });
                const json = await res.json();
                const data = sortShotsData(Array.isArray(json && json.data) ? json.data : []);
                setChartFromData(data);
              } catch (e) {
                // ignore resync errors
              } finally {
                chartResyncInFlight = false;
              }
            }, CHART_RESYNC_DEBOUNCE_MS);
          }

          async function loadShots() {
            try {
              const res = await fetch('/api/shots?limit=500', { cache: 'no-store' });
              const json = await res.json();
              const tbody = document.getElementById('shots');
              const data = sortShotsData(json.data || []);
              if (data.length === 0) {
                seen.clear();
                tbody.innerHTML = '<tr><td colspan="3">No data</td></tr>';
                updateStats(null, null);
                setChartFromData([]);
                return;
              }
              seen.clear();
              data.forEach(r => {
                const key = rowKey(r);
                if (key) seen.add(key);
              });
              tbody.innerHTML = data.map(r => renderRow(r)).join('');
              trimRows(tbody);
              extractStats(data[0]);
              setChartFromData(data);
              updateChartSize();
            } catch (e) {
              // ignore fetch errors (offline etc.)
            }
          }

          function formatShot(ms) {
            if (!Number.isFinite(ms)) return "--.--s";
            const cs = Math.floor(ms / 10);
            return (cs / 100).toFixed(2) + "s";
          }
          function pad2(n){ return n < 10 ? "0"+n : ""+n; }
          function formatTime(d){
            const hh = pad2(d.getHours());
            const mm = pad2(d.getMinutes());
            const dd = pad2(d.getDate());
            const mo = pad2(d.getMonth()+1);
            const yy = (""+d.getFullYear()).slice(-2);
            return \`\${hh}h\${mm} \${dd}/\${mo}/\${yy}\`;
          }
          function scheduleChart() {
            if (!ENABLE_ANALYSIS) return;
            if (!chartCanvas || !chartCtx) return;
            if (chartScheduled) return;
            chartScheduled = true;
            requestAnimationFrame(() => {
              chartScheduled = false;
              drawChart();
              drawDayTimeChart();
            });
          }

          function updateSingleChartSize(canvas, axisCanvas, scrollEl, points, opts) {
            if (!canvas || !scrollEl) return;
            const options = opts || {};
            const containerW = scrollEl.clientWidth || 0;
            const minX = Number.isFinite(options.minX) ? options.minX : 0;
            const maxX = Number.isFinite(options.maxX)
              ? options.maxX
              : (points.length > 0 ? points.reduce((m, p) => (p.x > m ? p.x : m), minX) : minX);
            const span = Math.max(1, (maxX - minX + 1));
            const spacing = Number.isFinite(options.spacing) ? options.spacing : 28;
            const desired = span * spacing + 70;
            const width = Math.max(containerW, desired);
            canvas.style.width = width + "px";
            canvas.style.height = "320px";
            if (axisCanvas) {
              axisCanvas.style.width = "50px";
              axisCanvas.style.height = "320px";
            }
          }

          function updateChartSize() {
            if (!ENABLE_ANALYSIS) return;
            updateSingleChartSize(chartCanvas, chartAxisCanvas, chartScroll, chartPoints);
            updateSingleChartSize(dayTimeChartCanvas, dayTimeChartAxisCanvas, dayTimeChartScroll, dayTimeChartPoints, {
              minX: 0,
              maxX: DAY_TIME_MAX_HOUR,
              spacing: 70
            });
            resizeChart();
          }

          function resizeChart() {
            if (!ENABLE_ANALYSIS) return;
            const dpr = window.devicePixelRatio || 1;
            function resizeOne(canvas, ctx, axisCanvas, axisCtx) {
              if (!canvas || !ctx) return;
              const w = canvas.clientWidth || 0;
              const h = canvas.clientHeight || 0;
              if (w === 0 || h === 0) return;
              canvas.width = Math.floor(w * dpr);
              canvas.height = Math.floor(h * dpr);
              ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
              if (axisCanvas && axisCtx) {
                const aw = axisCanvas.clientWidth || 0;
                const ah = axisCanvas.clientHeight || 0;
                if (aw > 0 && ah > 0) {
                  axisCanvas.width = Math.floor(aw * dpr);
                  axisCanvas.height = Math.floor(ah * dpr);
                  axisCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
                }
              }
            }
            resizeOne(chartCanvas, chartCtx, chartAxisCanvas, chartAxisCtx);
            resizeOne(dayTimeChartCanvas, dayTimeChartCtx, dayTimeChartAxisCanvas, dayTimeChartAxisCtx);
          }

          function drawLineChart(canvas, ctx, axisCanvas, axisCtx, scrollEl, points, xLabel, opts) {
            if (!canvas || !ctx) return;
            const options = opts || {};
            const xMode = options.xMode === "time" ? "time" : "index";
            const timeMinX = Number.isFinite(options.minX) ? options.minX : 0;
            const timeMaxX = Number.isFinite(options.maxX) ? options.maxX : 24;
            const xGridStep = Number.isFinite(options.xGridStep) ? options.xGridStep : (xMode === "time" ? 2 : 1);
            const xLabelStep = Number.isFinite(options.xLabelStep) ? options.xLabelStep : (xMode === "time" ? 2 : 1);
            const showLine = options.showLine !== false;
            const lineColor = typeof options.lineColor === "string" ? options.lineColor : "#7fdcff";
            const pointColor = typeof options.pointColor === "string" ? options.pointColor : "#7fdcff";
            const pointRadius = Number.isFinite(options.pointRadius) ? options.pointRadius : 2.5;
            const w = canvas.clientWidth || 0;
            const h = canvas.clientHeight || 0;
            if (w === 0 || h === 0) return;
            ctx.clearRect(0, 0, w, h);
            ctx.fillStyle = "#0f1113";
            ctx.fillRect(0, 0, w, h);

            if (points.length === 0) {
              ctx.fillStyle = "#7a8a99";
              ctx.font = "12px Arial, sans-serif";
              ctx.fillText("No data yet", 12, 20);
              return;
            }

            let minX = xMode === "time" ? timeMinX : 0;
            let maxX = xMode === "time" ? timeMaxX : points[0].x;
            let maxY = points[0].y;
            for (const p of points) {
              if (xMode !== "time" && p.x > maxX) maxX = p.x;
              if (p.y > maxY) maxY = p.y;
            }
            if (minX === maxX) { maxX = minX + 1; }
            const yValsRaw = points.map(p => Number(p.y)).filter(v => Number.isFinite(v));
            const rawMin = yValsRaw.length > 0 ? Math.min(...yValsRaw) : 0;
            const rawMax = yValsRaw.length > 0 ? Math.max(...yValsRaw) : maxY;
            const rawMinWithTarget = Math.min(rawMin, TARGET_TIME_SEC);
            const rawMaxWithTarget = Math.max(rawMax, TARGET_TIME_SEC);
            const yStep = 2;
            let yMin = Math.floor(rawMinWithTarget / yStep) * yStep;
            let yMax = Math.ceil(rawMaxWithTarget / yStep) * yStep;
            if (yMin === yMax) yMax = yMin + yStep;
            const yVals = [];
            for (let y = yMin; y <= yMax + 0.0001; y += yStep) {
              yVals.push(Math.round(y * 100) / 100);
            }

            const padL = 10;
            const padR = 16;
            const padT = 16;
            const padB = 32;
            const plotW = Math.max(1, w - padL - padR);
            const plotH = Math.max(1, h - padT - padB);
            const axisX = padL;

            function xFor(x) {
              return padL + ((x - minX) / (maxX - minX)) * plotW;
            }
            function yFor(y) {
              return padT + (1 - (y - yMin) / (yMax - yMin)) * plotH;
            }

            // axis line
            ctx.strokeStyle = "#22303a";
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.moveTo(padL, padT + plotH);
            ctx.lineTo(padL + plotW, padT + plotH);
            ctx.stroke();

            // grid
            ctx.strokeStyle = "#1f2a33";
            ctx.lineWidth = 1;
            for (const yVal of yVals) {
              const y = yFor(yVal);
              ctx.beginPath();
              ctx.moveTo(axisX, y);
              ctx.lineTo(axisX + plotW, y);
              ctx.stroke();
            }

            // x grid
            ctx.strokeStyle = "#151d24";
            for (let xVal = minX; xVal <= maxX + 0.0001; xVal += xGridStep) {
              const x = xFor(xVal);
              ctx.beginPath();
              ctx.moveTo(x, padT);
              ctx.lineTo(x, padT + plotH);
              ctx.stroke();
            }

            // fixed target line (25s)
            const targetY = yFor(TARGET_TIME_SEC);
            ctx.strokeStyle = "#f1d44a";
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.moveTo(axisX, targetY);
            ctx.lineTo(axisX + plotW, targetY);
            ctx.stroke();

            // legend (top-right)
            const legendText = "Target Time";
            ctx.font = "12px Arial, sans-serif";
            const legendTextW = ctx.measureText(legendText).width;
            const legendPad = 6;
            const sampleW = 20;
            const legendW = sampleW + 8 + legendTextW + legendPad * 2;
            const legendH = 20;
            const viewRight = scrollEl ? (scrollEl.scrollLeft + scrollEl.clientWidth) : (axisX + plotW);
            const rightClamp = axisX + plotW - 6;
            const leftClamp = axisX + legendW + 6;
            const legendRight = Math.min(rightClamp, Math.max(leftClamp, viewRight - 8));
            const legendX = legendRight - legendW;
            const legendY = Math.max(2, padT - legendH - 4);
            ctx.fillStyle = "rgba(10, 14, 18, 0.78)";
            ctx.fillRect(legendX, legendY, legendW, legendH);
            ctx.strokeStyle = "#23313c";
            ctx.lineWidth = 1;
            ctx.strokeRect(legendX, legendY, legendW, legendH);
            const sampleY = legendY + Math.floor(legendH / 2) + 0.5;
            const sampleX1 = legendX + legendPad;
            const sampleX2 = sampleX1 + sampleW;
            ctx.strokeStyle = "#f1d44a";
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.moveTo(sampleX1, sampleY);
            ctx.lineTo(sampleX2, sampleY);
            ctx.stroke();
            ctx.fillStyle = "#f1d44a";
            ctx.textBaseline = "middle";
            ctx.fillText(legendText, sampleX2 + 8, sampleY);
            ctx.textBaseline = "alphabetic";

            // line
            if (showLine) {
              ctx.strokeStyle = lineColor;
              ctx.lineWidth = 2;
              ctx.beginPath();
              points.forEach((p, i) => {
                const x = xFor(p.x);
                const y = yFor(p.y);
                if (i === 0) ctx.moveTo(x, y);
                else ctx.lineTo(x, y);
              });
              ctx.stroke();
            }

            // points
            ctx.fillStyle = pointColor;
            for (const p of points) {
              const x = xFor(p.x);
              const y = yFor(p.y);
              ctx.beginPath();
              ctx.arc(x, y, pointRadius, 0, Math.PI * 2);
              ctx.fill();
            }

            // labels
            ctx.fillStyle = "#7a8a99";
            ctx.font = "11px Arial, sans-serif";
            ctx.fillText(xLabel, padL, h - 10);
            if (xMode === "time") {
              for (let xVal = minX; xVal <= maxX + 0.0001; xVal += xLabelStep) {
                const x = xFor(xVal);
                const totalMin = Math.round(xVal * 60);
                const hh = Math.floor(totalMin / 60) % 24;
                const mm = totalMin % 60;
                const label = pad2(hh) + ":" + pad2(mm);
                ctx.fillText(label, x - 16, h - 22);
              }
            } else {
              for (let xVal = minX; xVal <= maxX; xVal += xLabelStep) {
                const x = xFor(xVal);
                ctx.fillText(String(xVal), x - 4, h - 22);
              }
            }

            if (axisCtx && axisCanvas) {
              const ax = axisCanvas.clientWidth || 0;
              const ay = axisCanvas.clientHeight || 0;
              axisCtx.clearRect(0, 0, ax, ay);
              axisCtx.fillStyle = "#0b0f13";
              axisCtx.fillRect(0, 0, ax, ay);
              axisCtx.strokeStyle = "#22303a";
              axisCtx.lineWidth = 1;
              axisCtx.beginPath();
              axisCtx.moveTo(ax - 1, padT);
              axisCtx.lineTo(ax - 1, padT + plotH);
              axisCtx.stroke();
              axisCtx.fillStyle = "#7a8a99";
              axisCtx.textAlign = "right";
              axisCtx.textBaseline = "middle";
              for (const yVal of yVals) {
                const y = yFor(yVal);
                axisCtx.fillText(String(yVal) + "s", ax - 8, y - 2);
              }
            }
          }

          function drawChart() {
            if (!ENABLE_ANALYSIS) return;
            drawLineChart(chartCanvas, chartCtx, chartAxisCanvas, chartAxisCtx, chartScroll, chartPoints, "Brew count");
          }

          function drawDayTimeChart() {
            if (!ENABLE_ANALYSIS) return;
            const label = latestDayLabel ? ("Time of day (" + latestDayLabel + ")") : "Time of day (day)";
            drawLineChart(dayTimeChartCanvas, dayTimeChartCtx, dayTimeChartAxisCanvas, dayTimeChartAxisCtx, dayTimeChartScroll, dayTimeChartPoints, label, {
              xMode: "time",
              minX: 0,
              maxX: DAY_TIME_MAX_HOUR,
              xGridStep: 0.5,
              xLabelStep: 0.5,
              showLine: false,
              pointColor: "#ff4d4f",
              pointRadius: 3.5
            });
          }

                    
                              let wsFastPoll = null;
                              let wsRetryDelay = 300;
                              let wsLastSeenMs = 0;
                              let wsReconnectTimer = null;
                              let loadShotsInFlight = null;
                              const WS_PING_INTERVAL_MS = 10000;
                              const WS_STALE_TIMEOUT_MS = 30000;

                              async function fastPollLatest() {
                                try {
                                  const res = await fetch('/api/shots?limit=5', { cache: 'no-store' });
                                  const json = await res.json();
                                  const data = sortShotsData(json.data || []);
                                  for (let i = data.length - 1; i >= 0; i--) {
                                    prependRow(data[i]);
                                  }
                                } catch (e) {
                                  // ignore
                                }
                              }

                              function startFastPoll() {
                                if (wsFastPoll) return;
                                wsFastPoll = setInterval(fastPollLatest, 1000);
                              }

                              function stopFastPoll() {
                                if (!wsFastPoll) return;
                                clearInterval(wsFastPoll);
                                wsFastPoll = null;
                              }

                              async function syncShots() {
                                if (loadShotsInFlight) return loadShotsInFlight;
                                loadShotsInFlight = loadShots()
                                  .catch(() => {})
                                  .finally(() => {
                                    loadShotsInFlight = null;
                                  });
                                return loadShotsInFlight;
                              }

                              function scheduleWsReconnect(delay) {
                                if (wsReconnectTimer) return;
                                wsReconnectTimer = setTimeout(() => {
                                  wsReconnectTimer = null;
                                  connectWs();
                                }, delay);
                              }

                              function ensureWsFresh() {
                                const ws = window._shotWs;
                                const now = Date.now();
                                if (!ws || ws.readyState !== WebSocket.OPEN) {
                                  if (ws && ws.readyState !== WebSocket.CONNECTING) {
                                    try { ws.close(); } catch (e) {}
                                  }
                                  connectWs();
                                  return;
                                }
                                if (now - wsLastSeenMs > WS_STALE_TIMEOUT_MS) {
                                  try { ws.close(); } catch (e) {}
                                  return;
                                }
                                try { ws.send("ping"); } catch (e) {
                                  try { ws.close(); } catch (closeErr) {}
                                }
                              }

                              function refreshLiveViews() {
                                syncShots();
                                ensureWsFresh();
                              }

          function connectWs() {
            const current = window._shotWs;
            if (current && (current.readyState === WebSocket.OPEN || current.readyState === WebSocket.CONNECTING)) {
              return;
            }
            setStatus("Connecting...");
            const proto = location.protocol === "https:" ? "wss" : "ws";
            const ws = new WebSocket(proto + "://" + location.host + "/api/ws");
            window._shotWs = ws;
            stopFastPoll();
            ws.onopen = () => {
              setStatus("Live");
              wsRetryDelay = 300;
              wsLastSeenMs = Date.now();
              scheduleChartResync();
              syncShots();
              if (window._shotWsPing) {
                clearInterval(window._shotWsPing);
                window._shotWsPing = null;
              }
              window._shotWsPing = setInterval(() => {
                const now = Date.now();
                if (now - wsLastSeenMs > WS_STALE_TIMEOUT_MS) {
                  try { ws.close(); } catch (e) {}
                  return;
                }
                try { ws.send("ping"); } catch (e) {}
              }, WS_PING_INTERVAL_MS);
            };
            ws.onmessage = (ev) => {
              try {
                wsLastSeenMs = Date.now();
                if (ev.data === "pong") return;
                const data = JSON.parse(ev.data);
                if (data) prependRow(data);
              } catch (e) {
                // ignore bad payloads
              }
            };
            ws.onclose = () => {
              setStatus("Reconnecting...");
              if (window._shotWs === ws) {
                window._shotWs = null;
              }
              if (window._shotWsPing) {
                clearInterval(window._shotWsPing);
                window._shotWsPing = null;
              }
              startFastPoll();
              const delay = wsRetryDelay || 300;
              scheduleWsReconnect(delay);
              wsRetryDelay = Math.min((wsRetryDelay || 300) * 2, 2000);
            };
            ws.onerror = () => {
              ws.close();
            };
          }

          syncShots();
          connectWs();
          document.addEventListener('visibilitychange', () => {
            if (document.visibilityState !== 'visible') return;
            refreshLiveViews();
          });
          window.addEventListener('focus', () => {
            refreshLiveViews();
          });
          window.addEventListener('pageshow', () => {
            refreshLiveViews();
          });
          window.addEventListener('online', () => {
            refreshLiveViews();
          });
          setInterval(() => {
            if (document.visibilityState === 'hidden') return;
            refreshLiveViews();
          }, UI_REFRESH_INTERVAL_MS);
          if (chartScroll) {
            chartScroll.addEventListener('scroll', () => {
              if (!ENABLE_ANALYSIS) return;
              scheduleChart();
            }, { passive: true });
          }
          if (dayTimeChartScroll) {
            dayTimeChartScroll.addEventListener('scroll', () => {
              if (!ENABLE_ANALYSIS) return;
              scheduleChart();
            }, { passive: true });
          }
          window.addEventListener('resize', () => {
            if (!ENABLE_ANALYSIS) return;
            updateChartSize();
            scheduleChart();
          });
`;
