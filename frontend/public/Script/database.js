// Compatibility exports for page modules. Keep API details in the resource files.
export { addTool, deleteTool, getTools, updateTool } from "./api/tools.api.js";
export {
  borrowTool,
  getActiveBorrows,
  getBorrows,
  returnTool,
} from "./api/borrows.api.js";

export { getInspections, saveInspection } from "./api/inspections.api.js";

export {
  addMaintenanceRecord,
  completeMaintenance,
  getMaintenanceRecords,
} from "./api/maintenance.api.js";

export { getToolHistory } from "./api/history.api.js";
