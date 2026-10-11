import { apiRequest } from "./client.js";

export function getEmployees() {
  return apiRequest("/employees");
}
