import {
  BANGKOK_UTC_OFFSET,
  HISTORY_DAYS,
} from "./config.js";
import { clampInt } from "./format.js";

const DAY_MS = 24 * 60 * 60 * 1000;
const SHOT_COLUMNS = "id, created_at, shot_ms, brew_counter, avg_ms";
export const SHOT_LOG_PAGE_SIZE = 5;

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
  const defaultStart = allHistory ? bounds.minDate : bounds.maxDate;
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
  const bounds = options.bounds || await getShotBounds(env, now);
  const bucket = normalizeBucket(options.bucket);
  const bucketCondition = bucketSql(bucket);
  const requestedPage = clampInt(options.page, 1, 10_000, 1);
  const selectedDate = isDateWithinBounds(options.date, bounds)
    ? options.date
    : bounds.maxDate;
  const selectedRange = dateRangeForBangkokDay(selectedDate);

  const daySummary = await getDailyStatsForDate(env, selectedDate, selectedRange);
  const total = bucketCount(daySummary, bucket);
  const pageCount = Math.max(1, Math.ceil(total / SHOT_LOG_PAGE_SIZE));
  const page = Math.min(requestedPage, pageCount);
  const offset = (page - 1) * SHOT_LOG_PAGE_SIZE;
  const rowsResult = await env.DB.prepare(
    `SELECT ${SHOT_COLUMNS}
     FROM shots
     WHERE created_at >= ? AND created_at < ?${bucketCondition}
     ORDER BY created_at DESC, brew_counter DESC, id DESC
     LIMIT ? OFFSET ?`
  ).bind(selectedRange.start, selectedRange.end, SHOT_LOG_PAGE_SIZE, offset).all();

  const rows = rowsResult.results || [];
  const dayTotal = numericCount(daySummary && daySummary.total);
  const consistent = numericCount(daySummary && daySummary.consistent);
  return {
    data: rows,
    total,
    selected_date: selectedDate,
    bucket,
    pagination: {
      page,
      page_size: SHOT_LOG_PAGE_SIZE,
      page_count: pageCount,
    },
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

function bucketCount(summary, bucket) {
  const key = {
    under20: "under20",
    "20to25": "bucket_20_25",
    "25to28": "bucket_25_28",
    "28to30": "bucket_28_30",
    over30: "over30",
  }[bucket];
  return numericCount(summary && summary[key || "total"]);
}

async function getDailyStatsForDate(env, selectedDate, selectedRange) {
  try {
    const result = await env.DB.prepare(
      `SELECT total,
              sum_ms,
              under20,
              bucket_20_25,
              bucket_25_28,
              bucket_28_30,
              over30,
              consistent
       FROM shot_daily_stats
       WHERE shot_date = ?`
    ).bind(selectedDate).first();
    return result || emptyDailyStats();
  } catch (error) {
    if (!isMissingDailyStatsError(error)) throw error;
    return getRawDailyStats(env, selectedRange);
  }
}

async function getRawDailyStats(env, range) {
  return await env.DB.prepare(
    `SELECT COUNT(*) AS total,
            COALESCE(SUM(shot_ms), 0) AS sum_ms,
            COUNT(CASE WHEN shot_ms < 20000 THEN 1 END) AS under20,
            COUNT(CASE WHEN shot_ms >= 20000 AND shot_ms < 25000 THEN 1 END) AS bucket_20_25,
            COUNT(CASE WHEN shot_ms >= 25000 AND shot_ms < 28000 THEN 1 END) AS bucket_25_28,
            COUNT(CASE WHEN shot_ms >= 28000 AND shot_ms <= 30000 THEN 1 END) AS bucket_28_30,
            COUNT(CASE WHEN shot_ms > 30000 THEN 1 END) AS over30,
            COUNT(CASE WHEN shot_ms >= 24000 AND shot_ms <= 27000 THEN 1 END) AS consistent
     FROM shots
     WHERE created_at >= ? AND created_at < ?`
  ).bind(range.start, range.end).first() || emptyDailyStats();
}

function emptyDailyStats() {
  return {
    total: 0,
    sum_ms: 0,
    under20: 0,
    bucket_20_25: 0,
    bucket_25_28: 0,
    bucket_28_30: 0,
    over30: 0,
    consistent: 0,
  };
}

export async function getShotAnalysis(env, options = {}) {
  if (typeof options === "number") options = { now: options };
  const now = Number.isFinite(options.now) ? options.now : Date.now();
  const dataBounds = options.bounds || await getShotBounds(env, now);
  const bounds = { ...dataBounds, maxDate: bangkokDate(now) };
  const range = resolveAnalysisRange(options, bounds);
  const recent = historyWindow(now);
  const aggregatesPromise = getAnalysisAggregates(env, range, recent);
  const pointsPromise = options.includePoints
    ? env.DB.prepare(
      `SELECT id, created_at, shot_ms
       FROM shots
       WHERE created_at >= ? AND created_at < ?
       ORDER BY created_at ASC, id ASC`
    ).bind(range.start, range.end).all()
    : Promise.resolve(null);
  const [aggregates, pointsResult] = await Promise.all([aggregatesPromise, pointsPromise]);

  const summary = aggregates.summary;
  const total = numericCount(summary.total);
  const sumMs = numericSum(summary.sum_ms);
  const consistent = numericCount(summary.consistent);
  const recentTotal = numericCount(aggregates.recent.total);
  const recentConsistent = numericCount(aggregates.recent.consistent);

  const result = {
    total,
    sum_ms: sumMs,
    average_ms: total > 0 ? sumMs / total : 0,
    consistent,
    consistency_percent: consistencyPercent(consistent, total),
    consistency_30d_percent: consistencyPercent(recentConsistent, recentTotal),
    recent_30d: {
      total: recentTotal,
      consistent: recentConsistent,
    },
    buckets: {
      under20: numericCount(summary.under20),
      "20to25": numericCount(summary.bucket_20_25),
      "25to28": numericCount(summary.bucket_25_28),
      "28to30": numericCount(summary.bucket_28_30),
      over30: numericCount(summary.over30),
    },
    daily: aggregates.daily.map((row) => {
      const dayTotal = numericCount(row.count);
      const daySumMs = numericSum(row.sum_ms);
      const dayConsistent = numericCount(row.consistent);
      return {
        date: row.date,
        count: dayTotal,
        sum_ms: daySumMs,
        consistent: dayConsistent,
        average_ms: dayTotal > 0 ? daySumMs / dayTotal : 0,
        consistency_percent: consistencyPercent(dayConsistent, dayTotal),
      };
    }),
    range: { start_date: range.startDate, end_date: range.endDate },
    window: { min_date: bounds.minDate, max_date: bounds.maxDate },
  };
  if (options.includePoints) {
    result.shot_points = (pointsResult.results || []).map((row) => ({
      id: String(row.id || ""),
      created_at: Number(row.created_at) || 0,
      shot_ms: Number(row.shot_ms) || 0,
    }));
  }
  return result;
}

async function getAnalysisAggregates(env, range, recent) {
  try {
    return await getDailyAnalysisAggregates(env, range, recent);
  } catch (error) {
    if (!isMissingDailyStatsError(error)) throw error;
    return getRawAnalysisAggregates(env, range, recent);
  }
}

async function getDailyAnalysisAggregates(env, range, recent) {
  const [dailyResult, recentSummary] = await Promise.all([
    env.DB.prepare(
      `SELECT shot_date AS date,
              total AS count,
              sum_ms,
              under20,
              bucket_20_25,
              bucket_25_28,
              bucket_28_30,
              over30,
              consistent
       FROM shot_daily_stats
       WHERE shot_date >= ? AND shot_date <= ?
       ORDER BY shot_date ASC`
    ).bind(range.startDate, range.endDate).all(),
    env.DB.prepare(
      `SELECT COALESCE(SUM(total), 0) AS total,
              COALESCE(SUM(consistent), 0) AS consistent
       FROM shot_daily_stats
       WHERE shot_date >= ? AND shot_date <= ?`
    ).bind(recent.minDate, recent.maxDate).first(),
  ]);
  const daily = dailyResult.results || [];
  return {
    summary: sumDailyRows(daily),
    daily,
    recent: recentSummary || { total: 0, consistent: 0 },
  };
}

async function getRawAnalysisAggregates(env, range, recent) {
  const [summary, dailyResult, recentSummary] = await Promise.all([
    env.DB.prepare(
      `SELECT COUNT(*) AS total,
              COALESCE(SUM(shot_ms), 0) AS sum_ms,
              COUNT(CASE WHEN shot_ms < 20000 THEN 1 END) AS under20,
              COUNT(CASE WHEN shot_ms >= 20000 AND shot_ms < 25000 THEN 1 END) AS bucket_20_25,
              COUNT(CASE WHEN shot_ms >= 25000 AND shot_ms < 28000 THEN 1 END) AS bucket_25_28,
              COUNT(CASE WHEN shot_ms >= 28000 AND shot_ms <= 30000 THEN 1 END) AS bucket_28_30,
              COUNT(CASE WHEN shot_ms > 30000 THEN 1 END) AS over30,
              COUNT(CASE WHEN shot_ms >= 24000 AND shot_ms <= 27000 THEN 1 END) AS consistent
       FROM shots
       WHERE created_at >= ? AND created_at < ?`
    ).bind(range.start, range.end).first(),
    env.DB.prepare(
      `SELECT date(created_at / 1000, 'unixepoch', '+7 hours') AS date,
              COUNT(*) AS count,
              COALESCE(SUM(shot_ms), 0) AS sum_ms,
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
  ]);
  return {
    summary: summary || emptyDailyStats(),
    daily: dailyResult.results || [],
    recent: recentSummary || { total: 0, consistent: 0 },
  };
}

function sumDailyRows(rows) {
  return rows.reduce((summary, row) => {
    summary.total += numericCount(row.count);
    summary.sum_ms += numericSum(row.sum_ms);
    summary.under20 += numericCount(row.under20);
    summary.bucket_20_25 += numericCount(row.bucket_20_25);
    summary.bucket_25_28 += numericCount(row.bucket_25_28);
    summary.bucket_28_30 += numericCount(row.bucket_28_30);
    summary.over30 += numericCount(row.over30);
    summary.consistent += numericCount(row.consistent);
    return summary;
  }, emptyDailyStats());
}

export async function getShotBounds(env, now = Date.now()) {
  const [firstResult, lastResult] = await Promise.all([
    env.DB.prepare(
      `SELECT created_at
       FROM shots
       ORDER BY created_at ASC
       LIMIT 1`
    ).first(),
    env.DB.prepare(
      `SELECT created_at
       FROM shots
       ORDER BY created_at DESC
       LIMIT 1`
    ).first(),
  ]);
  const minCreatedAt = numericTimestamp(firstResult && firstResult.created_at);
  const maxCreatedAt = numericTimestamp(lastResult && lastResult.created_at);
  const fallback = bangkokDate(now);
  return {
    minDate: minCreatedAt === null ? fallback : bangkokDate(minCreatedAt),
    maxDate: maxCreatedAt === null ? fallback : bangkokDate(maxCreatedAt),
  };
}

function numericCount(value) {
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? Math.trunc(number) : 0;
}

function numericSum(value) {
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? number : 0;
}

function isMissingDailyStatsError(error) {
  const message = String(error && error.message ? error.message : error || "").toLowerCase();
  return message.includes("shot_daily_stats") && message.includes("no such table");
}

function numericTimestamp(value) {
  if (value === null || value === undefined || value === "") return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}
