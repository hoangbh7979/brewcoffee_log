export function num(v) {
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

export function clampInt(v, min, max, fallback) {
  const n = parseInt(v, 10);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, n));
}

export function formatShot(ms) {
  if (!Number.isFinite(ms)) return "--.--s";
  const cs = Math.floor(ms / 10);
  return (cs / 100).toFixed(2) + "s";
}

export function pad2(n) {
  return n < 10 ? "0" + n : "" + n;
}

export function formatTime(d) {
  const hh = pad2(d.getHours());
  const mm = pad2(d.getMinutes());
  const dd = pad2(d.getDate());
  const mo = pad2(d.getMonth() + 1);
  const yy = ("" + d.getFullYear()).slice(-2);
  return `${hh}h${mm} ${dd}/${mo}/${yy}`;
}

export function formatClock(d) {
  const hh = pad2(d.getHours());
  const mm = pad2(d.getMinutes());
  return `${hh}:${mm}`;
}

export function formatDate(d) {
  const dd = pad2(d.getDate());
  const mo = pad2(d.getMonth() + 1);
  const yy = ("" + d.getFullYear()).slice(-2);
  return `${dd}/${mo}/${yy}`;
}
