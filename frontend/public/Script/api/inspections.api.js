import { apiRequest, postJson } from "./client.js";

export function getInspections() {
  return apiRequest("/inspections");
}

export function getInspectionSchedule() {
  return apiRequest("/inspections/schedule");
}

export function saveInspectionSchedule(date) {
  return postJson("/inspections/schedule", { date });
}

export function saveInspection(toolId, form) {
  return postJson("/inspections", { toolId, ...form });
}
