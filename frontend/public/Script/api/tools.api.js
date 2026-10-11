import { apiRequest, postJson } from "./client.js";

export function getTools() {
  return apiRequest("/tools");
}

export function getToolCategories() {
  return apiRequest("/tools/categories");
}

export function uploadToolImage(image) {
  const formData = new FormData();
  formData.append("image", image);
  return apiRequest("/tools/images", {
    method: "POST",
    body: formData,
  }).then((result) => result.imagePath);
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
