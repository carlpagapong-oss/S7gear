// =========================================================
// SAFETY INSPECTION PAGE (inspection.html)
// =========================================================

import { STATUS_AFTER_INSPECTION, currentUser } from "../config.js";
import {
  getInspectionSchedule,
  getInspections,
  getTools,
  saveInspection,
  saveInspectionSchedule,
} from "../database.js";
import { getEmployees } from "../api/employees.api.js";
import { $, escapeHtml, findById, today } from "../helpers.js";
import { conditionBadge, statusBadge } from "../ui/badges.js";
import { toast } from "../ui/toast.js";
import { initLayout } from "../ui/layout.js";

initLayout();

// The things an inspector checks. Add, remove or rename items here.
const CHECKLIST_ITEMS = [
  "Power cable / battery condition",
  "Plug / connector condition",
  "Switch / trigger operation",
  "Housing / body condition",
  "Guard / safety cover",
  "Safety mechanism function",
  "Visible cracks or damage",
  "Moving parts / chuck / blade",
  "General operating condition",
];

// The three choices for each checklist item, and the button color when chosen.
const CHECK_CHOICES = [
  { value: "Pass", activeClass: "on-green" },
  { value: "Fail", activeClass: "on-red" },
  { value: "N/A",  activeClass: "on-gray" },
];

// Button color for each inspection result.
const RESULT_COLORS = {
  "Passed":            "on-green",
  "Needs Maintenance": "on-orange",
};

let tools = [];
let schedule = { current: null, upcoming: null, inspections: [] };
let selectedToolId = null;
let inspectionFilter = "all";
let checklist = {};          // { itemNumber: "Pass" | "Fail" | "N/A" }
let selectedResult = "";     // "Passed" | "Needs Maintenance"
let statusRefreshInProgress = false;

// ---------- Load data and show everything ----------
async function refreshPage() {
  const isSafetyOfficer = currentUser.role.trim().toLowerCase() === "safety officer";
  const [loadedTools, inspections, inspectionSchedule, employees] = await Promise.all([
    getTools(),
    getInspections(),
    getInspectionSchedule(),
    isSafetyOfficer ? Promise.resolve([]) : getEmployees(),
  ]);
  tools = loadedTools;
  schedule = inspectionSchedule;
  showInspectorOptions(employees);

  showInspectionSchedule();
  showToolList();
  showSelectedTool();
  showChecklist();
  showResultButtons();
  showRecentInspections(inspections);
}

function resetInspection() {
  selectedToolId = null;
  checklist = {};
  selectedResult = "";
}

function setFormDefaults() {
  $("#inspector").value = currentUser.id;
  $("#inspectionDate").value = today();
}

function showInspectorOptions(employees) {
  const select = $("#inspector");
  if (currentUser.role.trim().toLowerCase() === "safety officer") {
    select.innerHTML = `<option value="${escapeHtml(currentUser.id)}">${escapeHtml(currentUser.name)}</option>`;
    select.value = currentUser.id;
    select.disabled = true;
  } else {
    select.disabled = false;
    select.innerHTML = `<option value="">Select an inspector</option>` + employees
      .map((employee) => `<option value="${employee.id}">${escapeHtml(employee.name)}</option>`)
      .join("");
    select.value = currentUser.id;
  }
}

function showToolList() {
  const query = $("#findToolId").value.trim().toLowerCase();
  const inspected = new Map(schedule.inspections.map((item) => [item.toolId, item]));
  const matches = tools.filter((tool) => {
    const inspection = inspected.get(tool.id);
    const matchesQuery = `${tool.id} ${tool.type} ${tool.category}`.toLowerCase().includes(query);
    const matchesFilter = inspectionFilter === "all"
      || (inspectionFilter === "inspected" && Boolean(inspection))
      || (inspectionFilter === "pending" && !inspection);
    return matchesQuery && matchesFilter;
  });
  if (matches.length === 0) {
    const message = query
      ? "No tools match your search."
      : inspectionFilter === "inspected"
        ? "No tools have been inspected for the current inspection."
        : inspectionFilter === "pending"
          ? "All tools have been inspected for the current inspection."
          : "No tools registered.";
    $("#inspectionToolList").innerHTML = `<div class="empty">${message}</div>`;
    return;
  }

  const rows = matches.map((tool) => `
    <tr class="${tool.id === selectedToolId ? "selected" : ""}">
      <td class="mono">${escapeHtml(tool.id)}</td>
      <td>${escapeHtml(tool.type)}</td>
      <td>${statusBadge(inspected.get(tool.id) ? "Inspected" : "Not Inspected")}</td>
      <td>${escapeHtml(inspected.get(tool.id)?.date || "—")}</td>
      <td>${statusBadge(tool.unrepairable ? "Unrepairable" : tool.status)}</td>
      <td>
        <button
          type="button"
          class="btn sm ${tool.id === selectedToolId ? "primary" : ""}"
          data-inspect-tool="${escapeHtml(tool.id)}"
          ${(tool.status === "Borrowed" || tool.unrepairable || inspected.has(tool.id) || !schedule.current) ? "disabled" : ""}
        >${tool.status === "Borrowed" ? "Borrowed" : tool.unrepairable ? "Unrepairable" : inspected.has(tool.id) ? "Inspected" : tool.id === selectedToolId ? "Selected" : "Inspect"}</button>
      </td>
    </tr>`).join("");
  $("#inspectionToolList").innerHTML = `
    <div class="table-wrap">
      <table>
        <thead><tr><th>TOOL ID</th><th>TOOL</th><th>INSPECTION STATUS</th><th>INSPECTED ON</th><th>TOOL STATUS</th><th>ACTION</th></tr></thead>
        <tbody>${rows}</tbody>
      </table>
    </div>`;
}

$("#findToolId").addEventListener("input", showToolList);
$("#inspectionStatusFilter").addEventListener("change", (event) => {
  inspectionFilter = event.target.value;
  showToolList();
});

function showInspectionSchedule() {
  const current = schedule.current
    ? `Current inspection: <b>${escapeHtml(schedule.current.date)}</b>.`
    : "No current inspection is scheduled yet.";
  const upcoming = schedule.upcoming
    ? ` Next inspection date: <b>${escapeHtml(schedule.upcoming.date)}</b>.`
    : "";
  $("#inspectionScheduleStatus").innerHTML = `${current}${upcoming}`;

  const dateInput = $("#scheduleDate");
  dateInput.min = today();
  if (!dateInput.value) dateInput.value = schedule.upcoming?.date || today();
  $("#scheduleSubmit").textContent = schedule.upcoming ? "Update Scheduled Date" : "Schedule Inspection";
}

$("#scheduleInspectionForm").addEventListener("submit", async (event) => {
  event.preventDefault();
  const scheduledDate = $("#scheduleDate").value;
  if (!scheduledDate) return toast("Choose an inspection date.");
  try {
    schedule = await saveInspectionSchedule(scheduledDate);
    toast(schedule.upcoming ? `Inspection rescheduled for ${schedule.upcoming.date}.` : `Inspection scheduled for ${scheduledDate}.`);
    await refreshPage();
  } catch (error) {
    toast(error.message);
  }
});

$("#inspectionToolList").addEventListener("click", (event) => {
  const button = event.target.closest("button[data-inspect-tool]");
  if (!button) return;
  const id = button.dataset.inspectTool;
  const tool = findById(tools, id);
  if (!tool || tool.status === "Borrowed") return;

  resetInspection();        // start a fresh checklist for this tool
  selectedToolId = id;
  showToolList();
  showSelectedTool();
  showChecklist();
  showResultButtons();
});

function showSelectedTool() {
  const tool = findById(tools, selectedToolId);

  if (!tool) {
    $("#selectedTool").innerHTML = "";
    return;
  }

  $("#selectedTool").innerHTML = `
    <div class="tool-box">
      <small class="t-muted">SELECTED TOOL</small>
      <h3>${escapeHtml(tool.type)}</h3>
      <span class="mono t-muted">${escapeHtml(tool.id)}</span>
      <div class="mt-sm">
        <div class="kv"><span class="kv-label">Status</span><div>${statusBadge(tool.unrepairable ? "Unrepairable" : tool.status)}</div></div>
        <div class="kv"><span class="kv-label">Condition</span><div>${conditionBadge(tool.condition)}</div></div>
        <div class="kv"><span class="kv-label">Power</span><div><b>${tool.power}</b></div></div>
        <div class="kv"><span class="kv-label">Last Inspection</span><div>${tool.lastInspection || "—"}</div></div>
      </div>
    </div>`;
}

function showRecentInspections(inspections) {
  if (inspections.length === 0) {
    $("#recentList").innerHTML = `<div class="empty">No inspections yet</div>`;
    return;
  }
  const rows = inspections.map((inspection) => `
    <tr>
      <td class="mono">${escapeHtml(inspection.toolId)}</td>
      <td>${escapeHtml(inspection.date)}</td>
      <td>${escapeHtml(inspection.inspector)}</td>
      <td>${statusBadge(inspection.result)}</td>
    </tr>`).join("");
  $("#recentList").innerHTML = `
    <div class="table-wrap">
      <table>
        <thead><tr><th>TOOL ID</th><th>INSPECTION DATE</th><th>INSPECTOR</th><th>RESULT</th></tr></thead>
        <tbody>${rows}</tbody>
      </table>
    </div>`;
}

// ---------- Checklist ----------
function showChecklist() {
  const rows = CHECKLIST_ITEMS.map((item, index) => {
    const buttons = CHECK_CHOICES.map((choice) => {
      const isChosen = checklist[index] === choice.value;
      return `<button type="button" data-item="${index}" data-choice="${choice.value}" class="${isChosen ? choice.activeClass : ""}">${choice.value}</button>`;
    }).join("");

    return `<tr><td>${escapeHtml(item)}</td><td><div class="seg seg-small">${buttons}</div></td></tr>`;
  });

  $("#checklistBody").innerHTML = rows.join("");
  $("#checkedCount").textContent = `${Object.keys(checklist).length}/${CHECKLIST_ITEMS.length} checked`;
}

$("#checklistBody").addEventListener("click", (event) => {
  const button = event.target.closest("button[data-item]");
  if (!button) return;

  checklist[button.dataset.item] = button.dataset.choice;
  showChecklist();
});

// ---------- Inspection result buttons ----------
function showResultButtons() {
  document.querySelectorAll("#resultButtons button").forEach((button) => {
    const isSelected = button.dataset.result === selectedResult;
    button.className = isSelected ? RESULT_COLORS[button.dataset.result] : "";
  });

  // The note tells the user what will happen to the tool.
  const note = $("#resultNote");
  note.classList.toggle("hidden", !selectedResult);
  if (selectedResult) {
    note.innerHTML = `<b>After saving:</b> Tool status will be changed to ${STATUS_AFTER_INSPECTION[selectedResult]}.`;
  }
}

$("#resultButtons").addEventListener("click", (event) => {
  const button = event.target.closest("button[data-result]");
  if (!button) return;

  selectedResult = button.dataset.result;
  showResultButtons();
});

// ---------- Save ----------
$("#inspectionForm").addEventListener("submit", async (event) => {
  event.preventDefault();
  const form = event.target;
  const data = Object.fromEntries(new FormData(form));

  if (!selectedToolId) return toast("Find a tool first.");
  if (Object.keys(checklist).length < CHECKLIST_ITEMS.length) {
    return toast(`Complete all ${CHECKLIST_ITEMS.length} checklist items.`);
  }
  if (!selectedResult) return toast("Choose an inspection result.");
  if (selectedResult === "Passed" && Object.values(checklist).includes("Fail")) {
    return toast("A checklist item failed — the result cannot be Passed.");
  }

  try {
    const tool = await saveInspection(selectedToolId, { ...data, result: selectedResult });

    toast(selectedResult === "Needs Maintenance"
      ? `Inspection saved — ${tool.id} added to the maintenance queue.`
      : `Inspection saved — ${tool.id} is now ${tool.status}.`);
    resetInspection();
    form.reset();
    setFormDefaults();
    $("#findToolId").value = "";
    await refreshPage();
  } catch (error) {
    toast(error.message);
  }
});

// ---------- Start ----------
$("#todayText").textContent = today();
setFormDefaults();
refreshPage();
async function refreshToolStatuses() {
  if (statusRefreshInProgress) return;
  statusRefreshInProgress = true;
  try {
    tools = await getTools();
    showToolList();
    showSelectedTool();
  } catch (error) {
    toast(`Could not refresh tool statuses: ${error.message}`);
  } finally {
    statusRefreshInProgress = false;
  }
}

window.setInterval(() => {
  if (document.visibilityState === "visible") refreshToolStatuses();
}, 10000);
window.addEventListener("focus", refreshToolStatuses);
document.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "visible") refreshToolStatuses();
});
