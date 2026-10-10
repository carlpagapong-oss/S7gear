// =========================================================
// TOOL RECORDS PAGE (records.html)
// Table of all tools + add / edit / view / delete
// =========================================================

import { addTool, deleteTool, getActiveBorrows, getToolHistory, getTools, updateTool } from "../database.js";
import { $, escapeHtml, findActiveBorrow, findById, nextId, optionsHtml, uniqueValues } from "../helpers.js";
import { conditionBadge, statusBadge } from "../ui/badges.js";
import { closeModal, openModal } from "../ui/modal.js";
import { toast } from "../ui/toast.js";
import { emptyRowHtml, toolRowHtml } from "../ui/tool-table.js";
import { initLayout } from "../ui/layout.js";

initLayout();

let tools = [];
let activeBorrows = [];
let editingToolId = null;   // null = we are adding a new tool

// ---------- Show the table ----------
async function showTools() {
  tools = await getTools();
  activeBorrows = await getActiveBorrows();

  $("#toolCount").textContent = `${tools.length} total power tools registered`;
  $("#toolsFoot").textContent = `${tools.length} tools`;

  const rows = tools.map((tool) => toolRowHtml(tool, findActiveBorrow(activeBorrows, tool.id), true));
  $("#toolsBody").innerHTML = rows.join("") || emptyRowHtml(9, "No tools found");
}

// ---------- Buttons in the table (View / Edit / Delete) ----------
$("#toolsBody").addEventListener("click", (event) => {
  const button = event.target.closest("button[data-action]");
  if (!button) return;

  const id = button.dataset.id;
  if (button.dataset.action === "view")   openToolDetails(id);
  if (button.dataset.action === "edit")   openToolForm(findById(tools, id));
  if (button.dataset.action === "delete") confirmDeleteTool(id);
});

$("#addToolButton").addEventListener("click", () => openToolForm(null));

// ---------- Add / Edit form ----------
function openToolForm(tool) {
  const isEditing = Boolean(tool);
  const isBorrowed = isEditing && tool.status === "Borrowed";

  $("#toolForm").reset();
  editingToolId = isEditing ? tool.id : null;

  $("#toolModalTitle").textContent = isEditing ? `Edit Tool ${tool.id}` : "Add New Tool";
  $("#toolTypeList").innerHTML = optionsHtml(uniqueValues(tools.map((t) => t.type)));

  // The ID is generated for new tools and cannot be changed afterwards.
  $("#toolId").value = isEditing ? tool.id : nextId(tools, "PT");
  $("#toolId").readOnly = isEditing;

  if (isEditing) {
    $("#toolType").value = tool.type;
    $("#toolPower").value = tool.power;
    $("#toolCondition").value = tool.condition;
    $("#toolStatus").value = tool.status;
    $("#toolLastInspection").value = tool.lastInspection;
  }

  // A borrowed tool's status can only change through Borrowing & Return.
  $("#toolStatus").disabled = isBorrowed;

  openModal("toolModal");
}

$("#toolForm").addEventListener("submit", async (event) => {
  event.preventDefault();
  const data = Object.fromEntries(new FormData(event.target));

  try {
    if (editingToolId) {
      const changes = {
        type: data.type.trim(),
        power: data.power,
        condition: data.condition,
        lastInspection: data.lastInspection,
      };
      // A disabled field is not sent by the browser, so status is missing for borrowed tools.
      if (data.status) changes.status = data.status;

      await updateTool(editingToolId, changes);
    } else {
      await addTool({ ...data, id: data.id.toUpperCase(), type: data.type.trim() });
    }

    closeModal("toolModal");
    await showTools();
    toast("Tool saved.");
  } catch (error) {
    toast(error.message);
  }
});

// ---------- Delete ----------
async function confirmDeleteTool(id) {
  const tool = findById(tools, id);

  if (tool.status === "Borrowed") return toast("Cannot delete a borrowed tool.");
  if (!confirm(`Delete ${tool.id} — ${tool.type}?`)) return;

  try {
    await deleteTool(id);
    await showTools();
    toast("Tool deleted.");
  } catch (error) {
    toast(error.message);
  }
}

// ---------- View details ----------
async function openToolDetails(id) {
  const tool = findById(tools, id);
  const borrow = findActiveBorrow(activeBorrows, id);
  const history = await getToolHistory(id);

  $("#detailsTitle").textContent = `${tool.id} — ${tool.type}`;
  $("#detailsPower").textContent = tool.power;
  $("#detailsCondition").innerHTML = conditionBadge(tool.condition);
  $("#detailsStatus").innerHTML = statusBadge(tool.status, true);
  $("#detailsBorrower").textContent = borrow ? borrow.borrower : "—";
  $("#detailsInspection").textContent = tool.lastInspection || "—";

  const activity = [
    ...history.borrows.map((b) => activityItemHtml("Borrowed", ` by ${escapeHtml(b.borrower)}`, b.borrowDate, statusBadge(b.status))),
    ...history.inspections.map((i) => activityItemHtml("Inspection", ` · ${escapeHtml(i.inspector)}`, i.date, statusBadge(i.result))),
    ...history.maintenance.map((m) => activityItemHtml(escapeHtml(m.type), "", m.date, statusBadge(m.status))),
  ];
  $("#detailsActivity").innerHTML = activity.join("") || `<div class="empty">No records</div>`;

  openModal("detailsModal");
}

function activityItemHtml(title, extra, date, badge) {
  return `
    <div class="list-item">
      <div><b>${title}</b>${extra}<br><small>${date}</small></div>
      ${badge}
    </div>`;
}

showTools();
