import { completeMaintenance, getMaintenanceRecords, markMaintenanceUnrepairable } from "../database.js";
import { $, escapeHtml } from "../helpers.js";
import { conditionBadge, statusBadge } from "../ui/badges.js";
import { toast } from "../ui/toast.js";
import { initLayout } from "../ui/layout.js";
import { openModal } from "../ui/modal.js";

initLayout();
let maintenanceRecords = [];

async function refreshPage() {
  maintenanceRecords = await getMaintenanceRecords();
  showMaintenanceRecords(maintenanceRecords);
}

function showMaintenanceRecords(records) {
  const activeRecords = records.filter((record) => record.status === "In Progress");
  const completedRecords = records.filter((record) => record.status !== "In Progress");

  const rowsHtml = (items) => items.map((record) => `
    <tr>
      <td class="mono">${escapeHtml(record.toolId)}</td>
      <td>${escapeHtml(record.toolType)}</td>
      <td>${escapeHtml(record.category)}</td>
      <td>${escapeHtml(record.toolCondition)}</td>
      <td>${escapeHtml(record.date)}</td>
      <td>${escapeHtml(record.type)}</td>
      <td>${escapeHtml(record.issue)}</td>
      <td>${escapeHtml(record.action)}</td>
      <td>${statusBadge(record.status)}</td>
      <td><div class="row nowrap">
        <button type="button" class="btn sm" data-view="${escapeHtml(record.id)}">View</button>
        ${record.status === "In Progress"
          ? `<button type="button" class="btn sm" data-complete="${escapeHtml(record.id)}">Complete</button>`
          : ""}
        ${record.status === "In Progress"
          ? `<button type="button" class="btn sm" data-unrepairable="${escapeHtml(record.id)}">Unrepairable</button>`
          : ""}
      </div></td>
    </tr>`).join("");

  $("#activeMaintenanceBody").innerHTML = rowsHtml(activeRecords)
    || `<tr><td colspan="10" class="empty">No active maintenance records</td></tr>`;
  $("#completedMaintenanceBody").innerHTML = rowsHtml(completedRecords)
    || `<tr><td colspan="10" class="empty">No completed or unrepairable maintenance records</td></tr>`;
}

$(".content").addEventListener("click", async (event) => {
  const viewButton = event.target.closest("button[data-view]");
  if (viewButton) {
    showMaintenanceDetails(maintenanceRecords.find((record) => record.id === viewButton.dataset.view));
    return;
  }
  const button = event.target.closest("button[data-complete], button[data-unrepairable]");
  if (!button) return;
  try {
    if (button.dataset.complete) {
      await completeMaintenance(button.dataset.complete);
      toast("Maintenance completed. The tool is now available.");
    } else {
      if (!window.confirm("Mark this tool as unrepairable and remove it from service?")) return;
      const record = await markMaintenanceUnrepairable(button.dataset.unrepairable);
      toast(`${record.toolId} marked unsafe because it cannot be repaired.`);
    }
    await refreshPage();
  } catch (error) {
    toast(error.message);
  }
});

function showMaintenanceDetails(record) {
  if (!record) return;

  $("#maintenanceDetailsTitle").textContent = `${record.toolId} — ${record.toolType}`;
  const image = $("#maintenanceDetailsImage");
  image.hidden = !record.imagePath;
  if (record.imagePath) image.src = record.imagePath;
  else image.removeAttribute("src");

  $("#maintenanceDetailsToolId").textContent = record.toolId || "—";
  $("#maintenanceDetailsCategory").textContent = record.category || "—";
  $("#maintenanceDetailsBrand").textContent = record.brand || "—";
  $("#maintenanceDetailsModel").textContent = record.model || "—";
  $("#maintenanceDetailsPower").textContent = record.power || "—";
  $("#maintenanceDetailsCondition").innerHTML = conditionBadge(record.toolCondition || "Unknown");
  $("#maintenanceDetailsToolStatus").innerHTML = statusBadge(record.toolStatus || "Unknown");
  $("#maintenanceDetailsRecord").textContent = `${record.type} · ${record.date} · ${record.status}`;
  $("#maintenanceDetailsIssue").textContent = record.issue || "No issue details provided.";
  $("#maintenanceDetailsAction").textContent = record.action || "No action details provided.";
  openModal("maintenanceDetailsModal");
}

refreshPage();
