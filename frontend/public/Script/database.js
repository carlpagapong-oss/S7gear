// Compatibility exports for page modules. Keep API details in the resource files.
export {
  addTool,
  deleteTool,
  getToolCategories,
  getTools,
  updateTool,
  uploadToolImage,
} from "./api/tools.api.js";
export {
  borrowTool,
  getActiveBorrows,
  getBorrows,
  returnTool,
} from "./api/borrows.api.js";

export {
  getInspectionSchedule,
  getInspections,
  saveInspection,
  saveInspectionSchedule,
} from "./api/inspections.api.js";

export {
  addMaintenanceRecord,
  completeMaintenance,
  getMaintenanceRecords,
  markMaintenanceUnrepairable,
} from "./api/maintenance.api.js";

export { getToolHistory } from "./api/history.api.js";
