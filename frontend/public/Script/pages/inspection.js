// =========================================================
// SAFETY INSPECTION PAGE (inspection.html)
// =========================================================

import { STATUS_AFTER_INSPECTION, currentUser } from "../config.js";
import { getInspections, getTools, saveInspection } from "../database.js";
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
  "Failed / Unsafe":   "on-red",
};

let tools = [];
let selectedToolId = null;
let checklist = {};          // { itemNumber: "Pass" | "Fail" | "N/A" }
let selectedResult = "";     // "Passed" | "Needs Maintenance" | "Failed / Unsafe"

// ---------- Load data and show everything ----------
async function refreshPage() {
  tools = await getTools();
  const inspections = await getInspections();

  showSelectedTool();
  showChecklist();
  showResultButtons();
  showRecentInspections(inspections.slice(0, 5));   // newest 5
}

function resetInspection() {
  selectedToolId = null;
  checklist = {};
  selectedResult = "";
}

function setFormDefaults() {
  $("#inspector").value = currentUser.name;
  $("#inspectionDate").value = today();
}

// ---------- Find a tool ----------
$("#findForm").addEventListener("submit", (event) => {
  event.preventDefault();
  const id = $("#findToolId").value.trim().toUpperCase();
  const tool = findById(tools, id);

  if (!tool) return toast(`Tool ${id} not found.`);
  if (tool.status === "Borrowed") return toast("Tool is currently borrowed.");

  resetInspection();        // start a fresh checklist for this tool
  selectedToolId = id;
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
      <span class="mono t-muted">${tool.id}</span>
      <div class="mt-sm">
        <div class="kv"><span class="kv-label">Status</span><div>${statusBadge(tool.status)}</div></div>
        <div class="kv"><span class="kv-label">Condition</span><div>${conditionBadge(tool.condition)}</div></div>
        <div class="kv"><span class="kv-label">Power</span><div><b>${tool.power}</b></div></div>
        <div class="kv"><span class="kv-label">Last Inspection</span><div>${tool.lastInspection || "—"}</div></div>
      </div>
    </div>`;
}

function showRecentInspections(inspections) {
  const items = inspections.map((inspection) => `
    <div class="list-item">
      <div>
        <b class="mono">${inspection.toolId}</b><br>
        <small>${inspection.date} · ${escapeHtml(inspection.inspector)}</small>
      </div>
      ${statusBadge(inspection.result)}
    </div>`);

  $("#recentList").innerHTML = items.join("") || `<div class="empty">No inspections yet</div>`;
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

    toast(`Inspection saved — ${tool.id} is now ${tool.status}.`);
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
