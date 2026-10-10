// Tool table rows (used by Tool Records and Availability).
import { escapeHtml } from "../helpers.js";
import { statusBadge, conditionBadge } from "./badges.js";

/**
 * One <tr> for the tool tables.
 * `borrow` is the tool's active borrowing (or undefined).
 * `showActions` adds the View / Edit / Delete buttons (Tool Records page only).
 */
export function toolRowHtml(tool, borrow, showActions) {
  const id = escapeHtml(tool.id);

  const actions = `
    <td>
      <div class="row nowrap">
        <button class="btn sm" data-action="view" data-id="${id}">View</button>
        <button class="btn sm" data-action="edit" data-id="${id}">Edit</button>
        <button class="btn sm danger" data-action="delete" data-id="${id}">Delete</button>
      </div>
    </td>`;

  return `
    <tr>
      <td><b class="mono">${id}</b></td>
      <td>${escapeHtml(tool.type)}</td>
      <td>${escapeHtml(tool.power)}</td>
      <td>${conditionBadge(tool.condition)}</td>
      <td>${statusBadge(tool.status, true)}</td>
      <td>${borrow ? escapeHtml(borrow.borrower) : "—"}</td>
      <td>${borrow ? escapeHtml(borrow.expected) : "—"}</td>
      <td>${escapeHtml(tool.lastInspection) || "—"}</td>
      ${showActions ? actions : ""}
    </tr>`;
}

/** A table row that says there is nothing to show. */
export function emptyRowHtml(columns, message) {
  return `<tr><td colspan="${columns}" class="empty">${message}</td></tr>`;
}
