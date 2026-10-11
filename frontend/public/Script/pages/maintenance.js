import { addMaintenanceRecord, completeMaintenance, getMaintenanceRecords, getTools } from "../database.js";
import { $, escapeHtml, today } from "../helpers.js";
import { statusBadge } from "../ui/badges.js";
import { toast } from "../ui/toast.js";
import { initLayout } from "../ui/layout.js";

initLayout();

let tools = [];

async function refreshPage() {
  const [loadedTools, maintenance] = await Promise.all([
    getTools(),
    getMaintenanceRecords(),
  ]);
  tools = loadedTools;
  showToolOptions();
  showMaintenanceRecords(maintenance);
}

function showToolOptions() {
  const select = $("#maintenanceTool");
  const selected = select.value;
  select.innerHTML = tools.map((tool) =>
    `<option value="${escapeHtml(tool.id)}">${escapeHtml(tool.id)} — ${escapeHtml(tool.type)} (${escapeHtml(tool.status)})</option>`,
  ).join("");
  if (tools.some((tool) => tool.id === selected)) select.value = selected;
}

function showMaintenanceRecords(records) {
  $("#maintenanceBody").innerHTML = records.map((record) => `
    <tr>
      <td class="mono">${escapeHtml(record.id)}</td>
      <td class="mono">${escapeHtml(record.toolId)}</td>
      <td>${escapeHtml(record.date)}</td>
      <td>${escapeHtml(record.type)}</td>
      <td>${escapeHtml(record.issue)}</td>
      <td>${escapeHtml(record.action)}</td>
      <td>${statusBadge(record.status)}</td>
      <td>${record.status === "In Progress"
        ? `<button type="button" class="btn sm" data-complete="${escapeHtml(record.id)}">Complete</button>`
        : "—"}</td>
    </tr>`).join("") || `<tr><td colspan="8" class="empty">No maintenance records</td></tr>`;
}

$("#maintenanceDate").value = today();

$("#maintenanceForm").addEventListener("submit", async (event) => {
  event.preventDefault();
  const data = Object.fromEntries(new FormData(event.target));
  try {
    await addMaintenanceRecord({ ...data, status: "In Progress" });
    toast("Maintenance record saved.");
    event.target.reset();
    $("#maintenanceDate").value = today();
    await refreshPage();
  } catch (error) {
    toast(error.message);
  }
});

$("#maintenanceBody").addEventListener("click", async (event) => {
  const button = event.target.closest("button[data-complete]");
  if (!button) return;
  try {
    await completeMaintenance(button.dataset.complete);
    toast("Maintenance marked as complete.");
    await refreshPage();
  } catch (error) {
    toast(error.message);
  }
});

refreshPage();
