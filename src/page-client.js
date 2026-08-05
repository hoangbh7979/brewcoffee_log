function clientApp() {
  "use strict";

  const PAGE_SIZE = 10;
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
    page: 1,
    filter: "all",
    rows: [],
    pagination: { page: 1, page_size: PAGE_SIZE, total: 0, total_pages: 1 },
    analysis: { total: 0, average_ms: 0, buckets: {}, daily: [] },
    window: { min_date: "", max_date: "" },
    chartPoints: [],
  };

  const elements = {
    table: document.getElementById("shotsTable"),
    date: document.getElementById("dateInput"),
    previousDay: document.getElementById("previousDay"),
    nextDay: document.getElementById("nextDay"),
    resultCount: document.getElementById("resultCount"),
    pageSummary: document.getElementById("pageSummary"),
    pagination: document.getElementById("pagination"),
    filterChips: document.getElementById("filterChips"),
    distribution: document.getElementById("distributionList"),
    distributionTotal: document.getElementById("distributionTotal"),
    chart: document.getElementById("trendChart"),
    chartShell: document.getElementById("chartShell"),
    chartTooltip: document.getElementById("chartTooltip"),
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
  let socket = null;
  let socketRetry = null;
  let socketRetryDelay = 500;
  let pingTimer = null;
  let fallbackTimer = null;

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
      state.pagination = initial.shots.pagination || state.pagination;
      state.page = Number(state.pagination.page) || 1;
      state.date = initial.shots.selected_date || "";
      state.filter = initial.shots.bucket || "all";
      state.window = initial.shots.window || state.window;
      state.analysis = initial.analysis;
      syncDateControls();
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

    const params = new URLSearchParams({
      page: String(state.page),
      page_size: String(PAGE_SIZE),
    });
    if (state.date) params.set("date", state.date);
    if (state.filter !== "all") params.set("bucket", state.filter);

    try {
      const body = await apiJson("/api/shots?" + params.toString());
      if (requestId !== shotsRequest) return;
      state.rows = Array.isArray(body.data) ? body.data : [];
      state.pagination = body.pagination || state.pagination;
      state.date = body.selected_date || state.date;
      state.window = body.window || state.window;
      renderShots();
      syncDateControls();
      updateSelectedMetrics();
    } catch (error) {
      if (requestId !== shotsRequest) return;
      if (!options.silent) renderTableError();
      showToast("Could not load the shot log. Retrying shortly.");
    }
  }

  async function loadAnalysis(options = {}) {
    const requestId = ++analysisRequest;
    try {
      const body = await apiJson("/api/analysis");
      if (requestId !== analysisRequest) return;
      state.analysis = body.data || state.analysis;
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
        const targetClass = bucket.key === "25to28" ? " target" : "";
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

    const pagination = state.pagination;
    const filterText = state.filter === "all" ? "shots" : bucketInfo(state.filter).label + " shots";
    elements.resultCount.textContent = pagination.total + " " + filterText;
    elements.pageSummary.textContent = "Page " + pagination.page + " of " + pagination.total_pages;
    renderPagination();
  }

  function paginationItems(current, total) {
    if (total <= 7) return Array.from({ length: total }, (_, index) => index + 1);
    const pages = new Set([1, 2, total - 1, total, current - 1, current, current + 1]);
    const values = Array.from(pages).filter((page) => page >= 1 && page <= total).sort((a, b) => a - b);
    const items = [];
    values.forEach((page, index) => {
      if (index > 0 && page - values[index - 1] > 1) items.push("ellipsis-" + index);
      items.push(page);
    });
    return items;
  }

  function renderPagination() {
    const current = state.pagination.page;
    const total = state.pagination.total_pages;
    const pageHref = (page) => {
      const params = new URLSearchParams({ date: state.date, page: String(page), bucket: state.filter });
      return "/?" + params.toString() + "#shot-log";
    };
    const previous = current <= 1
      ? '<span class="page-button disabled" aria-hidden="true">‹</span>'
      : '<a class="page-button" data-page="' + (current - 1) + '" aria-label="Previous page" href="' + pageHref(current - 1) + '">‹</a>';
    const next = current >= total
      ? '<span class="page-button disabled" aria-hidden="true">›</span>'
      : '<a class="page-button" data-page="' + (current + 1) + '" aria-label="Next page" href="' + pageHref(current + 1) + '">›</a>';
    const pages = paginationItems(current, total).map((item) => {
      if (typeof item === "string") return '<span class="page-ellipsis">…</span>';
      return '<a class="page-button' + (item === current ? " active" : "") + '" data-page="' + item + '" aria-label="Page ' + item + '" href="' + pageHref(item) + '" ' + (item === current ? 'aria-current="page"' : "") + ">" + item + "</a>";
    }).join("");
    elements.pagination.innerHTML = previous + pages + next;
  }

  function syncDateControls() {
    elements.date.value = state.date;
    elements.date.min = state.window.min_date || "";
    elements.date.max = state.window.max_date || "";
    elements.previousDay.disabled = Boolean(state.window.min_date && state.date <= state.window.min_date);
    elements.nextDay.disabled = Boolean(state.window.max_date && state.date >= state.window.max_date);
  }

  function updateSelectedMetrics() {
    document.getElementById("metricSelected").textContent = String(state.pagination.total);
    const latest = state.rows[0];
    document.getElementById("heroLatest").textContent = latest ? formatShot(latest.shot_ms) : "--.--s";
  }

  function renderHeroMetrics() {
    const analysis = state.analysis;
    document.getElementById("metricTotal").textContent = String(analysis.total || 0);
    document.getElementById("metricAverage").textContent = formatShot(analysis.average_ms);
    const buckets = analysis.buckets || {};
    const consistent = (Number(buckets["25to28"]) || 0) + (Number(buckets["28to30"]) || 0);
    const percent = analysis.total > 0 ? Math.round(consistent * 100 / analysis.total) : 0;
    document.getElementById("heroConsistency").textContent = percent + "%";
  }

  function renderAnalysis() {
    const analysis = state.analysis;
    const total = Number(analysis.total) || 0;
    elements.distributionTotal.textContent = total + (total === 1 ? " extraction" : " extractions");
    elements.distribution.innerHTML = BUCKETS.map((bucket) => {
      const count = Number(analysis.buckets && analysis.buckets[bucket.key]) || 0;
      const width = total > 0 ? Math.max(count > 0 ? 3 : 0, count * 100 / total) : 0;
      return '<button class="distribution-row" type="button" data-bucket="' + bucket.key + '">' +
        '<span class="distribution-label">' + bucket.label + "</span>" +
        '<span class="bar-track"><i class="bar-fill" style="width:' + width.toFixed(1) + "%;background:" + bucket.color + '"></i></span>' +
        '<strong class="distribution-value">' + count + "</strong>" +
        "</button>";
    }).join("");
    requestAnimationFrame(drawChart);
  }

  function drawChart() {
    const canvas = elements.chart;
    const shell = elements.chartShell;
    if (!canvas || !shell) return;
    const rect = shell.getBoundingClientRect();
    const width = Math.max(320, Math.round(rect.width));
    const height = Math.max(260, Math.round(rect.height));
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.round(width * dpr);
    canvas.height = Math.round(height * dpr);
    const ctx = canvas.getContext("2d");
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, width, height);

    const rows = Array.isArray(state.analysis.daily) ? state.analysis.daily : [];
    if (rows.length === 0) {
      ctx.fillStyle = "#777168";
      ctx.font = "12px Inter, sans-serif";
      ctx.textAlign = "center";
      ctx.fillText("No analysis data yet", width / 2, height / 2);
      state.chartPoints = [];
      return;
    }

    const pad = { top: 24, right: 18, bottom: 34, left: 42 };
    const plotWidth = width - pad.left - pad.right;
    const plotHeight = height - pad.top - pad.bottom;
    const seconds = rows.map((row) => Number(row.average_ms) / 1000).filter(Number.isFinite);
    const minY = Math.max(0, Math.floor(Math.min(20, ...seconds) - 3));
    const maxY = Math.ceil(Math.max(30, ...seconds) + 3);
    const xFor = (index) => pad.left + (rows.length === 1 ? plotWidth / 2 : index * plotWidth / (rows.length - 1));
    const yFor = (value) => pad.top + (maxY - value) * plotHeight / Math.max(1, maxY - minY);

    ctx.strokeStyle = "rgba(245,238,225,.09)";
    ctx.fillStyle = "#777168";
    ctx.font = "10px Inter, sans-serif";
    ctx.textAlign = "right";
    ctx.textBaseline = "middle";
    for (let index = 0; index <= 4; index += 1) {
      const value = minY + (maxY - minY) * index / 4;
      const y = yFor(value);
      ctx.beginPath();
      ctx.moveTo(pad.left, y);
      ctx.lineTo(width - pad.right, y);
      ctx.stroke();
      ctx.fillText(value.toFixed(0) + "s", pad.left - 9, y);
    }

    const targetY = yFor(25);
    ctx.setLineDash([5, 6]);
    ctx.strokeStyle = "rgba(201,155,100,.65)";
    ctx.beginPath();
    ctx.moveTo(pad.left, targetY);
    ctx.lineTo(width - pad.right, targetY);
    ctx.stroke();
    ctx.setLineDash([]);

    const gradient = ctx.createLinearGradient(0, pad.top, 0, height - pad.bottom);
    gradient.addColorStop(0, "rgba(201,155,100,.28)");
    gradient.addColorStop(1, "rgba(201,155,100,0)");
    ctx.beginPath();
    rows.forEach((row, index) => {
      const x = xFor(index);
      const y = yFor(Number(row.average_ms) / 1000);
      if (index === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    });
    ctx.lineTo(xFor(rows.length - 1), height - pad.bottom);
    ctx.lineTo(xFor(0), height - pad.bottom);
    ctx.closePath();
    ctx.fillStyle = gradient;
    ctx.fill();

    ctx.beginPath();
    rows.forEach((row, index) => {
      const x = xFor(index);
      const y = yFor(Number(row.average_ms) / 1000);
      if (index === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    });
    ctx.strokeStyle = "#c99b64";
    ctx.lineWidth = 2;
    ctx.stroke();

    state.chartPoints = rows.map((row, index) => {
      const point = { x: xFor(index), y: yFor(Number(row.average_ms) / 1000), row };
      ctx.beginPath();
      ctx.arc(point.x, point.y, 3.5, 0, Math.PI * 2);
      ctx.fillStyle = "#eee8de";
      ctx.fill();
      ctx.strokeStyle = "#171513";
      ctx.lineWidth = 2;
      ctx.stroke();
      return point;
    });

    const labelIndexes = Array.from(new Set([0, Math.floor((rows.length - 1) / 2), rows.length - 1]));
    ctx.fillStyle = "#777168";
    ctx.font = "10px Inter, sans-serif";
    ctx.textBaseline = "top";
    labelIndexes.forEach((index) => {
      ctx.textAlign = index === 0 ? "left" : index === rows.length - 1 ? "right" : "center";
      ctx.fillText(formatDateLabel(rows[index].date).slice(0, 5), xFor(index), height - pad.bottom + 12);
    });
  }

  function showChartTooltip(event) {
    if (state.chartPoints.length === 0) return;
    const rect = elements.chart.getBoundingClientRect();
    const x = event.clientX - rect.left;
    let nearest = state.chartPoints[0];
    state.chartPoints.forEach((point) => {
      if (Math.abs(point.x - x) < Math.abs(nearest.x - x)) nearest = point;
    });
    if (Math.abs(nearest.x - x) > 28) {
      elements.chartTooltip.hidden = true;
      return;
    }
    elements.chartTooltip.innerHTML = formatDateLabel(nearest.row.date) + " · " + nearest.row.count + " shots<strong>" + formatShot(nearest.row.average_ms) + " avg</strong>";
    elements.chartTooltip.style.left = nearest.x + "px";
    elements.chartTooltip.style.top = nearest.y + "px";
    elements.chartTooltip.hidden = false;
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

  function setFilter(filter) {
    state.filter = filter || "all";
    state.page = 1;
    elements.filterChips.querySelectorAll("[data-filter]").forEach((button) => {
      button.classList.toggle("active", button.dataset.filter === state.filter);
    });
    loadShots();
  }

  function changeDate(date) {
    if (!date || date < state.window.min_date || date > state.window.max_date) return;
    state.date = date;
    state.page = 1;
    loadShots();
  }

  function shiftDate(days) {
    if (!state.date) return;
    const start = Date.parse(state.date + "T00:00:00+07:00");
    const shifted = new Date(start + days * 24 * 60 * 60 * 1000 + 7 * 60 * 60 * 1000).toISOString().slice(0, 10);
    changeDate(shifted);
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

  function stopFallbackPoll() {
    clearInterval(fallbackTimer);
    fallbackTimer = null;
  }

  function startFallbackPoll() {
    if (fallbackTimer) return;
    fallbackTimer = setInterval(() => {
      if (document.visibilityState === "visible") {
        loadShots({ silent: true });
        loadAnalysis({ silent: true });
      }
    }, 15_000);
  }

  function connectSocket() {
    if (socket && (socket.readyState === WebSocket.OPEN || socket.readyState === WebSocket.CONNECTING)) return;
    clearTimeout(socketRetry);
    setLiveStatus("Connecting", "connecting");
    const protocol = location.protocol === "https:" ? "wss:" : "ws:";
    const current = new WebSocket(protocol + "//" + location.host + "/api/ws");
    socket = current;

    current.onopen = () => {
      socketRetryDelay = 500;
      setLiveStatus("Live", "live");
      stopFallbackPoll();
      clearInterval(pingTimer);
      pingTimer = setInterval(() => {
        try { current.send("ping"); } catch {}
      }, 20_000);
    };
    current.onmessage = (event) => {
      if (event.data === "pong") return;
      try { scheduleRealtimeRefresh(JSON.parse(event.data)); } catch {}
    };
    current.onclose = () => {
      if (socket === current) socket = null;
      clearInterval(pingTimer);
      setLiveStatus("Reconnecting", "connecting");
      startFallbackPoll();
      socketRetry = setTimeout(connectSocket, socketRetryDelay);
      socketRetryDelay = Math.min(socketRetryDelay * 1.8, 8_000);
    };
    current.onerror = () => {
      try { current.close(); } catch {}
    };
  }

  if (!hydrateInitialState()) {
    loadShots({ silent: true });
    loadAnalysis({ silent: true });
  }
  connectSocket();

  elements.date.addEventListener("change", () => changeDate(elements.date.value));
  elements.previousDay.addEventListener("click", () => shiftDate(-1));
  elements.nextDay.addEventListener("click", () => shiftDate(1));
  elements.filterChips.addEventListener("click", (event) => {
    const button = event.target.closest("[data-filter]");
    if (button) setFilter(button.dataset.filter);
  });
  elements.pagination.addEventListener("click", (event) => {
    const button = event.target.closest("[data-page]");
    if (!button) return;
    const page = Number(button.dataset.page);
    if (!Number.isInteger(page) || page < 1 || page > state.pagination.total_pages) return;
    event.preventDefault();
    state.page = page;
    loadShots();
    document.getElementById("shot-log").scrollIntoView({ behavior: "smooth", block: "start" });
  });
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
  elements.distribution.addEventListener("click", (event) => {
    const button = event.target.closest("[data-bucket]");
    if (!button) return;
    setFilter(button.dataset.bucket);
    document.getElementById("shot-log").scrollIntoView({ behavior: "smooth", block: "start" });
  });
  elements.dialogClose.addEventListener("click", () => elements.dialog.close());
  elements.dialog.addEventListener("click", (event) => {
    if (event.target === elements.dialog) elements.dialog.close();
  });
  elements.chart.addEventListener("mousemove", showChartTooltip);
  elements.chart.addEventListener("mouseleave", () => { elements.chartTooltip.hidden = true; });

  if ("ResizeObserver" in window) {
    new ResizeObserver(() => requestAnimationFrame(drawChart)).observe(elements.chartShell);
  } else {
    window.addEventListener("resize", drawChart);
  }

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
    loadShots({ silent: true });
    loadAnalysis({ silent: true });
    connectSocket();
  });
  window.addEventListener("online", connectSocket);

}

export const CLIENT_SCRIPT = `(${clientApp.toString()})();`;
