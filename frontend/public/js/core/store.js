import { SEED } from "../data/seed.js";

const STORAGE_KEY = "s7gear-data-v1";

/** All saved data: tools, borrows, inspections, maintenance. */
export const db = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "null") ?? structuredClone(SEED);

/** Call after changing `db` to persist it. */
export const save = () => localStorage.setItem(STORAGE_KEY, JSON.stringify(db));

/** Temporary UI state (not saved). */
export const ui = {
  borrowTab: "borrow",   // "borrow" | "return"
  borrowToolId: null,
  returnBorrowId: null,
  historyTab: "borrow",  // "borrow" | "inspection" | "maintenance"
  inspectionToolId: null,
  checklist: {},         // { itemIndex: "Pass" | "Fail" | "N/A" }
  inspectionResult: "",
};

// ---------- Lookups ----------
export const findTool = (id) => db.tools.find((tool) => tool.id === id);

export const findActiveBorrow = (toolId) =>
  db.borrows.find((borrow) => borrow.toolId === toolId && borrow.status === "Active");

export const countByStatus = (status) =>
  db.tools.filter((tool) => tool.status === status).length;
