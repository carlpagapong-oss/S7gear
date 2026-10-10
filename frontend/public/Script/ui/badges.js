// Badges — colored status pills.
import { escapeHtml } from "../helpers.js";

export const STATUS_COLORS = {
  // tool status
  "Available": "b-green",
  "Borrowed": "b-blue",
  "Under Maintenance": "b-orange",
  "Under Inspection": "b-purple",
  "Unsafe": "b-red",
  // borrow status
  "Returned": "b-green",
  "Active": "b-blue",
  // inspection result
  "Passed": "b-green",
  "Needs Maintenance": "b-orange",
  "Failed / Unsafe": "b-red",
  // maintenance status
  "Completed": "b-green",
  "In Progress": "b-orange",
};

export const CONDITION_COLORS = {
  "New": "b-blue",
  "Good": "b-green",
  "Fair": "b-orange",
  "Damaged": "b-red",
  "Unsafe": "b-red",
};

/** statusBadge("Available") -> green pill.  Pass true as 2nd argument for a ● dot. */
export function statusBadge(status, withDot = false) {
  const color = STATUS_COLORS[status] ?? "b-gray";
  const dot = withDot ? "dot" : "";
  return `<span class="badge ${color} ${dot}">${escapeHtml(status)}</span>`;
}

export function conditionBadge(condition) {
  const color = CONDITION_COLORS[condition] ?? "b-gray";
  return `<span class="badge ${color}">${escapeHtml(condition)}</span>`;
}
