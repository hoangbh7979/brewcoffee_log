export function createRealtimeController(options = {}) {
  const {
    socketFactory,
    setStatus = () => {},
    refresh = () => {},
    onMessage = () => {},
    onEvent = () => {},
    isVisible = () => true,
    timers = globalThis,
    random = Math.random,
    connectionTimeoutMs = 6_500,
    heartbeatIntervalMs = 20_000,
    pollIntervalMs = 15_000,
    retryInitialMs = 500,
    retryMaxMs = 8_000,
  } = options;

  if (typeof socketFactory !== "function") {
    throw new TypeError("socketFactory must be a function");
  }

  const setTimer = timers.setTimeout.bind(timers);
  const clearTimer = timers.clearTimeout.bind(timers);
  const setRepeatingTimer = timers.setInterval.bind(timers);
  const clearRepeatingTimer = timers.clearInterval.bind(timers);
  const SOCKET_CONNECTING = 0;
  const SOCKET_OPEN = 1;

  let socket = null;
  let retryTimer = null;
  let connectTimer = null;
  let heartbeatTimer = null;
  let pollTimer = null;
  let retryDelay = retryInitialMs;
  let stopped = true;

  function emit(type) {
    try { onEvent({ type, at: Date.now() }); } catch {}
  }

  function clearConnectTimer() {
    if (connectTimer === null) return;
    clearTimer(connectTimer);
    connectTimer = null;
  }

  function clearHeartbeatTimer() {
    if (heartbeatTimer === null) return;
    clearRepeatingTimer(heartbeatTimer);
    heartbeatTimer = null;
  }

  function clearRetryTimer() {
    if (retryTimer === null) return;
    clearTimer(retryTimer);
    retryTimer = null;
  }

  function refreshSafely() {
    try {
      const task = refresh();
      if (task && typeof task.catch === "function") task.catch(() => {});
    } catch {}
  }

  function startFallbackPolling({ immediate = false } = {}) {
    if (pollTimer !== null) return;
    if (immediate && isVisible()) refreshSafely();
    pollTimer = setRepeatingTimer(() => {
      if (!stopped && isVisible()) refreshSafely();
    }, pollIntervalMs);
  }

  function stopFallbackPolling() {
    if (pollTimer === null) return;
    clearRepeatingTimer(pollTimer);
    pollTimer = null;
  }

  function scheduleReconnect() {
    if (stopped || retryTimer !== null) return;
    const delay = retryDelay;
    retryDelay = Math.min(retryMaxMs, Math.round(retryDelay * 1.8));
    const randomValue = Number(random());
    const jitter = 0.85 + (Number.isFinite(randomValue) ? Math.min(1, Math.max(0, randomValue)) : 0.5) * 0.3;
    retryTimer = setTimer(() => {
      retryTimer = null;
      connect();
    }, Math.round(delay * jitter));
  }

  function disconnect(current) {
    if (socket !== current) return;
    socket = null;
    clearConnectTimer();
    clearHeartbeatTimer();
    try { current.close(); } catch {}
    if (stopped) return;
    setStatus("Syncing", "polling");
    startFallbackPolling({ immediate: true });
    scheduleReconnect();
  }

  function startHeartbeat(current) {
    clearHeartbeatTimer();
    heartbeatTimer = setRepeatingTimer(() => {
      if (socket !== current || stopped) {
        clearHeartbeatTimer();
        return;
      }
      try { current.send("ping"); } catch { disconnect(current); }
    }, heartbeatIntervalMs);
  }

  function connect() {
    if (stopped) return;
    if (socket && (socket.readyState === SOCKET_OPEN || socket.readyState === SOCKET_CONNECTING)) return;

    clearRetryTimer();
    emit("connecting");

    let current;
    try {
      current = socketFactory();
    } catch {
      emit("socket_factory_error");
      setStatus("Syncing", "polling");
      startFallbackPolling({ immediate: true });
      scheduleReconnect();
      return;
    }

    socket = current;
    connectTimer = setTimer(() => {
      if (socket === current) emit("timeout");
      disconnect(current);
    }, connectionTimeoutMs);

    current.onopen = () => {
      if (socket !== current || stopped) {
        try { current.close(); } catch {}
        return;
      }
      clearConnectTimer();
      retryDelay = retryInitialMs;
      emit("open");
      setStatus("Live", "live");
      stopFallbackPolling();
      startHeartbeat(current);
    };
    current.onmessage = (event) => {
      if (socket === current && !stopped) onMessage(event);
    };
    current.onclose = () => {
      if (socket === current) emit("closed");
      disconnect(current);
    };
    current.onerror = () => {
      if (socket === current) emit("error");
      disconnect(current);
    };
  }

  function start() {
    if (!stopped) return;
    stopped = false;
    setStatus("Syncing", "polling");
    emit("start");
    startFallbackPolling({ immediate: true });
    connect();
  }

  function resume() {
    if (stopped) return;
    if (isVisible()) refreshSafely();
    connect();
  }

  function stop() {
    if (stopped) return;
    stopped = true;
    emit("stop");
    clearConnectTimer();
    clearHeartbeatTimer();
    clearRetryTimer();
    stopFallbackPolling();
    const current = socket;
    socket = null;
    try { current && current.close(); } catch {}
  }

  return { start, resume, stop };
}

function clientApp() {
  "use strict";

  const TARGET_MS = 25_000;
  const BUCKETS = [
    { key: "under20", label: "<20s", name: "Very fast", color: "#899eb7" },
    { key: "20to25", label: "20–25s", name: "Fast", color: "#b49f82" },
    { key: "25to28", label: "25–28s", name: "In range", color: "#92b79c" },
    { key: "28to30", label: "28–30s", name: "Slow", color: "#c99b64" },
    { key: "over30", label: ">30s", name: "Very slow", color: "#d08c7d" },
  ];

  const state = {
    date: "",
    filter: "all",
    rows: [],
    total: 0,
    page: 1,
    pagination: { page: 1, page_size: 12, page_count: 1 },
    daySummary: { total: 0, consistent: 0, consistency_percent: 0 },
    analysis: { total: 0, average_ms: 0, buckets: {}, daily: [] },
    window: { min_date: "", max_date: "" },
    analysisRange: { start_date: "", end_date: "" },
    analysisWindow: { min_date: "", max_date: "" },
    analysisAllHistory: true,
    chartMode: new URL(location.href).searchParams.get("view") === "shots" ? "shots" : "daily",
  };

  const elements = {
    table: document.getElementById("shotsTable"),
    date: document.getElementById("dateInput"),
    resultCount: document.getElementById("resultCount"),
    pagination: document.getElementById("pagination"),
    filterChips: document.getElementById("filterChips"),
    distribution: document.getElementById("distributionList"),
    distributionTotal: document.getElementById("distributionTotal"),
    bucketMix: document.getElementById("bucketMix"),
    chart: document.getElementById("trendChart"),
    analysisStart: document.getElementById("analysisStart"),
    analysisEnd: document.getElementById("analysisEnd"),
    analysisAll: document.getElementById("analysisAll"),
    analysisPeriod: document.getElementById("analysisPeriod"),
    livePill: document.getElementById("livePill"),
    liveStatus: document.getElementById("liveStatus"),
    toast: document.getElementById("toast"),
    dialog: document.getElementById("shotDialog"),
    dialogClose: document.getElementById("dialogClose"),
  };

  let shotsRequest = 0;
  let analysisRequest = 0;
  let toastTimer = null;
  let refreshTimer = null;

  function escapeHtml(value) {
    return String(value ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function formatShot(ms) {
    const value = Number(ms);
    return Number.isFinite(value) ? (value / 1000).toFixed(2) + "s" : "--.--s";
  }

  function formatClock(ms) {
    const date = new Date(Number(ms));
    if (!Number.isFinite(date.getTime())) return "—";
    return new Intl.DateTimeFormat("en-GB", {
      timeZone: "Asia/Bangkok",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: false,
    }).format(date);
  }

  function formatDateLabel(dateText) {
    if (!dateText) return "—";
    const parts = dateText.split("-");
    return parts.length === 3 ? parts[2] + "/" + parts[1] + "/" + parts[0] : dateText;
  }

  function formatDateCompact(dateText) {
    if (!dateText) return "—";
    const parts = dateText.split("-");
    if (parts.length !== 3) return dateText;
    const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    return parts[2] + " " + (months[Number(parts[1]) - 1] || parts[1]);
  }

  function shotDate(ms) {
    const value = Number(ms);
    if (!Number.isFinite(value)) return "";
    return new Date(value + 7 * 60 * 60 * 1000).toISOString().slice(0, 10);
  }

  function bucketFor(ms) {
    const value = Number(ms);
    if (!Number.isFinite(value)) return "unknown";
    if (value < 20_000) return "under20";
    if (value < 25_000) return "20to25";
    if (value < 28_000) return "25to28";
    if (value <= 30_000) return "28to30";
    return "over30";
  }

  function bucketInfo(key) {
    return BUCKETS.find((bucket) => bucket.key === key) || {
      key: "unknown",
      label: "—",
      name: "Unknown",
      color: "#777168",
    };
  }

  function deltaInfo(ms) {
    const value = Number(ms);
    if (!Number.isFinite(value)) return { text: "—", className: "" };
    const delta = (value - TARGET_MS) / 1000;
    if (Math.abs(delta) < 0.005) return { text: "On target", className: "" };
    return {
      text: (delta > 0 ? "+" : "−") + Math.abs(delta).toFixed(2) + "s",
      className: delta > 0 ? "positive" : "negative",
    };
  }

  async function apiJson(url) {
    const response = await fetch(url, { cache: "no-store" });
    let body;
    try { body = await response.json(); } catch { body = null; }
    if (!response.ok || !body || body.ok === false) {
      throw new Error(body && body.error ? body.error : "request_failed");
    }
    return body;
  }

  function hydrateInitialState() {
    const template = document.getElementById("initialState");
    if (!template) return false;
    try {
      const source = template.content ? template.content.textContent : template.textContent;
      const initial = JSON.parse(source || "{}");
      if (!initial.shots || !initial.analysis) return false;
      state.rows = Array.isArray(initial.shots.data) ? initial.shots.data : [];
      state.total = Number(initial.shots.total) || 0;
      state.pagination = normalizePagination(initial.shots.pagination, state.total);
      state.page = state.pagination.page;
      state.daySummary = initial.shots.day_summary || state.daySummary;
      state.date = initial.shots.selected_date || "";
      state.filter = initial.shots.bucket || "all";
      state.window = initial.shots.window || state.window;
      state.analysis = initial.analysis;
      state.analysisRange = initial.analysis.range || state.analysisRange;
      state.analysisWindow = initial.analysis.window || state.analysisWindow;
      state.analysisAllHistory = isAllHistory();
      syncDateControls();
      syncAnalysisControls();
      renderShots();
      updateSelectedMetrics();
      renderAnalysis();
      renderHeroMetrics();
      return true;
    } catch {
      return false;
    }
  }

  async function loadShots(options = {}) {
    const requestId = ++shotsRequest;
    if (!options.silent) renderLoading();

    const params = new URLSearchParams();
    if (state.date) params.set("date", state.date);
    if (state.filter !== "all") params.set("bucket", state.filter);
    if (state.page > 1) params.set("page", String(state.page));

    try {
      const body = await apiJson("/api/shots?" + params.toString());
      if (requestId !== shotsRequest) return;
      state.rows = Array.isArray(body.data) ? body.data : [];
      state.total = Number(body.total) || 0;
      state.pagination = normalizePagination(body.pagination, state.total);
      state.page = state.pagination.page;
      state.daySummary = body.day_summary || state.daySummary;
      state.date = body.selected_date || state.date;
      state.window = body.window || state.window;
      renderShots();
      syncDateControls();
      updateSelectedMetrics();
      syncUrl();
    } catch (error) {
      if (requestId !== shotsRequest) return;
      if (!options.silent) renderTableError();
      showToast("Could not load the shot log. Retrying shortly.");
    }
  }

  async function loadAnalysis(options = {}) {
    const requestId = ++analysisRequest;
    try {
      const params = new URLSearchParams();
      if (!state.analysisAllHistory) {
        params.set("start", state.analysisRange.start_date);
        params.set("end", state.analysisRange.end_date);
      } else {
        params.set("all", "1");
      }
      if (options.includePoints || state.chartMode === "shots") params.set("include_points", "1");
      const query = params.toString();
      const body = await apiJson("/api/analysis" + (query ? "?" + query : ""));
      if (requestId !== analysisRequest) return;
      state.analysis = body.data || state.analysis;
      state.analysisRange = state.analysis.range || state.analysisRange;
      state.analysisWindow = state.analysis.window || state.analysisWindow;
      if (state.analysisAllHistory) state.analysisAllHistory = isAllHistory();
      syncAnalysisControls();
      renderAnalysis();
      renderHeroMetrics();
    } catch {
      if (!options.silent) showToast("Analysis is temporarily unavailable.");
    }
  }

  function renderLoading() {
    elements.table.innerHTML = '<tr class="loading-row"><td colspan="6"><span class="loading-line"></span></td></tr>';
    elements.resultCount.textContent = "Loading shots…";
  }

  function renderTableError() {
    elements.table.innerHTML = '<tr><td class="empty-state" colspan="6">The shot log could not be loaded.</td></tr>';
    elements.resultCount.textContent = "Unavailable";
  }

  function renderShots() {
    if (state.rows.length === 0) {
      const message = state.filter === "all"
        ? "No extractions were recorded on this day."
        : "No extractions match this time range.";
      elements.table.innerHTML = '<tr><td class="empty-state" colspan="6">' + message + "</td></tr>";
    } else {
      elements.table.innerHTML = state.rows.map((row, index) => {
        const delta = deltaInfo(row.shot_ms);
        const bucket = bucketInfo(bucketFor(row.shot_ms));
        const brew = Number.isFinite(Number(row.brew_counter)) ? "#" + Math.trunc(Number(row.brew_counter)) : "—";
        const value = Number(row.shot_ms);
        const targetClass = Number.isFinite(value) && value >= 24_000 && value <= 27_000 ? " target" : "";
        return '<tr tabindex="0" data-row-index="' + index + '">' +
          '<td><span class="brew-number">' + escapeHtml(brew) + "</span></td>" +
          "<td>" + escapeHtml(formatClock(row.created_at)) + "</td>" +
          '<td><span class="shot-value">' + escapeHtml(formatShot(row.shot_ms)) + "</span></td>" +
          '<td><span class="delta ' + delta.className + '">' + escapeHtml(delta.text) + "</span></td>" +
          '<td><span class="class-tag' + targetClass + '">' + escapeHtml(bucket.name) + "</span></td>" +
          '<td><span class="row-arrow" aria-hidden="true">↗</span></td>' +
          "</tr>";
      }).join("");
    }

    const filterText = state.filter === "all" ? "shots" : bucketInfo(state.filter).label + " shots";
    elements.resultCount.textContent = state.total + " " + filterText;
    renderPagination();
  }

  function normalizePagination(value, total) {
    const pageSize = Math.max(1, Number(value && value.page_size) || 12);
    const pageCount = Math.max(1, Number(value && value.page_count) || Math.ceil(total / pageSize) || 1);
    const page = Math.min(pageCount, Math.max(1, Number(value && value.page) || 1));
    return { page, page_size: pageSize, page_count: pageCount };
  }

  function paginationItems(page, pageCount) {
    if (pageCount <= 7) return Array.from({ length: pageCount }, (_, index) => index + 1);
    if (page <= 4) return [1, 2, 3, 4, 5, "ellipsis", pageCount];
    if (page >= pageCount - 3) return [1, "ellipsis", pageCount - 4, pageCount - 3, pageCount - 2, pageCount - 1, pageCount];
    return [1, "ellipsis", page - 1, page, page + 1, "ellipsis", pageCount];
  }

  function paginationHref(targetPage) {
    const params = new URLSearchParams();
    if (state.date) params.set("date", state.date);
    if (state.filter !== "all") params.set("bucket", state.filter);
    if (targetPage > 1) params.set("page", String(targetPage));
    return "/" + (params.toString() ? "?" + params.toString() : "") + "#shot-log";
  }

  function renderPagination() {
    if (!elements.pagination) return;
    const total = state.total;
    const meta = normalizePagination(state.pagination, total);
    const page = meta.page;
    const pageCount = meta.page_count;
    const start = total === 0 ? 0 : (page - 1) * meta.page_size + 1;
    const end = Math.min(total, page * meta.page_size);
    const summary = total === 0 ? "No shots on this day" : "Showing " + start + "–" + end + " of " + total + " shots";
    if (total === 0 || pageCount === 1) {
      elements.pagination.className = "pagination-shell" + (total === 0 ? " is-empty" : "");
      elements.pagination.innerHTML = '<span class="page-summary" id="pageSummary">' + summary + "</span>";
      return;
    }
    const control = (targetPage, label, direction) => targetPage < 1 || targetPage > pageCount
      ? '<span class="page-button disabled" aria-disabled="true"><span aria-hidden="true">' + label + '</span><span class="sr-only">' + direction + " page</span></span>"
      : '<a class="page-button" href="' + escapeHtml(paginationHref(targetPage)) + '" aria-label="' + direction + ' page"><span aria-hidden="true">' + label + "</span></a>";
    const pages = paginationItems(page, pageCount).map((item) => item === "ellipsis"
      ? '<span class="page-ellipsis" aria-hidden="true">…</span>'
      : '<a class="page-number' + (item === page ? " active" : "") + '" href="' + escapeHtml(paginationHref(item)) + '"' + (item === page ? ' aria-current="page"' : "") + ">" + item + "</a>"
    ).join("");
    elements.pagination.className = "pagination-shell";
    elements.pagination.setAttribute("aria-label", "Shot log pages");
    elements.pagination.innerHTML = '<span class="page-summary" id="pageSummary">' + summary + '</span><div class="pagination-controls">' +
      control(page - 1, "‹", "Previous") + '<span class="page-numbers">' + pages + "</span>" + control(page + 1, "›", "Next") + "</div>";
  }

  function syncDateControls() {
    elements.date.value = state.date;
    elements.date.min = state.window.min_date || "";
    elements.date.max = state.window.max_date || "";
  }

  function syncAnalysisControls() {
    elements.analysisStart.value = state.analysisRange.start_date || "";
    elements.analysisEnd.value = state.analysisRange.end_date || "";
    elements.analysisStart.min = state.analysisWindow.min_date || "";
    elements.analysisStart.max = state.analysisWindow.max_date || "";
    elements.analysisEnd.min = state.analysisWindow.min_date || "";
    elements.analysisEnd.max = state.analysisWindow.max_date || "";
    elements.analysisAll.classList.toggle("active", state.analysisAllHistory);
  }

  function isAllHistory() {
    return Boolean(
      state.analysisRange.start_date
      && state.analysisRange.start_date === state.analysisWindow.min_date
      && state.analysisRange.end_date === state.analysisWindow.max_date
    );
  }

  function syncUrl() {
    const url = new URL(location.href);
    url.searchParams.set("date", state.date);
    if (state.filter === "all") url.searchParams.delete("bucket");
    else url.searchParams.set("bucket", state.filter);
    if (state.page > 1) url.searchParams.set("page", String(state.page));
    else url.searchParams.delete("page");
    history.replaceState(null, "", url.pathname + "?" + url.searchParams.toString() + url.hash);
  }

  function updateSelectedMetrics() {
    document.getElementById("metricSelectedDate").textContent = formatDateCompact(state.date);
    document.getElementById("metricSelectedCount").textContent = (Number(state.daySummary.total) || 0) + " shots";
    document.getElementById("metricDailyConsistency").textContent = (Number(state.daySummary.consistency_percent) || 0) + "%";
    const latest = state.rows[0];
    document.getElementById("heroLatest").textContent = latest ? formatShot(latest.shot_ms) : "--.--s";
  }

  function renderHeroMetrics() {
    const analysis = state.analysis;
    document.getElementById("metricTotal").textContent = String(analysis.total || 0);
    document.getElementById("metricAverage").textContent = formatShot(analysis.average_ms);
    document.getElementById("heroConsistency").textContent = (Number(analysis.consistency_30d_percent) || 0) + "%";
  }

  function renderAnalysis() {
    const analysis = state.analysis;
    const total = Number(analysis.total) || 0;
    elements.distributionTotal.textContent = total + (total === 1 ? " extraction" : " extractions");
    elements.distribution.innerHTML = BUCKETS.map((bucket) => {
      const count = Number(analysis.buckets && analysis.buckets[bucket.key]) || 0;
      const width = total > 0 ? Math.max(count > 0 ? 3 : 0, count * 100 / total) : 0;
      const href = escapeHtml('/?date=' + encodeURIComponent(state.date) + '&bucket=' + encodeURIComponent(bucket.key) + '#shot-log');
      return '<a class="distribution-row" data-bucket="' + bucket.key + '" href="' + href + '">' +
        '<span class="distribution-label">' + bucket.label + "</span>" +
        '<span class="bar-track"><i class="bar-fill" style="width:' + width.toFixed(1) + "%;background:" + bucket.color + '"></i></span>' +
        '<strong class="distribution-value">' + count + "</strong>" +
        "</a>";
    }).join("");
    elements.analysisPeriod.textContent = analysisPeriodText(analysis);
    elements.bucketMix.innerHTML = bucketMixMarkup(analysis);
    elements.chart.innerHTML = trendChartMarkup(analysis, state.chartMode);
  }

  function analysisPeriodText(analysis) {
    if (!analysis || !analysis.range) return "No analysis range available";
    const range = analysis.range;
    const window = analysis.window || {};
    const allHistory = range.start_date === window.min_date && range.end_date === window.max_date;
    const label = allHistory ? "All history" : "Selected range";
    return label + " · " + formatDateLabel(range.start_date) + " → " + formatDateLabel(range.end_date) + " · " + (Number(analysis.total) || 0) + " shots · " + (Number(analysis.consistency_percent) || 0) + "% consistent at 24–27s";
  }

  function bucketMixMarkup(analysis) {
    const buckets = analysis && analysis.buckets ? analysis.buckets : {};
    const total = analysis ? Number(analysis.total) || 0 : 0;
    const cx = 132;
    const cy = 122;
    const outerRadius = 104;
    const innerRadius = 54;
    let angle = -90;
    const segments = BUCKETS.map((bucket, index) => {
      const count = Number(buckets[bucket.key]) || 0;
      const span = total > 0 ? count / total * 360 : 0;
      const start = angle;
      const end = angle + Math.min(span, 359.99);
      angle = end;
      return { index, bucket, count, start, end, span };
    });
    const slices = segments.map(({ index, bucket, count, start, end, span }) => {
      if (span <= 0) return "";
      const path = pieSlicePath(cx, cy, outerRadius, innerRadius, start, end);
      return '<path class="pie-slice" style="--slice-delay:' + (index * 70) + 'ms" d="' + path + '" fill="' + bucket.color + '"><title>' + escapeHtml(bucket.label) + ' · ' + count + ' shots</title></path>';
    }).join("");
    const labels = segments.map(({ bucket, count, start, span }) => {
      const percent = total > 0 ? Math.round(count * 100 / total) : 0;
      if (span <= 0) return "";
      const mid = start + span / 2;
      const point = polarPoint(cx, cy, (outerRadius + innerRadius) / 2, mid);
      return '<text class="pie-slice-label' + (percent < 8 ? ' compact' : '') + '" x="' + point.x.toFixed(2) + '" y="' + (point.y + 3).toFixed(2) + '" text-anchor="middle">' + percent + '%</text>';
    }).join("");
    const legend = segments.map(({ bucket, count }) => {
      const percent = total > 0 ? Math.round(count * 100 / total) : 0;
      return '<div class="donut-legend-row"><span><i style="background:' + bucket.color + '"></i>' + escapeHtml(bucket.label) + '</span><strong>' + percent + '%</strong></div>';
    }).join("");
    return '<div class="donut-shell"><svg class="donut-chart" viewBox="0 0 264 244" role="img" aria-label="Shot distribution by extraction time">' +
      '<circle class="donut-track" cx="' + cx + '" cy="' + cy + '" r="' + outerRadius + '"></circle>' +
      slices + labels +
      '<circle class="donut-hole" cx="' + cx + '" cy="' + cy + '" r="' + innerRadius + '"></circle>' +
      '<text class="donut-total" x="' + cx + '" y="' + (cy - 3) + '" text-anchor="middle">' + total + '</text>' +
      '<text class="donut-caption" x="' + cx + '" y="' + (cy + 19) + '" text-anchor="middle">shots</text></svg></div>' +
      '<div class="donut-legend">' + legend + '</div>';
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
    return 'M' + outerStart.x.toFixed(2) + ' ' + outerStart.y.toFixed(2) +
      ' A' + outerRadius + ' ' + outerRadius + ' 0 ' + large + ' 1 ' + outerEnd.x.toFixed(2) + ' ' + outerEnd.y.toFixed(2) +
      ' L' + innerEnd.x.toFixed(2) + ' ' + innerEnd.y.toFixed(2) +
      ' A' + innerRadius + ' ' + innerRadius + ' 0 ' + large + ' 0 ' + innerStart.x.toFixed(2) + ' ' + innerStart.y.toFixed(2) + ' Z';
  }

  function trendChartMarkup(analysis, mode) {
    if (mode === "shots") return shotScatterChartMarkup(analysis);
    const rows = analysis && Array.isArray(analysis.daily)
      ? analysis.daily.filter((row) => Number.isFinite(Number(row.average_ms)))
      : [];
    if (rows.length === 0) return '<p class="chart-empty">No analysis data in this date range.</p>';

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
    const points = rows.map((row, index) => ({ x: xFor(index), y: yFor(Number(row.average_ms) / 1000), row }));
    const linePath = points.map((point, index) => (index === 0 ? "M" : "L") + point.x.toFixed(2) + " " + point.y.toFixed(2)).join(" ");
    const lastPoint = points[points.length - 1];
    const areaPath = rows.length > 1
      ? linePath + " L" + lastPoint.x.toFixed(2) + " " + (height - pad.bottom) + " L" + points[0].x.toFixed(2) + " " + (height - pad.bottom) + " Z"
      : "";
    const grid = Array.from({ length: 5 }, (_, index) => {
      const value = minY + (maxY - minY) * index / 4;
      const y = yFor(value);
      return '<g><line class="trend-grid" x1="' + pad.left + '" y1="' + y.toFixed(2) + '" x2="' + (width - pad.right) + '" y2="' + y.toFixed(2) + '"></line><text class="trend-axis" x="' + (pad.left - 9) + '" y="' + (y + 3).toFixed(2) + '" text-anchor="end">' + value.toFixed(0) + "s</text></g>";
    }).join("");
    const labelIndexes = Array.from(new Set([0, Math.floor((rows.length - 1) / 2), rows.length - 1]));
    const labels = labelIndexes.map((index) => {
      const anchor = index === 0 ? "start" : index === rows.length - 1 ? "end" : "middle";
      return '<text class="trend-axis" x="' + points[index].x.toFixed(2) + '" y="' + (height - 10) + '" text-anchor="' + anchor + '">' + escapeHtml(formatDateLabel(rows[index].date)) + "</text>";
    }).join("");
    const dots = points.map((point) =>
      '<circle class="trend-point" cx="' + point.x.toFixed(2) + '" cy="' + point.y.toFixed(2) + '" r="' + (rows.length === 1 ? 6 : 4) + '"><title>' + escapeHtml(formatDateLabel(point.row.date)) + " · " + (Number(point.row.count) || 0) + " shots · " + formatShot(point.row.average_ms) + " average · " + (Number(point.row.consistency_percent) || 0) + "% consistent</title></circle>"
    ).join("");
    const bandTop = yFor(27);
    const bandBottom = yFor(24);
    const singleDayLabel = rows.length === 1
      ? '<text class="trend-single-value" x="' + (width / 2) + '" y="' + (pad.top + 25) + '" text-anchor="middle">' + formatShot(rows[0].average_ms) + ' average · ' + (Number(rows[0].count) || 0) + ' shots</text>'
      : "";

    return '<svg viewBox="0 0 ' + width + " " + height + '" aria-hidden="true">' +
      '<defs><linearGradient id="trendGradient" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#c99b64" stop-opacity=".3"></stop><stop offset="1" stop-color="#c99b64" stop-opacity="0"></stop></linearGradient></defs>' +
      '<rect class="consistency-band" x="' + pad.left + '" y="' + bandTop.toFixed(2) + '" width="' + plotWidth + '" height="' + (bandBottom - bandTop).toFixed(2) + '"></rect>' +
      grid +
      '<line class="target-line" x1="' + pad.left + '" y1="' + yFor(25).toFixed(2) + '" x2="' + (width - pad.right) + '" y2="' + yFor(25).toFixed(2) + '"></line>' +
      (areaPath ? '<path class="trend-area" d="' + areaPath + '"></path>' : "") +
      '<path class="trend-line" d="' + linePath + '"></path>' + dots + labels + singleDayLabel + "</svg>";
  }

  function shotScatterChartMarkup(analysis) {
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
      return '<g><line class="scatter-grid" x1="' + pad.left + '" y1="' + y.toFixed(2) + '" x2="' + (width - pad.right) + '" y2="' + y.toFixed(2) + '"></line><text class="scatter-axis" x="' + (pad.left - 10) + '" y="' + (y + 3).toFixed(2) + '" text-anchor="end">' + value + 's</text></g>';
    }).join("");
    const xTicks = Array.from({ length: 48 }, (_, index) => index * 30);
    const xGrid = xTicks.map((minutes) => {
      const x = xFor(minutes);
      const major = minutes % 60 === 0 || minutes === 1410;
      return '<g><line class="scatter-grid' + (major ? ' major' : '') + '" x1="' + x.toFixed(2) + '" y1="' + pad.top + '" x2="' + x.toFixed(2) + '" y2="' + (height - pad.bottom) + '"></line>' + (major ? '<text class="scatter-axis" x="' + x.toFixed(2) + '" y="' + (height - 13) + '" text-anchor="' + (minutes === 0 ? 'start' : minutes === 1410 ? 'end' : 'middle') + '">' + formatTimeOfDay(minutes) + '</text>' : '') + '</g>';
    }).join("");
    const dots = points.map((point) => {
      const seconds = Number(point.shot_ms) / 1000;
      const minutes = bangkokMinutes(point.created_at);
      const bucket = bucketInfo(bucketFor(point.shot_ms));
      return '<circle class="scatter-point" cx="' + xFor(minutes).toFixed(2) + '" cy="' + yFor(seconds).toFixed(2) + '" r="3.4" fill="' + bucket.color + '"><title>' + escapeHtml(formatTimeOfDay(minutes)) + ' · ' + escapeHtml(formatShot(point.shot_ms)) + ' · ' + escapeHtml(bucket.name) + '</title></circle>';
    }).join("");
    const bandTop = yFor(27);
    const bandBottom = yFor(24);
    return '<svg class="scatter-chart" viewBox="0 0 ' + width + ' ' + height + '" role="img" aria-label="Shot extraction time by time of day">' +
      '<rect class="consistency-band" x="' + pad.left + '" y="' + bandTop.toFixed(2) + '" width="' + plotWidth + '" height="' + (bandBottom - bandTop).toFixed(2) + '"></rect>' +
      yGrid + xGrid +
      '<line class="target-line" x1="' + pad.left + '" y1="' + yFor(25).toFixed(2) + '" x2="' + (width - pad.right) + '" y2="' + yFor(25).toFixed(2) + '"></line>' + dots + '</svg>';
  }

  function bangkokMinutes(timestamp) {
    const shifted = ((Number(timestamp) + 7 * 60 * 60 * 1000) % (24 * 60 * 60 * 1000) + (24 * 60 * 60 * 1000)) % (24 * 60 * 60 * 1000);
    return Math.floor(shifted / 60_000) + (shifted % 60_000) / 60_000;
  }

  function formatTimeOfDay(minutes) {
    const safe = Math.max(0, Math.min(1439, Math.round(Number(minutes) || 0)));
    return String(Math.floor(safe / 60)).padStart(2, "0") + ":" + String(safe % 60).padStart(2, "0");
  }

  function openShot(index) {
    const row = state.rows[index];
    if (!row || !elements.dialog) return;
    const bucket = bucketInfo(bucketFor(row.shot_ms));
    const delta = deltaInfo(row.shot_ms);
    const brew = Number.isFinite(Number(row.brew_counter)) ? "#" + Math.trunc(Number(row.brew_counter)) : "—";
    document.getElementById("dialogBrew").textContent = brew;
    document.getElementById("dialogTime").textContent = formatShot(row.shot_ms);
    document.getElementById("dialogRecorded").textContent = formatDateLabel(shotDate(row.created_at)) + " · " + formatClock(row.created_at);
    document.getElementById("dialogDelta").textContent = delta.text;
    document.getElementById("dialogAverage").textContent = formatShot(row.avg_ms);
    document.getElementById("dialogClass").textContent = bucket.name + " (" + bucket.label + ")";
    elements.dialog.showModal();
  }

  function changeAnalysisRange(boundary, date) {
    if (!date || date < state.analysisWindow.min_date || date > state.analysisWindow.max_date) return;
    state.analysisAllHistory = false;
    state.analysisRange[boundary] = date;
    if (state.analysisRange.start_date > state.analysisRange.end_date) {
      if (boundary === "start_date") state.analysisRange.end_date = date;
      else state.analysisRange.start_date = date;
    }
    syncAnalysisControls();
    loadAnalysis();
  }

  function showAllAnalysis() {
    state.analysisAllHistory = true;
    state.analysisRange = {
      start_date: state.analysisWindow.min_date,
      end_date: state.analysisWindow.max_date,
    };
    syncAnalysisControls();
    loadAnalysis();
  }

  function showToast(message) {
    elements.toast.textContent = message;
    elements.toast.classList.add("show");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => elements.toast.classList.remove("show"), 3200);
  }

  function setLiveStatus(status, stateName) {
    elements.liveStatus.textContent = status;
    elements.livePill.dataset.state = stateName;
  }

  function scheduleRealtimeRefresh(message) {
    clearTimeout(refreshTimer);
    refreshTimer = setTimeout(() => {
      loadAnalysis({ silent: true });
      if (shotDate(message && message.created_at) === state.date) {
        loadShots({ silent: true });
      } else {
        showToast("A new extraction was added to " + formatDateLabel(shotDate(message && message.created_at)) + ".");
      }
    }, 450);
  }

  const realtime = createRealtimeController({
    socketFactory: () => {
      const protocol = location.protocol === "https:" ? "wss:" : "ws:";
      return new WebSocket(protocol + "//" + location.host + "/api/ws");
    },
    setStatus: setLiveStatus,
    refresh: () => {
      loadShots({ silent: true });
      loadAnalysis({ silent: true });
    },
    onMessage: (event) => {
      if (event.data === "pong") return;
      try { scheduleRealtimeRefresh(JSON.parse(event.data)); } catch {}
    },
    onEvent: ({ type }) => {
      elements.livePill.dataset.event = type;
      elements.livePill.title = "Realtime: " + type;
    },
    isVisible: () => document.visibilityState === "visible",
  });

  if (!hydrateInitialState()) {
    loadShots({ silent: true });
    loadAnalysis({ silent: true });
  }
  elements.table.addEventListener("click", (event) => {
    const row = event.target.closest("[data-row-index]");
    if (row) openShot(Number(row.dataset.rowIndex));
  });
  elements.table.addEventListener("keydown", (event) => {
    if (event.key !== "Enter" && event.key !== " ") return;
    const row = event.target.closest("[data-row-index]");
    if (row) {
      event.preventDefault();
      openShot(Number(row.dataset.rowIndex));
    }
  });
  elements.dialogClose.addEventListener("click", () => elements.dialog.close());
  elements.dialog.addEventListener("click", (event) => {
    if (event.target === elements.dialog) elements.dialog.close();
  });

  const sections = Array.from(document.querySelectorAll(".section-anchor"));
  const navLinks = Array.from(document.querySelectorAll("[data-nav]"));
  if ("IntersectionObserver" in window) {
    const observer = new IntersectionObserver((entries) => {
      const visible = entries.filter((entry) => entry.isIntersecting).sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
      if (!visible) return;
      navLinks.forEach((link) => link.classList.toggle("active", link.dataset.nav === visible.target.id));
    }, { rootMargin: "-35% 0px -55%", threshold: [0, 0.2, 0.6] });
    sections.forEach((section) => observer.observe(section));
  }

  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState !== "visible") return;
    realtime.resume();
  });
  window.addEventListener("online", () => realtime.resume());
  window.addEventListener("pagehide", () => realtime.stop(), { once: true });
  realtime.start();

}

export const CLIENT_SCRIPT = `const createRealtimeController = ${createRealtimeController.toString()};\n(${clientApp.toString()})();`;
