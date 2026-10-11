// =========================================================
// TOOL RECORDS PAGE (records.html)
// Table of all tools + add / edit / view / delete
// =========================================================

import {
  addTool,
  deleteTool,
  getActiveBorrows,
  getToolCategories,
  getToolHistory,
  getTools,
  updateTool,
  uploadToolImage,
} from "../database.js";
import { $, escapeHtml, findActiveBorrow, findById, nextId, optionsHtml, uniqueValues } from "../helpers.js";
import { conditionBadge, statusBadge } from "../ui/badges.js";
import { closeModal, openModal } from "../ui/modal.js";
import { toast } from "../ui/toast.js";
import { emptyRowHtml, toolRowHtml } from "../ui/tool-table.js";
import { initLayout } from "../ui/layout.js";

initLayout();

let tools = [];
let toolCategories = [];
let activeBorrows = [];
let editingToolId = null;   // null = we are adding a new tool
let imagePreviewUrl = null;

// ---------- Show the table ----------
async function showTools() {
  [tools, activeBorrows, toolCategories] = await Promise.all([
    getTools(),
    getActiveBorrows(),
    getToolCategories(),
  ]);

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
function updateToolTypeOptions(category) {
  const types = uniqueValues(
    tools.filter((tool) => tool.category === category).map((tool) => tool.type),
  );
  $("#toolTypeList").innerHTML = optionsHtml(types);
  return types;
}

$("#toolCategory").addEventListener("change", () => {
  const availableTypes = updateToolTypeOptions($("#toolCategory").value);
  if (!availableTypes.includes($("#toolType").value)) {
    $("#toolType").value = "";
  }
});

$("#toolImage").addEventListener("change", (event) => {
  if (imagePreviewUrl) URL.revokeObjectURL(imagePreviewUrl);
  imagePreviewUrl = null;

  const image = event.target.files[0];
  const preview = $("#toolImagePreview");
  if (!image) {
    preview.removeAttribute("src");
    preview.hidden = true;
    return;
  }

  imagePreviewUrl = URL.createObjectURL(image);
  preview.src = imagePreviewUrl;
  preview.hidden = false;
});

function openToolForm(tool) {
  const isEditing = Boolean(tool);
  const isBorrowed = isEditing && tool.status === "Borrowed";

  $("#toolForm").reset();
  if (imagePreviewUrl) URL.revokeObjectURL(imagePreviewUrl);
  imagePreviewUrl = null;
  $("#toolImagePreview").removeAttribute("src");
  $("#toolImagePreview").hidden = true;
  editingToolId = isEditing ? tool.id : null;

  $("#toolModalTitle").textContent = isEditing ? `Edit Tool ${tool.id}` : "Add New Tool";
  $("#toolCategory").innerHTML = `<option value="">Select a category</option>${toolCategories
    .map((category) => `<option value="${escapeHtml(category.name)}">${escapeHtml(category.name)}</option>`)
    .join("")}`;
  $("#toolTypeList").innerHTML = "";

  // The ID is generated for new tools and cannot be changed afterwards.
  $("#toolId").value = isEditing ? tool.id : nextId(tools, "PT");
  $("#toolId").readOnly = isEditing;

  if (isEditing) {
    $("#toolCategory").value = tool.category;
    updateToolTypeOptions(tool.category);
    $("#toolType").value = tool.type;
    $("#toolBrand").value = tool.brand || "";
    $("#toolModel").value = tool.model || "";
    $("#toolPower").value = tool.power;
    if (tool.imagePath) {
      $("#toolImagePreview").src = tool.imagePath;
      $("#toolImagePreview").hidden = false;
    }
    $("#toolCondition").value = tool.condition;
    $("#toolStatus").value = tool.status;
  }

  // A borrowed tool's status can only change through Borrowing & Return.
  $("#toolStatus").disabled = isBorrowed;

  openModal("toolModal");
}

$("#toolForm").addEventListener("submit", async (event) => {
  event.preventDefault();
  const formData = new FormData(event.target);
  const data = Object.fromEntries(formData);

  try {
    const selectedImage = formData.get("image");
    const existingTool = editingToolId ? findById(tools, editingToolId) : null;
    const imagePath = selectedImage instanceof File && selectedImage.size > 0
      ? await uploadToolImage(selectedImage)
      : existingTool?.imagePath || "";

    if (editingToolId) {
      const changes = {
        type: data.type.trim(),
        brand: data.brand.trim(),
        model: data.model.trim(),
        category: data.category.trim(),
        power: data.power,
        imagePath,
        condition: data.condition,
      };
      // A disabled field is not sent by the browser, so status is missing for borrowed tools.
      if (data.status) changes.status = data.status;

      await updateTool(editingToolId, changes);
    } else {
      await addTool({
        ...data,
        id: data.id.toUpperCase(),
        type: data.type.trim(),
        brand: data.brand.trim(),
        model: data.model.trim(),
        category: data.category.trim(),
        imagePath,
      });
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
  const detailsImage = $("#detailsImage");
  detailsImage.hidden = !tool.imagePath;
  if (tool.imagePath) {
    detailsImage.src = tool.imagePath;
  } else {
    detailsImage.removeAttribute("src");
  }
  $("#detailsBrand").textContent = tool.brand || "—";
  $("#detailsModel").textContent = tool.model || "—";
  $("#detailsPower").textContent = tool.power;
  $("#detailsCategory").textContent = tool.category;
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
