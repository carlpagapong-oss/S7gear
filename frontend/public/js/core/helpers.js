export const $ = (selector) => document.querySelector(selector);

const HTML_ESCAPES = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" };

/** Escape user text before putting it inside an HTML string. */
export const esc = (value) =>
  String(value ?? "").replace(/[&<>"']/g, (char) => HTML_ESCAPES[char]);

export const pad = (n, size = 2) => String(n).padStart(size, "0");

/** Today as YYYY-MM-DD (local time). */
export function today() {
  const d = new Date();
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** Current time as HH:MM (local time). */
export function nowTime() {
  const d = new Date();
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/** Whole days from today until `date` (negative = overdue). */
export function daysLeft(date) {
  const MS_PER_DAY = 86_400_000;
  return Math.ceil((new Date(date) - new Date(today())) / MS_PER_DAY);
}

/** Next record id for a list, e.g. nextId(db.tools, "PT") -> "PT-011". */
export function nextId(list, prefix) {
  const highest = Math.max(0, ...list.map((item) => Number(item.id.split("-")[1])));
  return `${prefix}-${pad(highest + 1, 3)}`;
}
