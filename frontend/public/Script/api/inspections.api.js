import { apiRequest, postJson } from "./client.js";

export function getInspections() {
  return apiRequest("/inspections");
}

export function saveInspection(toolId, form) {
  return postJson("/inspections", { toolId, ...form });
}
