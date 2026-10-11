import { apiRequest } from "./client.js";

export function getToolHistory(toolId) {
  return apiRequest(`/tools/${encodeURIComponent(toolId)}/history`);
}
