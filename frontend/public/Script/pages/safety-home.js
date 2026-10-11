import { getTools, getInspections, getMaintenanceRecords } from "../database.js";
import { $, countByStatus, escapeHtml } from "../helpers.js";
import { statusBadge } from "../ui/badges.js";
import { initLayout } from "../ui/layout.js";

initLayout();

async function showSafetyBoard() {
  const [tools, inspections, maintenance] = await Promise.all([
    getTools(),
    getInspections(),
    getMaintenanceRecords(),
  ]);

  $("#todayText").textContent = new Date().toLocaleDateString("en-US", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });
  $("#inspectionDueCount").textContent = countByStatus(tools, "Under Inspection");
  $("#unsafeCount").textContent = countByStatus(tools, "Unsafe");
  $("#maintenanceCount").textContent = maintenance.filter((item) => item.status === "In Progress").length;
  $("#inspectionCount").textContent = inspections.length;

  $("#safetyRecentInspections").innerHTML = inspections.slice(0, 6).map((item) => `
    <div class="list-item">
      <div><b class="mono">${escapeHtml(item.toolId)}</b><br>
        <small>${escapeHtml(item.date)} · ${escapeHtml(item.inspector)}</small></div>
      ${statusBadge(item.result)}
    </div>`).join("") || `<div class="empty">No inspections recorded</div>`;

  const activeMaintenance = maintenance.filter((item) => item.status === "In Progress");
  $("#safetyMaintenanceQueue").innerHTML = activeMaintenance.slice(0, 6).map((item) => `
    <div class="list-item">
      <div><b class="mono">${escapeHtml(item.toolId)}</b> — ${escapeHtml(item.type)}<br>
        <small>${escapeHtml(item.issue)}</small></div>
      ${statusBadge(item.status)}
    </div>`).join("") || `<div class="empty">No active maintenance</div>`;
}

showSafetyBoard();
