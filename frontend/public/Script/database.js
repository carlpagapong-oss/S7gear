// =========================================================
// DATABASE — the ONLY file that reads or saves data
// =========================================================
//
// Every page gets its data by calling the functions below.
// Right now the data is kept in the browser (localStorage).
//
// WHEN YOU ADD A REAL DATABASE:
//   Rewrite the INSIDE of each function so it talks to your server
//   (for example with fetch("/api/tools")). Keep the function names and what
//   they return the same, and none of the pages need to change.
//
// All functions are "async" (they return a promise) because talking to a real
// database takes time. In the pages we call them with "await".
//
// When something is not allowed, a function throws an Error with a
// friendly message. The pages show that message in a toast.
// =========================================================

import { STATUS_AFTER_RETURN, STATUS_AFTER_INSPECTION } from "./config.js";
import { SEED_DATA } from "./seed-data.js";
import { findById, nextId } from "./helpers.js";

const STORAGE_KEY = "s7gear-data-v1";

// ---------- Low-level read / write (the only code that touches localStorage) ----------

export function readDatabase() {
  const saved = localStorage.getItem(STORAGE_KEY);
  if (saved) return JSON.parse(saved);

  // First run: start from a copy of the sample data
  return JSON.parse(JSON.stringify(SEED_DATA));
}

export function writeDatabase(data) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
}

// Find a record or throw a friendly error (instead of crashing on undefined).
function mustFind(list, id, label) {
  const record = findById(list, id);
  if (!record) throw new Error(`${label} ${id} not found.`);
  return record;
}

// Sorting helpers ("PT-002" comes before "PT-010")
const sortOldestFirst = (a, b) => a.id.localeCompare(b.id, undefined, { numeric: true });
const sortNewestFirst = (a, b) => b.id.localeCompare(a.id, undefined, { numeric: true });


// =========================================================
// TOOLS
// =========================================================

/** All tools, sorted by id. */
export async function getTools() {
  return readDatabase().tools.sort(sortOldestFirst);
}

/** Add a new tool. Fails if the id already exists. */
export async function addTool(tool) {
  const db = readDatabase();

  if (!/^PT-\d{3,}$/.test(tool.id)) {
    throw new Error("Tool ID must look like PT-001.");
  }
  if (findById(db.tools, tool.id)) {
    throw new Error("Tool ID already exists.");
  }

  db.tools.push(tool);
  writeDatabase(db);
}

/** Change some fields of a tool.  updateTool("PT-001", { condition: "Fair" }) */
export async function updateTool(id, changes) {
  const db = readDatabase();
  Object.assign(mustFind(db.tools, id, "Tool"), changes);
  writeDatabase(db);
}

/** Delete a tool. A borrowed tool cannot be deleted. */
export async function deleteTool(id) {
  const db = readDatabase();

  if (mustFind(db.tools, id, "Tool").status === "Borrowed") {
    throw new Error("Cannot delete a borrowed tool.");
  }

  db.tools = db.tools.filter((tool) => tool.id !== id);
  writeDatabase(db);
}


// =========================================================
// BORROWING & RETURN
// =========================================================

/** All borrow records, newest first. */
export async function getBorrows() {
  return readDatabase().borrows.sort(sortNewestFirst);
}

/** Only the borrowings that have not been returned yet. */
export async function getActiveBorrows() {
  const borrows = await getBorrows();
  return borrows.filter((borrow) => borrow.status === "Active");
}

/**
 * Borrow a tool.
 * `form` = { borrower, date, time, expected, purpose, remarks }
 * Creates the borrow record AND marks the tool as "Borrowed". Returns the tool.
 */
export async function borrowTool(toolId, form) {
  const db = readDatabase();
  const tool = findById(db.tools, toolId);

  if (!tool || tool.status !== "Available") {
    throw new Error("Select an available tool first.");
  }
  if (form.expected < form.date) {
    throw new Error("Return date must be after borrow date.");
  }

  db.borrows.push({
    id: nextId(db.borrows, "BR"),
    toolId: tool.id,
    borrower: form.borrower.trim(),
    borrowDate: `${form.date} ${form.time}`,
    expected: form.expected,
    actual: "",
    condReturned: "",
    status: "Active",
    purpose: form.purpose,
    remarks: form.remarks,
  });
  tool.status = "Borrowed";

  writeDatabase(db);
  return tool;
}

/**
 * Return a borrowed tool.
 * `form` = { date, condition, remarks }
 * Closes the borrow record AND updates the tool's condition + status
 * (see STATUS_AFTER_RETURN in config.js). Returns the tool.
 */
export async function returnTool(borrowId, form) {
  const db = readDatabase();
  const borrow = mustFind(db.borrows, borrowId, "Borrowing");
  const tool = mustFind(db.tools, borrow.toolId, "Tool");

  if (borrow.status !== "Active") {
    throw new Error("This tool was already returned.");
  }
  if (form.date < borrow.borrowDate.slice(0, 10)) {
    throw new Error("Return date cannot be before the borrow date.");
  }

  borrow.actual = form.date;
  borrow.condReturned = form.condition;
  borrow.status = "Returned";
  borrow.remarks = [borrow.remarks, form.remarks].filter(Boolean).join(" | ");

  tool.condition = form.condition;
  tool.status = STATUS_AFTER_RETURN[form.condition];

  writeDatabase(db);
  return tool;
}


// =========================================================
// INSPECTIONS
// =========================================================

/** All inspections, newest first. */
export async function getInspections() {
  return readDatabase().inspections.sort(sortNewestFirst);
}

/**
 * Save a safety inspection.
 * `form` = { date, inspector, result, findings, remarks }
 * Creates the inspection record AND updates the tool's status, condition and
 * last inspection date. Returns the tool.
 */
export async function saveInspection(toolId, form) {
  const db = readDatabase();
  const tool = mustFind(db.tools, toolId, "Tool");

  if (tool.status === "Borrowed") {
    throw new Error("Tool is currently borrowed.");
  }

  // Work out the tool's new condition from the result.
  let condition = tool.condition;
  const wasBad = tool.condition === "Damaged" || tool.condition === "Unsafe";
  if (form.result === "Passed" && wasBad) condition = "Good";
  if (form.result === "Needs Maintenance")  condition = "Damaged";
  if (form.result === "Failed / Unsafe")    condition = "Unsafe";

  db.inspections.push({
    id: nextId(db.inspections, "INS"),
    toolId: tool.id,
    date: form.date,
    inspector: form.inspector.trim(),
    result: form.result,
    condition: condition,
    findings: form.findings,
    remarks: form.remarks,
  });

  tool.status = STATUS_AFTER_INSPECTION[form.result];
  tool.condition = condition;
  tool.lastInspection = form.date;

  writeDatabase(db);
  return tool;
}


// =========================================================
// MAINTENANCE
// =========================================================

/** All maintenance records, newest first. */
export async function getMaintenanceRecords() {
  return readDatabase().maintenance.sort(sortNewestFirst);
}

/**
 * Add a maintenance record.
 * `record` = { toolId, date, type, issue, action, status, next }
 * If the work is "In Progress", the tool becomes "Under Maintenance".
 */
export async function addMaintenanceRecord(record) {
  const db = readDatabase();
  const tool = mustFind(db.tools, record.toolId, "Tool");

  db.maintenance.push({ id: nextId(db.maintenance, "MNT"), ...record });

  if (record.status === "In Progress") {
    if (tool.status !== "Borrowed") tool.status = "Under Maintenance";
  }

  writeDatabase(db);
}

/**
 * Mark a maintenance job as completed.
 * The repaired tool goes back for inspection before it can be used again.
 * Returns the maintenance record.
 */
export async function completeMaintenance(id) {
  const db = readDatabase();
  const record = mustFind(db.maintenance, id, "Maintenance record");
  const tool = findById(db.tools, record.toolId);

  record.status = "Completed";
  if (tool && tool.status === "Under Maintenance") tool.status = "Under Inspection";

  writeDatabase(db);
  return record;
}


// =========================================================
// ONE TOOL'S FULL HISTORY
// =========================================================

/** Everything that happened to one tool: { borrows, inspections, maintenance } */
export async function getToolHistory(toolId) {
  const db = readDatabase();
  const forThisTool = (record) => record.toolId === toolId;

  return {
    borrows: db.borrows.filter(forThisTool).sort(sortNewestFirst),
    inspections: db.inspections.filter(forThisTool).sort(sortNewestFirst),
    maintenance: db.maintenance.filter(forThisTool).sort(sortNewestFirst),
  };
}
