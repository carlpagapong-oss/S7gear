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
import { currentUser } from "../config.js";
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
let refreshInProgress = false;
let editingToolId = null;   // null = we are adding a new tool
let imagePreviewUrl = null;
const isToolManager = currentUser.role.trim().toLowerCase() === "tool manager";

// ---------- Show the table ----------
async function showTools() {
  if (refreshInProgress) return;
  refreshInProgress = true;
  try {
    [tools, activeBorrows, toolCategories] = await Promise.all([
      getTools(),
      getActiveBorrows(),
      getToolCategories(),
    ]);

    $("#toolCount").textContent = `${tools.length} total power tools registered`;
    if (isToolManager) {
      $("#unrepairableFilterLabel").hidden = false;
    }

    const selectedStatus = $("#statusFilter").value;
    const selectedType = $("#typeFilter").value;
    $("#typeFilter").innerHTML = `<option value="">All Types</option>` + optionsHtml(uniqueValues(tools.map((tool) => tool.type)));
    $("#statusFilter").innerHTML = `<option value="">All Statuses</option>` + optionsHtml(uniqueValues(tools.map((tool) => tool.status)));
    $("#typeFilter").value = selectedType;
    $("#statusFilter").value = selectedStatus;
    showFilteredTools();
  } finally {
    refreshInProgress = false;
  }
}

function showFilteredTools() {
  const search = $("#recordSearch").value.trim().toLowerCase();
  const status = $("#statusFilter").value;
  const type = $("#typeFilter").value;
  const includeUnrepairable = !isToolManager || $("#includeUnrepairable").checked;
  const visibleTools = tools.filter((tool) => {
    const matchesSearch = !search || [
      tool.id, tool.type, tool.brand, tool.model, tool.category,
    ].join(" ").toLowerCase().includes(search);
    const matchesStatus = !status || tool.status === status;
    const matchesType = !type || tool.type === type;
    const matchesUnrepairable = includeUnrepairable || !tool.unrepairable;
    return matchesSearch && matchesStatus && matchesType && matchesUnrepairable;
  }).sort((first, second) => {
    const firstUnsafe = first.status === "Unsafe" || first.condition === "Unsafe";
    const secondUnsafe = second.status === "Unsafe" || second.condition === "Unsafe";
    return Number(firstUnsafe) - Number(secondUnsafe);
  });
  const rows = visibleTools.map((tool) => toolRowHtml(tool, findActiveBorrow(activeBorrows, tool.id), true));
  $("#toolsBody").innerHTML = rows.join("") || emptyRowHtml(9, "No tools found");
  $("#toolsFoot").textContent = `${visibleTools.length} tools shown`;
}

$("#includeUnrepairable").addEventListener("change", showFilteredTools);
$("#recordSearch").addEventListener("input", showFilteredTools);
$("#statusFilter").addEventListener("change", showFilteredTools);
$("#typeFilter").addEventListener("change", showFilteredTools);

if (isToolManager) {
  window.setInterval(() => {
    if (document.visibilityState === "visible" && $("#toolModal").classList.contains("hidden")) {
      showTools().catch((error) => toast(`Could not refresh tools: ${error.message}`));
    }
  }, 3000);
  window.addEventListener("focus", () => {
    if ($("#toolModal").classList.contains("hidden")) {
      showTools().catch((error) => toast(`Could not refresh tools: ${error.message}`));
    }
  });
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible" && $("#toolModal").classList.contains("hidden")) {
      showTools().catch((error) => toast(`Could not refresh tools: ${error.message}`));
    }
  });
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

  if (!tool) return toast("Tool not found.");
  if (tool.status === "Borrowed" || findActiveBorrow(activeBorrows, id)) {
    return toast("Return this tool before deleting it.");
  }
  if (!confirm(`Permanently delete ${tool.id} — ${tool.type} and all its history? This cannot be undone.`)) return;

  try {
    await deleteTool(id);
    await showTools();
    toast("Tool and its history deleted.");
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
