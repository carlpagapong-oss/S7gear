import { esc } from "../core/helpers.js";
import { findActiveBorrow } from "../core/store.js";
import { statusBadge, conditionBadge } from "./badge.js";

/** Shared by Tool Records (withActions = true) and Availability (false). */
export function toolTable(tools, withActions) {
  const headers = ["TOOL ID", "TOOL TYPE", "POWER", "CONDITION", "STATUS", "CURRENT BORROWER", "EXPECTED RETURN", "LAST INSPECTION"];
  if (withActions) headers.push("");

  const rows = tools.map((tool) => toolRow(tool, withActions)).join("");
  const emptyRow = `<tr><td colspan="9" class="empty">No tools found</td></tr>`;

  return `
    <table>
      <thead><tr>${headers.map((h) => `<th>${h}</th>`).join("")}</tr></thead>
      <tbody>${rows || emptyRow}</tbody>
    </table>
    <div class="foot">${tools.length} tools</div>`;
}

function toolRow(tool, withActions) {
  const borrow = findActiveBorrow(tool.id);

  const actions = `
    <td class="row" style="flex-wrap:nowrap">
      <button class="btn sm" data-view="${tool.id}">View</button>
      <button class="btn sm" data-edit="${tool.id}">Edit</button>
      <button class="btn sm danger" data-del="${tool.id}">Delete</button>
    </td>`;

  return `
    <tr>
      <td><b class="mono">${tool.id}</b></td>
      <td>${esc(tool.type)}</td>
      <td>${tool.power}</td>
      <td>${conditionBadge(tool.condition)}</td>
      <td>${statusBadge(tool.status, true)}</td>
      <td>${borrow ? esc(borrow.borrower) : "—"}</td>
      <td>${borrow ? borrow.expected : "—"}</td>
      <td>${tool.lastInspection || "—"}</td>
      ${withActions ? actions : ""}
    </tr>`;
}
