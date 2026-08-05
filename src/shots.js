import {
  BANGKOK_UTC_OFFSET,
  DEFAULT_PAGE_SIZE,
  HISTORY_DAYS,
  MAX_PAGE_SIZE,
} from "./config.js";
import { clampInt } from "./format.js";

const DAY_MS = 24 * 60 * 60 * 1000;
const SHOT_COLUMNS = "id, created_at, shot_ms, brew_counter, avg_ms";

export function bangkokDate(ms = Date.now()) {
  const shifted = new Date(ms + 7 * 60 * 60 * 1000);
  return shifted.toISOString().slice(0, 10);
}

export function dateRangeForBangkokDay(dateText) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(dateText || ""))) return null;
  const start = Date.parse(`${dateText}T00:00:00${BANGKOK_UTC_OFFSET}`);
  if (!Number.isFinite(start)) return null;
  if (bangkokDate(start) !== dateText) return null;
  return { start, end: start + DAY_MS };
}

export function historyWindow(now = Date.now()) {
  const today = bangkokDate(now);
  const todayRange = dateRangeForBangkokDay(today);
  return {
    minDate: bangkokDate(todayRange.start - (HISTORY_DAYS - 1) * DAY_MS),
    maxDate: today,
    start: todayRange.start - (HISTORY_DAYS - 1) * DAY_MS,
    end: todayRange.end,
  };
}

export function isDateWithinHistory(dateText, now = Date.now()) {
  const range = dateRangeForBangkokDay(dateText);
  if (!range) return false;
  const window = historyWindow(now);
  return range.start >= window.start && range.start < window.end;
}

export async function listShots(env, limit) {
  const safeLimit = clampInt(limit, 1, 500, 500);
  const { results } = await env.DB.prepare(
    `SELECT ${SHOT_COLUMNS}
     FROM shots
     ORDER BY created_at DESC, brew_counter DESC, id DESC
     LIMIT ?`
  ).bind(safeLimit).all();
  return results || [];
}

export async function getShotsPage(env, options = {}) {
  const now = Number.isFinite(options.now) ? options.now : Date.now();
  const window = historyWindow(now);
  const pageSize = clampInt(options.pageSize, 1, MAX_PAGE_SIZE, DEFAULT_PAGE_SIZE);
  const bucket = normalizeBucket(options.bucket);
  const bucketCondition = bucketSql(bucket);
  let selectedDate = isDateWithinHistory(options.date, now) ? options.date : "";

  if (!selectedDate) {
    const latest = await env.DB.prepare(
      `SELECT date(created_at / 1000, 'unixepoch', '+7 hours') AS shot_date
       FROM shots
       WHERE created_at >= ? AND created_at < ?
       ORDER BY created_at DESC
       LIMIT 1`
    ).bind(window.start, window.end).first();
    selectedDate = latest && latest.shot_date ? latest.shot_date : window.maxDate;
  }

  const selectedRange = dateRangeForBangkokDay(selectedDate);
  const countResult = await env.DB.prepare(
    `SELECT COUNT(*) AS total
     FROM shots
     WHERE created_at >= ? AND created_at < ?${bucketCondition}`
  ).bind(selectedRange.start, selectedRange.end).first();
  const total = Number(countResult && countResult.total) || 0;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const page = clampInt(options.page, 1, totalPages, 1);
  const offset = (page - 1) * pageSize;

  const [rowsResult, datesResult] = await Promise.all([
    env.DB.prepare(
      `SELECT ${SHOT_COLUMNS}
       FROM shots
       WHERE created_at >= ? AND created_at < ?${bucketCondition}
       ORDER BY created_at DESC, brew_counter DESC, id DESC
       LIMIT ? OFFSET ?`
    ).bind(selectedRange.start, selectedRange.end, pageSize, offset).all(),
    env.DB.prepare(
      `SELECT date(created_at / 1000, 'unixepoch', '+7 hours') AS date,
              COUNT(*) AS count
       FROM shots
       WHERE created_at >= ? AND created_at < ?
       GROUP BY date
       ORDER BY date DESC`
    ).bind(window.start, window.end).all(),
  ]);

  return {
    data: rowsResult.results || [],
    selected_date: selectedDate,
    bucket,
    available_dates: datesResult.results || [],
    pagination: {
      page,
      page_size: pageSize,
      total,
      total_pages: totalPages,
    },
    window: { min_date: window.minDate, max_date: window.maxDate },
  };
}

function normalizeBucket(value) {
  return ["under20", "20to25", "25to28", "28to30", "over30"].includes(value)
    ? value
    : "all";
}

function bucketSql(bucket) {
  switch (bucket) {
    case "under20": return " AND shot_ms < 20000";
    case "20to25": return " AND shot_ms >= 20000 AND shot_ms < 25000";
    case "25to28": return " AND shot_ms >= 25000 AND shot_ms < 28000";
    case "28to30": return " AND shot_ms >= 28000 AND shot_ms <= 30000";
    case "over30": return " AND shot_ms > 30000";
    default: return "";
  }
}

export async function getShotAnalysis(env, now = Date.now()) {
  const window = historyWindow(now);
  const [summary, dailyResult] = await Promise.all([
    env.DB.prepare(
      `SELECT COUNT(*) AS total,
              AVG(shot_ms) AS average_ms,
              COUNT(CASE WHEN shot_ms < 20000 THEN 1 END) AS under20,
              COUNT(CASE WHEN shot_ms >= 20000 AND shot_ms < 25000 THEN 1 END) AS "20to25",
              COUNT(CASE WHEN shot_ms >= 25000 AND shot_ms < 28000 THEN 1 END) AS "25to28",
              COUNT(CASE WHEN shot_ms >= 28000 AND shot_ms <= 30000 THEN 1 END) AS "28to30",
              COUNT(CASE WHEN shot_ms > 30000 THEN 1 END) AS over30
       FROM shots
       WHERE created_at >= ? AND created_at < ?`
    ).bind(window.start, window.end).first(),
    env.DB.prepare(
      `SELECT date(created_at / 1000, 'unixepoch', '+7 hours') AS date,
              COUNT(*) AS count,
              AVG(shot_ms) AS average_ms
       FROM shots
       WHERE created_at >= ? AND created_at < ?
       GROUP BY date
       ORDER BY date ASC`
    ).bind(window.start, window.end).all(),
  ]);

  return {
    total: Number(summary && summary.total) || 0,
    average_ms: Number(summary && summary.average_ms) || 0,
    buckets: {
      under20: Number(summary && summary.under20) || 0,
      "20to25": Number(summary && summary["20to25"]) || 0,
      "25to28": Number(summary && summary["25to28"]) || 0,
      "28to30": Number(summary && summary["28to30"]) || 0,
      over30: Number(summary && summary.over30) || 0,
    },
    daily: (dailyResult.results || []).map((row) => ({
      date: row.date,
      count: Number(row.count) || 0,
      average_ms: Number(row.average_ms) || 0,
    })),
    window: { min_date: window.minDate, max_date: window.maxDate },
  };
}
