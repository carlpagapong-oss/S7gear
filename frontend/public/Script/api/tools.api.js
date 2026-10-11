import { apiRequest, postJson } from "./client.js";

export function getTools() {
  return apiRequest("/tools");
}

export function addTool(tool) {
  return postJson("/tools", tool);
}

export function updateTool(id, changes) {
  return apiRequest(`/tools/${encodeURIComponent(id)}`, {
    method: "PUT",
    body: JSON.stringify(changes),
  });
}

export function deleteTool(id) {
  return apiRequest(`/tools/${encodeURIComponent(id)}`, {
    method: "DELETE",
  });
}
