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

const STORAGE_KEY = "s7gear-data-v1";

// ---------- Low-level read / write (the only code that touches localStorage) ----------

function readDatabase() {
  const saved = localStorage.getItem(STORAGE_KEY);
  if (saved) return JSON.parse(saved);

  // First run: start from a copy of the sample data
  return JSON.parse(JSON.stringify(SEED_DATA));
}

function writeDatabase(data) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
}

// Sorting helpers ("PT-002" comes before "PT-010")
const sortOldestFirst = (a, b) => a.id.localeCompare(b.id, undefined, { numeric: true });
const sortNewestFirst = (a, b) => b.id.localeCompare(a.id, undefined, { numeric: true });


// =========================================================
// TOOLS
// =========================================================

/** All tools, sorted by id. */
async function getTools() {
  return readDatabase().tools.sort(sortOldestFirst);
}

/** Add a new tool. Fails if the id already exists. */
async function addTool(tool) {
  const db = readDatabase();

  if (findById(db.tools, tool.id)) {
    throw new Error("Tool ID already exists.");
  }

  db.tools.push(tool);
  writeDatabase(db);
}

/** Change some fields of a tool.  updateTool("PT-001", { condition: "Fair" }) */
async function updateTool(id, changes) {
  const db = readDatabase();
  Object.assign(findById(db.tools, id), changes);
  writeDatabase(db);
}

/** Delete a tool. A borrowed tool cannot be deleted. */
async function deleteTool(id) {
  const db = readDatabase();

  if (findById(db.tools, id).status === "Borrowed") {
    throw new Error("Cannot delete a borrowed tool.");
  }

  db.tools = db.tools.filter((tool) => tool.id !== id);
  writeDatabase(db);
}


// =========================================================
// BORROWING & RETURN
// =========================================================

/** All borrow records, newest first. */
async function getBorrows() {
  return readDatabase().borrows.sort(sortNewestFirst);
}

/** Only the borrowings that have not been returned yet. */
async function getActiveBorrows() {
  const borrows = await getBorrows();
  return borrows.filter((borrow) => borrow.status === "Active");
}

/**
 * Borrow a tool.
 * `form` = { borrower, date, time, expected, purpose, remarks }
 * Creates the borrow record AND marks the tool as "Borrowed". Returns the tool.
 */
async function borrowTool(toolId, form) {
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
async function returnTool(borrowId, form) {
  const db = readDatabase();
  const borrow = findById(db.borrows, borrowId);
  const tool = findById(db.tools, borrow.toolId);

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
async function getInspections() {
  return readDatabase().inspections.sort(sortNewestFirst);
}

/**
 * Save a safety inspection.
 * `form` = { date, inspector, result, findings, remarks }
 * Creates the inspection record AND updates the tool's status, condition and
 * last inspection date. Returns the tool.
 */
async function saveInspection(toolId, form) {
  const db = readDatabase();
  const tool = findById(db.tools, toolId);

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
async function getMaintenanceRecords() {
  return readDatabase().maintenance.sort(sortNewestFirst);
}

/**
 * Add a maintenance record.
 * `record` = { toolId, date, type, issue, action, status, next }
 * If the work is "In Progress", the tool becomes "Under Maintenance".
 */
async function addMaintenanceRecord(record) {
  const db = readDatabase();

  db.maintenance.push({ id: nextId(db.maintenance, "MNT"), ...record });

  if (record.status === "In Progress") {
    const tool = findById(db.tools, record.toolId);
    if (tool.status !== "Borrowed") tool.status = "Under Maintenance";
  }

  writeDatabase(db);
}

/**
 * Mark a maintenance job as completed.
 * The repaired tool goes back for inspection before it can be used again.
 * Returns the maintenance record.
 */
async function completeMaintenance(id) {
  const db = readDatabase();
  const record = findById(db.maintenance, id);
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
async function getToolHistory(toolId) {
  const db = readDatabase();
  const forThisTool = (record) => record.toolId === toolId;

  return {
    borrows: db.borrows.filter(forThisTool).sort(sortNewestFirst),
    inspections: db.inspections.filter(forThisTool).sort(sortNewestFirst),
    maintenance: db.maintenance.filter(forThisTool).sort(sortNewestFirst),
  };
}
