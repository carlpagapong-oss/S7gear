// =========================================================
// HELPERS — small functions used by many pages
// =========================================================

/** Shortcut for document.querySelector.  $("#toolsBody") */
function $(selector) {
  return document.querySelector(selector);
}

/**
 * Make text safe to put inside HTML.
 * ALWAYS use this on text a person typed (names, remarks, findings...).
 */
function escapeHtml(value) {
  const replacements = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" };
  return String(value ?? "").replace(/[&<>"']/g, (char) => replacements[char]);
}

/** 5 -> "05", and with size 3: 5 -> "005" */
function pad(number, size = 2) {
  return String(number).padStart(size, "0");
}

// ---------- Dates ----------

/** Today as YYYY-MM-DD (the format date inputs use). */
function today() {
  const d = new Date();
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** Current time as HH:MM (the format time inputs use). */
function nowTime() {
  const d = new Date();
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/** Whole days from today until `date`. A negative number means overdue. */
function daysLeft(date) {
  const MS_PER_DAY = 86400000;
  return Math.ceil((new Date(date) - new Date(today())) / MS_PER_DAY);
}

// ---------- Working with lists of records ----------

/** Find one record by its id, e.g. findById(tools, "PT-001"). Returns undefined if missing. */
function findById(list, id) {
  return list.find((item) => item.id === id);
}

/** Find the active (not yet returned) borrowing of a tool, or undefined. */
function findActiveBorrow(activeBorrows, toolId) {
  return activeBorrows.find((borrow) => borrow.toolId === toolId);
}

/** How many tools have this status?  countByStatus(tools, "Available") */
function countByStatus(tools, status) {
  return tools.filter((tool) => tool.status === status).length;
}

/** Remove duplicates: ["a", "b", "a"] -> ["a", "b"] */
function uniqueValues(values) {
  return [...new Set(values)];
}

/** Next id for a list, e.g. nextId(tools, "PT") -> "PT-011". */
function nextId(list, prefix) {
  const numbers = list.map((item) => Number(item.id.split("-")[1]));
  const highest = Math.max(0, ...numbers);
  return `${prefix}-${pad(highest + 1, 3)}`;
}

/** Turn ["A", "B"] into <option>A</option><option>B</option> */
function optionsHtml(values) {
  return values.map((value) => `<option>${escapeHtml(value)}</option>`).join("");
}
