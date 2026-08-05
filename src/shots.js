import {
  BANGKOK_UTC_OFFSET,
  HISTORY_DAYS,
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

export function isDateWithinBounds(dateText, bounds) {
  return Boolean(
    dateRangeForBangkokDay(dateText)
    && bounds
    && dateText >= bounds.minDate
    && dateText <= bounds.maxDate
  );
}

export function consistencyPercent(consistent, total) {
  const safeTotal = Number(total) || 0;
  const safeConsistent = Number(consistent) || 0;
  return safeTotal > 0 ? Math.round(safeConsistent * 100 / safeTotal) : 0;
}

export function resolveAnalysisRange(options, bounds) {
  const allHistory = Boolean(options && options.allHistory);
  const defaultStart = allHistory
    ? bounds.minDate
    : maxDate(bounds.minDate, shiftDateByMonths(bounds.maxDate, -3));
  let startDate = isDateWithinBounds(options && options.start, bounds)
    ? options.start
    : defaultStart;
  let endDate = isDateWithinBounds(options && options.end, bounds)
    ? options.end
    : bounds.maxDate;

  if (startDate > endDate) {
    [startDate, endDate] = [endDate, startDate];
  }

  const startRange = dateRangeForBangkokDay(startDate);
  const endRange = dateRangeForBangkokDay(endDate);
  return {
    startDate,
    endDate,
    start: startRange.start,
    end: endRange.end,
  };
}

function shiftDateByMonths(dateText, months) {
  const [year, month, day] = String(dateText || "").split("-").map(Number);
  if (!Number.isInteger(year) || !Number.isInteger(month) || !Number.isInteger(day)) return dateText;
  const pivot = new Date(Date.UTC(year, month - 1 + months, 1));
  const targetYear = pivot.getUTCFullYear();
  const targetMonth = pivot.getUTCMonth() + 1;
  const lastDay = new Date(Date.UTC(targetYear, targetMonth, 0)).getUTCDate();
  return `${targetYear}-${String(targetMonth).padStart(2, "0")}-${String(Math.min(day, lastDay)).padStart(2, "0")}`;
}

function maxDate(left, right) {
  return left > right ? left : right;
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

export async function getShotsForDate(env, options = {}) {
  const now = Number.isFinite(options.now) ? options.now : Date.now();
  const bounds = await getShotBounds(env, now);
  const bucket = normalizeBucket(options.bucket);
  const bucketCondition = bucketSql(bucket);
  const selectedDate = isDateWithinBounds(options.date, bounds)
    ? options.date
    : bounds.maxDate;
  const selectedRange = dateRangeForBangkokDay(selectedDate);

  const [daySummary, rowsResult] = await Promise.all([
    env.DB.prepare(
      `SELECT COUNT(*) AS total,
              COUNT(CASE WHEN shot_ms >= 24000 AND shot_ms <= 27000 THEN 1 END) AS consistent
       FROM shots
       WHERE created_at >= ? AND created_at < ?`
    ).bind(selectedRange.start, selectedRange.end).first(),
    env.DB.prepare(
      `SELECT ${SHOT_COLUMNS}
       FROM shots
       WHERE created_at >= ? AND created_at < ?${bucketCondition}
       ORDER BY created_at DESC, brew_counter DESC, id DESC`
    ).bind(selectedRange.start, selectedRange.end).all(),
  ]);

  const rows = rowsResult.results || [];
  const dayTotal = Number(daySummary && daySummary.total) || 0;
  const consistent = Number(daySummary && daySummary.consistent) || 0;
  return {
    data: rows,
    total: rows.length,
    selected_date: selectedDate,
    bucket,
    day_summary: {
      total: dayTotal,
      consistent,
      consistency_percent: consistencyPercent(consistent, dayTotal),
    },
    window: { min_date: bounds.minDate, max_date: bounds.maxDate },
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

export async function getShotAnalysis(env, options = {}) {
  if (typeof options === "number") options = { now: options };
  const now = Number.isFinite(options.now) ? options.now : Date.now();
  const bounds = await getShotBounds(env, now);
  const range = resolveAnalysisRange(options, bounds);
  const recent = historyWindow(now);

  const queries = [
    env.DB.prepare(
      `SELECT COUNT(*) AS total,
              AVG(shot_ms) AS average_ms,
              COUNT(CASE WHEN shot_ms < 20000 THEN 1 END) AS under20,
              COUNT(CASE WHEN shot_ms >= 20000 AND shot_ms < 25000 THEN 1 END) AS "20to25",
              COUNT(CASE WHEN shot_ms >= 25000 AND shot_ms < 28000 THEN 1 END) AS "25to28",
              COUNT(CASE WHEN shot_ms >= 28000 AND shot_ms <= 30000 THEN 1 END) AS "28to30",
              COUNT(CASE WHEN shot_ms > 30000 THEN 1 END) AS over30,
              COUNT(CASE WHEN shot_ms >= 24000 AND shot_ms <= 27000 THEN 1 END) AS consistent
       FROM shots
       WHERE created_at >= ? AND created_at < ?`
    ).bind(range.start, range.end).first(),
    env.DB.prepare(
      `SELECT date(created_at / 1000, 'unixepoch', '+7 hours') AS date,
              COUNT(*) AS count,
              AVG(shot_ms) AS average_ms,
              COUNT(CASE WHEN shot_ms >= 24000 AND shot_ms <= 27000 THEN 1 END) AS consistent
       FROM shots
       WHERE created_at >= ? AND created_at < ?
       GROUP BY date
       ORDER BY date ASC`
    ).bind(range.start, range.end).all(),
    env.DB.prepare(
      `SELECT COUNT(*) AS total,
              COUNT(CASE WHEN shot_ms >= 24000 AND shot_ms <= 27000 THEN 1 END) AS consistent
       FROM shots
      WHERE created_at >= ? AND created_at < ?`
    ).bind(recent.start, recent.end).first(),
  ];
  if (options.includePoints) {
    queries.push(
      env.DB.prepare(
        `SELECT created_at, shot_ms
         FROM shots
         WHERE created_at >= ? AND created_at < ?
         ORDER BY created_at ASC, id ASC`
      ).bind(range.start, range.end).all()
    );
  }
  const [summary, dailyResult, recentSummary, pointsResult] = await Promise.all(queries);

  const total = Number(summary && summary.total) || 0;
  const consistent = Number(summary && summary.consistent) || 0;
  const recentTotal = Number(recentSummary && recentSummary.total) || 0;
  const recentConsistent = Number(recentSummary && recentSummary.consistent) || 0;

  const result = {
    total,
    average_ms: Number(summary && summary.average_ms) || 0,
    consistent,
    consistency_percent: consistencyPercent(consistent, total),
    consistency_30d_percent: consistencyPercent(recentConsistent, recentTotal),
    buckets: {
      under20: Number(summary && summary.under20) || 0,
      "20to25": Number(summary && summary["20to25"]) || 0,
      "25to28": Number(summary && summary["25to28"]) || 0,
      "28to30": Number(summary && summary["28to30"]) || 0,
      over30: Number(summary && summary.over30) || 0,
    },
    daily: (dailyResult.results || []).map((row) => {
      const dayTotal = Number(row.count) || 0;
      const dayConsistent = Number(row.consistent) || 0;
      return {
        date: row.date,
        count: dayTotal,
        average_ms: Number(row.average_ms) || 0,
        consistency_percent: consistencyPercent(dayConsistent, dayTotal),
      };
    }),
    range: { start_date: range.startDate, end_date: range.endDate },
    window: { min_date: bounds.minDate, max_date: bounds.maxDate },
  };
  if (options.includePoints) {
    result.shot_points = (pointsResult.results || []).map((row) => ({
      created_at: Number(row.created_at) || 0,
      shot_ms: Number(row.shot_ms) || 0,
    }));
  }
  return result;
}

async function getShotBounds(env, now) {
  const result = await env.DB.prepare(
    `SELECT MIN(created_at) AS min_created_at,
            MAX(created_at) AS max_created_at
     FROM shots`
  ).first();
  const minCreatedAt = numericTimestamp(result && result.min_created_at);
  const maxCreatedAt = numericTimestamp(result && result.max_created_at);
  const fallback = bangkokDate(now);
  return {
    minDate: minCreatedAt === null ? fallback : bangkokDate(minCreatedAt),
    maxDate: maxCreatedAt === null ? fallback : bangkokDate(maxCreatedAt),
  };
}

function numericTimestamp(value) {
  if (value === null || value === undefined || value === "") return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}
