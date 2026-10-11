// =========================================================
// HISTORY PAGE (history.html)
// Three tabs: Borrowing, Inspection, Maintenance
// =========================================================

import { addMaintenanceRecord, completeMaintenance, getBorrows, getInspections, getMaintenanceRecords, getTools } from "../database.js";
import { $, escapeHtml, findById, optionsHtml, today } from "../helpers.js";
import { conditionBadge, statusBadge } from "../ui/badges.js";
import { closeModal, openModal } from "../ui/modal.js";
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
    statuses: ["Passed", "Needs Maintenance", "Failed / Unsafe"],
    rowHtml: inspectionRowHtml,
    statusOf: (record) => record.result,
  },
  maintenance: {
    statuses: ["Completed", "In Progress"],
    rowHtml: maintenanceRowHtml,
    statusOf: (record) => record.status,
  },
};

let tools = [];
let records = { borrow: [], inspection: [], maintenance: [] };
let currentTab = "borrow";

// ---------- Load data and show everything ----------
async function refreshPage() {
  tools = await getTools();
  records.borrow = await getBorrows();
  records.inspection = await getInspections();
  records.maintenance = await getMaintenanceRecords();

  $("#countBorrow").textContent = records.borrow.length;
  $("#countInspection").textContent = records.inspection.length;
  $("#countMaintenance").textContent = records.maintenance.length;

  showTable();
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
  $("#addMaintenanceButton").classList.toggle("hidden", name !== "maintenance");

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
      ${idCellsHtml(record)}
      <td>${record.date}</td>
      <td>${escapeHtml(record.inspector)}</td>
      <td>${statusBadge(record.result)}</td>
      <td>${conditionBadge(record.condition)}</td>
      <td>${escapeHtml(record.findings)}</td>
      <td>${escapeHtml(record.remarks)}</td>
    </tr>`;
}

function maintenanceRowHtml(record) {
  const completeButton = record.status === "In Progress"
    ? `<button class="btn sm" data-complete="${escapeHtml(record.id)}">Mark Complete</button>`
    : "";

  return `
    <tr>
      ${idCellsHtml(record)}
      <td>${record.date}</td>
      <td><b>${escapeHtml(record.type)}</b></td>
      <td>${escapeHtml(record.issue)}</td>
      <td>${escapeHtml(record.action)}</td>
      <td>${statusBadge(record.status)}</td>
      <td>${completeButton}</td>
    </tr>`;
}

// ---------- Mark a maintenance job complete ----------
$("#body-maintenance").addEventListener("click", async (event) => {
  const button = event.target.closest("button[data-complete]");
  if (!button) return;

  try {
    const record = await completeMaintenance(button.dataset.complete);
    await refreshPage();
    toast(`${record.id} completed. ${record.toolId} sent for inspection.`);
  } catch (error) {
    toast(error.message);
  }
});

// ---------- Add maintenance record ----------
$("#addMaintenanceButton").addEventListener("click", () => {
  const options = tools.map((tool) => `<option value="${tool.id}">${tool.id} — ${escapeHtml(tool.type)}</option>`);

  $("#maintenanceForm").reset();
  $("#maintenanceTool").innerHTML = options.join("");
  $("#maintenanceDate").value = today();
  openModal("maintenanceModal");
});

$("#maintenanceForm").addEventListener("submit", async (event) => {
  event.preventDefault();
  const data = Object.fromEntries(new FormData(event.target));

  try {
    await addMaintenanceRecord(data);
    closeModal("maintenanceModal");
    await refreshPage();
    toast("Maintenance record added.");
  } catch (error) {
    toast(error.message);
  }
});

// ---------- Start ----------
showTab("borrow");   // also fills the status filter
refreshPage();
