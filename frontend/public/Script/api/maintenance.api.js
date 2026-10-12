import { apiRequest, postJson } from "./client.js";

export function getMaintenanceRecords() {
  return apiRequest("/maintenance");
}

export function addMaintenanceRecord(record) {
  return postJson("/maintenance", record);
}

export function completeMaintenance(id) {
  return postJson(`/maintenance/${encodeURIComponent(id)}/complete`, {});
}

export function markMaintenanceUnrepairable(id) {
  return postJson(`/maintenance/${encodeURIComponent(id)}/unrepairable`, {});
}
