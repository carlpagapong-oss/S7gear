import { apiRequest, postJson } from "./client.js";

export function getBorrows() {
  return apiRequest("/borrows");
}

export function getActiveBorrows() {
  return apiRequest("/borrows?status=Active");
}

export function borrowTool(toolId, form) {
  return postJson("/borrows", { toolId, ...form });
}

export function returnTool(borrowId, form) {
  return postJson(`/borrows/${encodeURIComponent(borrowId)}/return`, form);
}
