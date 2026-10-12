import { getTools, getInspections, getMaintenanceRecords } from "../database.js";
import { $, countByStatus, escapeHtml } from "../helpers.js";
import { conditionBadge, statusBadge } from "../ui/badges.js";
import { initLayout } from "../ui/layout.js";
import { toast } from "../ui/toast.js";

initLayout();

let refreshInProgress = false;
let safetyTools = [];

function showSafetyTools() {
  const query = $("#safetyToolSearch").value.trim().toLowerCase();
  const status = $("#safetyToolStatus").value;
  const matches = safetyTools.filter((tool) => {
    const matchesQuery = `${tool.id} ${tool.type} ${tool.category}`.toLowerCase().includes(query);
    return matchesQuery && (!status || tool.status === status);
  });
  const ordered = matches.sort((first, second) => {
    const firstUnsafe = first.status === "Unsafe" || first.condition === "Unsafe";
    const secondUnsafe = second.status === "Unsafe" || second.condition === "Unsafe";
    return Number(firstUnsafe) - Number(secondUnsafe);
  });

  $("#safetyToolsBody").innerHTML = ordered.map((tool) => `
    <tr>
      <td><b class="mono">${escapeHtml(tool.id)}</b></td>
      <td>${escapeHtml(tool.type)}</td>
      <td>${escapeHtml(tool.category)}</td>
      <td>${conditionBadge(tool.condition)}</td>
      <td>${statusBadge(tool.unrepairable ? "Unrepairable" : tool.status, true)}</td>
    </tr>`).join("") || `<tr><td colspan="5" class="empty">No tools found</td></tr>`;
  $("#safetyToolsFoot").textContent = `${ordered.length} tools`;
}

async function showSafetyBoard() {
  if (refreshInProgress) return;
  refreshInProgress = true;

  try {
    const [tools, inspections, maintenance] = await Promise.all([
      getTools(),
      getInspections(),
      getMaintenanceRecords(),
    ]);
    safetyTools = tools;
    showSafetyTools();

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
  } catch (error) {
    toast(`Could not refresh the Safety Board: ${error.message}`);
  } finally {
    refreshInProgress = false;
  }
}

$("#safetyToolSearch").addEventListener("input", showSafetyTools);
$("#safetyToolStatus").addEventListener("change", showSafetyTools);
showSafetyBoard();
window.setInterval(() => {
  if (document.visibilityState === "visible") showSafetyBoard();
}, 10000);
window.addEventListener("focus", showSafetyBoard);
document.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "visible") showSafetyBoard();
});
