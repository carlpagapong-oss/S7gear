// =========================================================
// HISTORY PAGE (history.html)
// Three tabs: Borrowing, Inspection, Maintenance
// =========================================================

import {
  completeMaintenance,
  getBorrows,
  getInspections,
  getMaintenanceRecords,
  getTools,
  markMaintenanceUnrepairable,
} from "../database.js";
import { currentUser } from "../config.js";
import { $, escapeHtml, findById, optionsHtml } from "../helpers.js";
import { conditionBadge, statusBadge } from "../ui/badges.js";
import { toast } from "../ui/toast.js";
import { initLayout } from "../ui/layout.js";

initLayout();

// For each tab: which statuses to offer in the filter, and how to draw one table row.
// (The table headings are in history.html.)
const TABS = {
  borrow: {
    statuses: ["Active", "Returned"],
    rowHtml: borrowRowHtml,
    statusOf: (record) => record.status,
  },
  inspection: {
    statuses: ["Passed", "Needs Maintenance"],
    rowHtml: inspectionRowHtml,
    statusOf: (record) => record.result,
  },
  maintenance: {
    statuses: ["Completed", "In Progress", "Unrepairable"],
    rowHtml: maintenanceRowHtml,
    statusOf: (record) => record.status,
  },
};

const isSafetyOfficer = currentUser.role.trim().toLowerCase() === "safety officer";
const isToolManager = currentUser.role.trim().toLowerCase() === "tool manager";
if (isSafetyOfficer) {
  delete TABS.borrow;
  document.querySelector('[data-tab="borrow"]').remove();
  $("#panel-borrow").remove();
  $("#panel-inspection .inspection-record-id-heading").remove();
  $("#panel-inspection .inspection-remarks-heading").remove();
  $(".subtitle").textContent = "Complete inspection and maintenance records";
}

let tools = [];
let records = { borrow: [], inspection: [], maintenance: [] };
let currentTab = isSafetyOfficer ? "inspection" : "borrow";
let refreshInProgress = false;

// ---------- Load data and show everything ----------
async function refreshPage() {
  if (refreshInProgress) return;
  refreshInProgress = true;
  try {
    [tools, records.borrow, records.inspection, records.maintenance] = await Promise.all([
      getTools(),
      isSafetyOfficer ? Promise.resolve([]) : getBorrows(),
      getInspections(),
      getMaintenanceRecords(),
    ]);

    showTable();
  } finally {
    refreshInProgress = false;
  }
}

// ---------- Tabs ----------
function showTab(name) {
  currentTab = name;

  // Highlight the tab button, show only that tab's table
  document.querySelectorAll(".tab").forEach((button) => {
    button.classList.toggle("active", button.dataset.tab === name);
  });
  Object.keys(TABS).forEach((tabName) => {
    $(`#panel-${tabName}`).classList.toggle("hidden", tabName !== name);
  });

  // Each tab has its own list of statuses; start with empty filters.
  $("#statusFilter").innerHTML = `<option value="">All Statuses</option>` + optionsHtml(TABS[name].statuses);
  $("#searchBox").value = "";

  showTable();
}

document.querySelectorAll(".tab").forEach((button) => {
  button.addEventListener("click", () => showTab(button.dataset.tab));
});

// ---------- Search + filter ----------
function showTable() {
  const tab = TABS[currentTab];
  const search = $("#searchBox").value.toLowerCase();
  const status = $("#statusFilter").value;

  const matches = records[currentTab].filter((record) => {
    const toolType = findById(tools, record.toolId)?.type;
    const searchableText = [record.id, record.toolId, toolType, record.borrower, record.inspector].join(" ").toLowerCase();

    const matchesStatus = !status || tab.statusOf(record) === status;
    const matchesSearch = !search || searchableText.includes(search);
    return matchesStatus && matchesSearch;
  });

  $(`#body-${currentTab}`).innerHTML = matches.map(tab.rowHtml).join("");
  $(`#foot-${currentTab}`).textContent = `${matches.length} records`;
}

$("#searchBox").addEventListener("input", showTable);
$("#statusFilter").addEventListener("input", showTable);

// ---------- Table rows (one function per tab) ----------

// The first three columns are the same on every tab.
function idCellsHtml(record) {
  const toolType = findById(tools, record.toolId)?.type;
  return `
    <td class="mono">${escapeHtml(record.id)}</td>
    <td><b class="mono">${escapeHtml(record.toolId)}</b></td>
    <td>${escapeHtml(toolType)}</td>`;
}

function borrowRowHtml(record) {
  return `
    <tr>
      ${idCellsHtml(record)}
      <td>${escapeHtml(record.borrower)}</td>
      <td>${record.borrowDate}</td>
      <td>${record.expected}</td>
      <td>${record.actual || "—"}</td>
      <td>${record.condReturned ? conditionBadge(record.condReturned) : "—"}</td>
      <td>${statusBadge(record.status)}</td>
    </tr>`;
}

function inspectionRowHtml(record) {
  return `
    <tr>
      ${isSafetyOfficer ? "" : `<td class="mono">${escapeHtml(record.id)}</td>`}
      <td><b class="mono">${escapeHtml(record.toolId)}</b></td>
      <td>${escapeHtml(findById(tools, record.toolId)?.type)}</td>
      <td>${record.date}</td>
      <td>${escapeHtml(record.inspector)}</td>
      <td>${statusBadge(record.result)}</td>
      <td>${conditionBadge(record.condition)}</td>
      <td>${escapeHtml(record.findings)}</td>
      ${isSafetyOfficer ? "" : `<td>${escapeHtml(record.remarks)}</td>`}
    </tr>`;
}

function maintenanceRowHtml(record) {
  const completeButton = !isToolManager && record.status === "In Progress"
    ? `<button class="btn sm" data-complete="${escapeHtml(record.id)}">Mark Complete</button>`
    : "";
  const unrepairableButton = !isToolManager && record.status === "In Progress"
    ? `<button class="btn sm" data-unrepairable="${escapeHtml(record.id)}">Unrepairable</button>`
    : "";

  return `
    <tr>
      <td><b class="mono">${escapeHtml(record.toolId)}</b></td>
      <td>${escapeHtml(findById(tools, record.toolId)?.type)}</td>
      <td>${record.date}</td>
      <td><b>${escapeHtml(record.type)}</b></td>
      <td>${escapeHtml(record.issue)}</td>
      <td>${escapeHtml(record.action)}</td>
      <td>${statusBadge(record.status)}</td>
      <td><div class="row nowrap">${completeButton}${unrepairableButton}</div></td>
    </tr>`;
}

$("#body-maintenance").addEventListener("click", async (event) => {
  const button = event.target.closest("button[data-complete], button[data-unrepairable]");
  if (!button) return;

  try {
    if (button.dataset.unrepairable
        && !window.confirm("Mark this tool as unrepairable and remove it from service?")) return;
    const record = button.dataset.complete
      ? await completeMaintenance(button.dataset.complete)
      : await markMaintenanceUnrepairable(button.dataset.unrepairable);
    await refreshPage();
    toast(record.status === "Unrepairable"
      ? `${record.toolId} marked unsafe because it cannot be repaired.`
      : `Maintenance completed. ${record.toolId} is now available.`);
  } catch (error) {
    toast(error.message);
  }
});

if (isToolManager) {
  window.setInterval(() => {
    if (document.visibilityState === "visible") {
      refreshPage().catch((error) => toast(`Could not refresh maintenance history: ${error.message}`));
    }
  }, 3000);
  window.addEventListener("focus", () => {
    refreshPage().catch((error) => toast(`Could not refresh maintenance history: ${error.message}`));
  });
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") {
      refreshPage().catch((error) => toast(`Could not refresh maintenance history: ${error.message}`));
    }
  });
}

// ---------- Start ----------
showTab(currentTab);   // also fills the status filter
refreshPage();
