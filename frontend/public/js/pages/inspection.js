import { $, esc, today, nextId } from "../core/helpers.js";
import { db, save, ui, findTool } from "../core/store.js";
import { registerPage, render as rerender } from "../core/router.js";
import { CLICK, FORMS } from "../core/events.js";
import { currentUser } from "../config.js";
import { toast } from "../components/toast.js";
import { statusBadge, conditionBadge } from "../components/badge.js";

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

const CHECK_VALUES = [
  { value: "Pass", activeClass: "b-green" },
  { value: "Fail", activeClass: "b-red" },
  { value: "N/A",  activeClass: "b-gray" },
];

const RESULTS = {
  "Passed":            { activeClass: "on-green",  note: "Tool status will be changed to Available." },
  "Needs Maintenance": { activeClass: "on-orange", note: "Tool status will be changed to Under Maintenance." },
  "Failed / Unsafe":   { activeClass: "on-red",    note: "Tool status will be changed to Unsafe." },
};

// ---------- Page ----------
function render() {
  const tool = ui.inspectionToolId && findTool(ui.inspectionToolId);
  const checkedCount = Object.keys(ui.checklist).length;
  const recent = [...db.inspections].sort((a, b) => b.id.localeCompare(a.id)).slice(0, 5);

  return `
    <h2 class="title">Safety Inspection</h2>
    <p class="subtitle">Record a safety inspection for a power tool — ${today()}</p>

    <div class="grid-side">
      <div>
        <div class="card" style="margin-bottom:14px">
          <div class="card-h">Find Tool</div>
          <div class="card-b">
            <form id="findInspection" class="row">
              <input id="findInspectionId" placeholder="e.g. PT-001" value="${esc(ui.inspectionToolId)}" style="flex:1">
              <button class="btn primary">Go</button>
            </form>
            ${tool ? selectedToolBox(tool) : ""}
          </div>
        </div>

        <div class="card">
          <div class="card-h">Recent Inspections</div>
          ${recent.map(recentItem).join("")}
        </div>
      </div>

      <div>
        <div class="card" style="margin-bottom:14px">
          <div class="card-h">
            Safety Checklist
            <span class="t-muted" style="font-weight:500;font-size:13px">${checkedCount}/${CHECKLIST_ITEMS.length} checked</span>
          </div>
          <table class="check">
            <thead><tr><th>ITEM</th><th style="width:200px">CHECK</th></tr></thead>
            <tbody>${CHECKLIST_ITEMS.map(checklistRow).join("")}</tbody>
          </table>
        </div>

        <div class="card">
          <div class="card-h">Inspection Result</div>
          <div class="card-b">${resultForm()}</div>
        </div>
      </div>
    </div>`;
}

const selectedToolBox = (tool) => `
  <div class="tool-box">
    <small class="t-muted">SELECTED TOOL</small>
    <h3>${esc(tool.type)}</h3>
    <span class="mono t-muted">${tool.id}</span>
    <div style="margin-top:10px">
      <div class="kv"><span>Status</span>${statusBadge(tool.status)}</div>
      <div class="kv"><span>Condition</span>${conditionBadge(tool.condition)}</div>
      <div class="kv"><span>Power</span><b>${tool.power}</b></div>
      <div class="kv"><span>Last Inspection</span>${tool.lastInspection}</div>
    </div>
  </div>`;

const recentItem = (inspection) => `
  <div class="list-item">
    <div><b class="mono">${inspection.toolId}</b><br><small>${inspection.date} · ${esc(inspection.inspector)}</small></div>
    ${statusBadge(inspection.result)}
  </div>`;

function checklistRow(item, index) {
  const chosen = ui.checklist[index];

  const buttons = CHECK_VALUES.map(({ value, activeClass }) => `
    <button type="button" data-chk="${index}" data-val="${value}" class="${chosen === value ? activeClass : ""}">${value}</button>`).join("");

  return `
    <tr>
      <td>${item}</td>
      <td class="seg" style="display:table-cell"><span class="row">${buttons}</span></td>
    </tr>`;
}

function resultForm() {
  const resultButtons = Object.entries(RESULTS).map(([result, { activeClass }]) => `
    <button type="button" data-res="${result}" class="${ui.inspectionResult === result ? activeClass : ""}">${result}</button>`).join("");

  const note = RESULTS[ui.inspectionResult]?.note;

  return `
    <form id="inspectionForm">
      <div class="fgrid">
        <div class="field"><label>INSPECTOR *</label><input name="inspector" value="${esc(currentUser.name)}" placeholder="Your name" required></div>
        <div class="field"><label>INSPECTION DATE</label><input type="date" name="date" value="${today()}"></div>
      </div>
      <div class="field"><label>INSPECTION RESULT *</label><div class="seg">${resultButtons}</div></div>
      <div class="field"><label>FINDINGS</label><textarea name="findings" placeholder="Describe what was found..."></textarea></div>
      <div class="field"><label>REMARKS</label><textarea name="remarks" placeholder="Additional notes or recommendations..."></textarea></div>
      ${note ? `<div class="note"><b>After saving:</b> ${note}</div>` : ""}
      <button class="btn primary full">Save Inspection</button>
    </form>`;
}

// ---------- Handlers ----------
CLICK.chk = (el) => { ui.checklist[el.dataset.chk] = el.dataset.val; rerender(); };
CLICK.res = (el) => { ui.inspectionResult = el.dataset.res; rerender(); };

function resetInspection() {
  ui.inspectionToolId = null;
  ui.checklist = {};
  ui.inspectionResult = "";
}

FORMS.findInspection = () => {
  const id = $("#findInspectionId").value.trim().toUpperCase();
  const tool = findTool(id);

  if (!tool) return toast(`Tool ${id} not found.`);
  if (tool.status === "Borrowed") return toast("Tool is currently borrowed.");

  resetInspection();
  ui.inspectionToolId = id;
  rerender();
};

FORMS.inspectionForm = (form, data) => {
  const tool = findTool(ui.inspectionToolId);

  if (!tool) return toast("Find a tool first.");
  if (Object.keys(ui.checklist).length < CHECKLIST_ITEMS.length) return toast(`Complete all ${CHECKLIST_ITEMS.length} checklist items.`);
  if (!ui.inspectionResult) return toast("Choose an inspection result.");

  // New status + condition for the tool, based on the result.
  const wasBad = tool.condition === "Damaged" || tool.condition === "Unsafe";
  const OUTCOME = {
    "Passed":            { status: "Available",         condition: wasBad ? "Good" : tool.condition },
    "Needs Maintenance": { status: "Under Maintenance", condition: "Damaged" },
    "Failed / Unsafe":   { status: "Unsafe",            condition: "Unsafe" },
  };
  const { status, condition } = OUTCOME[ui.inspectionResult];

  db.inspections.push({
    id: nextId(db.inspections, "INS"),
    toolId: tool.id,
    date: data.date,
    inspector: data.inspector.trim(),
    result: ui.inspectionResult,
    condition,
    findings: data.findings,
    remarks: data.remarks,
  });
  Object.assign(tool, { status, condition, lastInspection: data.date });

  save();
  resetInspection();
  rerender();
  toast(`Inspection saved — ${tool.id} is now ${status}.`);
};

registerPage("inspection", { render });
