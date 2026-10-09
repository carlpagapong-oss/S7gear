import { esc } from "../core/helpers.js";

const STATUS_CLASS = {
  // tool status
  Available: "b-green",
  Borrowed: "b-blue",
  "Under Maintenance": "b-orange",
  "Under Inspection": "b-purple",
  Unsafe: "b-red",
  // borrow status
  Returned: "b-green",
  Active: "b-blue",
  // inspection result
  Passed: "b-green",
  "Needs Maintenance": "b-orange",
  "Failed / Unsafe": "b-red",
  // maintenance status
  Completed: "b-green",
  "In Progress": "b-orange",
};

const CONDITION_CLASS = {
  New: "b-blue",
  Good: "b-green",
  Fair: "b-orange",
  Damaged: "b-red",
  Unsafe: "b-red",
};

export const statusBadge = (status, withDot = false) =>
  `<span class="badge ${STATUS_CLASS[status] ?? "b-gray"} ${withDot ? "dot" : ""}">${esc(status)}</span>`;

export const conditionBadge = (condition) =>
  `<span class="badge ${CONDITION_CLASS[condition] ?? "b-gray"}">${esc(condition)}</span>`;
