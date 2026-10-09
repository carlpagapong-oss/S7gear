import { $, esc, today, nextId } from "../core/helpers.js";
import { db, save, ui, findTool } from "../core/store.js";
import { registerPage, render as rerender } from "../core/router.js";
import { CLICK, ACTION, FORMS } from "../core/events.js";
import { openModal, closeModal } from "../components/modal.js";
import { toast } from "../components/toast.js";
import { statusBadge, conditionBadge } from "../components/badge.js";

// One entry per tab: label, the list in `db`, and which filter options to show.
const TABS = {
  borrow:      { label: "Borrowing History",   list: () => db.borrows,       statuses: ["Active", "Returned"] },
  inspection:  { label: "Inspection History",  list: () => db.inspections,   statuses: ["Passed", "Needs Maintenance", "Failed / Unsafe"] },
  maintenance: { label: "Maintenance History", list: () => db.maintenance,   statuses: ["Completed", "In Progress"] },
};

// ---------- Page ----------
function render() {
  const tabButtons = Object.entries(TABS).map(([key, tab]) => `
    <button class="tab ${ui.historyTab === key ? "active" : ""}" data-htab="${key}">
      ${tab.label}<sup>${tab.list().length}</sup>
    </button>`).join("");

  const statusOptions = TABS[ui.historyTab].statuses.map((s) => `<option>${s}</option>`).join("");
  const addButton = ui.historyTab === "maintenance"
    ? `<button class="btn primary" data-action="addMaintenance">+ Add Maintenance</button>`
    : "";

  return `
    <h2 class="title">History</h2>
    <p class="subtitle">Complete borrowing, inspection, and maintenance records</p>
    <div class="tabs">${tabButtons}</div>

    <div class="card">
      <div class="toolbar">
        <input id="hSearch" placeholder="Search by Tool ID, type...">
        <select id="hStatus"><option value="">All Statuses</option>${statusOptions}</select>
        ${addButton}
      </div>
      <div class="table-wrap" id="hTable"></div>
    </div>`;
}

function after() {
  const refreshTable = () => {
    const search = $("#hSearch").value.toLowerCase();
    const status = $("#hStatus").value;

    // Borrow records use `status`, inspections use `result`.
    const statusOf = (record) => record.result ?? record.status;

    const records = TABS[ui.historyTab].list()
      .filter((record) => {
        const searchable = [record.id, record.toolId, findTool(record.toolId)?.type, record.borrower, record.inspector]
          .join(" ").toLowerCase();
        return (!status || statusOf(record) === status) && (!search || searchable.includes(search));
      })
      .sort((a, b) => b.id.localeCompare(a.id)); // newest first

    $("#hTable").innerHTML = HISTORY_TABLES[ui.historyTab](records);
  };

  $("#hSearch").addEventListener("input", refreshTable);
  $("#hStatus").addEventListener("input", refreshTable);
  refreshTable();
}

// ---------- Tables ----------
function table(headers, rows, count) {
  return `
    <table>
      <thead><tr>${headers.map((h) => `<th>${h}</th>`).join("")}</tr></thead>
      <tbody>${rows.join("")}</tbody>
    </table>
    <div class="foot">${count} records</div>`;
}

// The first three columns are the same on every tab.
const idCells = (record) => `
  <td class="mono">${record.id}</td>
  <td><b class="mono">${record.toolId}</b></td>
  <td>${esc(findTool(record.toolId)?.type)}</td>`;

const HISTORY_TABLES = {
  borrow: (records) => table(
    ["RECORD ID", "TOOL ID", "TOOL TYPE", "BORROWER", "BORROW DATE", "EXPECTED RETURN", "ACTUAL RETURN", "CONDITION RETURNED", "STATUS"],
    records.map((r) => `<tr>
      ${idCells(r)}
      <td>${esc(r.borrower)}</td>
      <td>${r.borrowDate}</td>
      <td>${r.expected}</td>
      <td>${r.actual || "—"}</td>
      <td>${r.condReturned ? conditionBadge(r.condReturned) : "—"}</td>
      <td>${statusBadge(r.status)}</td>
    </tr>`),
    records.length,
  ),

  inspection: (records) => table(
    ["RECORD ID", "TOOL ID", "TOOL TYPE", "DATE", "INSPECTOR", "RESULT", "CONDITION", "FINDINGS", "REMARKS"],
    records.map((r) => `<tr>
      ${idCells(r)}
      <td>${r.date}</td>
      <td>${esc(r.inspector)}</td>
      <td>${statusBadge(r.result)}</td>
      <td>${conditionBadge(r.condition)}</td>
      <td>${esc(r.findings)}</td>
      <td>${esc(r.remarks)}</td>
    </tr>`),
    records.length,
  ),

  maintenance: (records) => table(
    ["RECORD ID", "TOOL ID", "TOOL TYPE", "DATE", "TYPE", "ISSUE", "ACTION TAKEN", "STATUS", "NEXT SERVICE", ""],
    records.map((r) => `<tr>
      ${idCells(r)}
      <td>${r.date}</td>
      <td><b>${esc(r.type)}</b></td>
      <td>${esc(r.issue)}</td>
      <td>${esc(r.action)}</td>
      <td>${statusBadge(r.status)}</td>
      <td>${r.next || "—"}</td>
      <td>${r.status === "In Progress" ? `<button class="btn sm" data-complete="${r.id}">Mark Complete</button>` : ""}</td>
    </tr>`),
    records.length,
  ),
};

// ---------- Add maintenance modal ----------
function openMaintenanceForm() {
  const toolOptions = db.tools.map((t) => `<option value="${t.id}">${t.id} — ${esc(t.type)}</option>`).join("");

  openModal(`
    <h3>Add Maintenance Record</h3>
    <form id="maintenanceForm">
      <div class="fgrid">
        <div class="field"><label>TOOL *</label><select name="toolId">${toolOptions}</select></div>
        <div class="field"><label>DATE</label><input type="date" name="date" value="${today()}"></div>
      </div>
      <div class="field">
        <label>TYPE</label>
        <select name="type">
          <option>Repair</option><option>Preventive Maintenance</option><option>Cleaning</option><option>Part Replacement</option>
        </select>
      </div>
      <div class="field"><label>ISSUE *</label><input name="issue" required></div>
      <div class="field"><label>ACTION TAKEN *</label><textarea name="action" required></textarea></div>
      <div class="fgrid">
        <div class="field"><label>STATUS</label><select name="status"><option>In Progress</option><option>Completed</option></select></div>
        <div class="field"><label>NEXT SERVICE</label><input type="date" name="next"></div>
      </div>
      <div class="row" style="justify-content:flex-end">
        <button type="button" class="btn" data-close>Cancel</button>
        <button class="btn primary">Save</button>
      </div>
    </form>`);
}

// ---------- Handlers ----------
CLICK.htab = (el) => { ui.historyTab = el.dataset.htab; rerender(); };
ACTION.addMaintenance = openMaintenanceForm;

CLICK.complete = (el) => {
  const record = db.maintenance.find((m) => m.id === el.dataset.complete);
  record.status = "Completed";

  // A repaired tool goes back for inspection before it can be used again.
  const tool = findTool(record.toolId);
  if (tool?.status === "Under Maintenance") tool.status = "Under Inspection";

  save();
  rerender();
  toast(`${record.id} completed. ${record.toolId} sent for inspection.`);
};

FORMS.maintenanceForm = (form, data) => {
  db.maintenance.push({ id: nextId(db.maintenance, "MNT"), ...data });

  if (data.status === "In Progress") {
    const tool = findTool(data.toolId);
    if (tool.status !== "Borrowed") tool.status = "Under Maintenance";
  }

  save();
  closeModal();
  rerender();
  toast("Maintenance record added.");
};

registerPage("history", { render, after });
