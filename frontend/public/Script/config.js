// =========================================================
// CONFIG — settings and business rules you may want to change
// =========================================================

// The authenticated employee inspects tools and is stored with each inspection.
export const currentUser = {
  id: sessionStorage.getItem("employee_id") || "",
  name: sessionStorage.getItem("employee_name") || "",
  role: sessionStorage.getItem("role") || "",
};

// When a tool is returned, its CONDITION decides its new STATUS.
// (Keep the "Condition upon return" dropdown in borrow.html in sync with these.)
export const STATUS_AFTER_RETURN = {
  "Good":    "Available",
  "Fair":    "Under Inspection",
  "Damaged": "Under Maintenance",
  "Unsafe":  "Unsafe",
};

// After a safety inspection, the RESULT decides the tool's new STATUS.
export const STATUS_AFTER_INSPECTION = {
  "Passed":            "Available",
  "Needs Maintenance": "Under Maintenance",
  "Failed / Unsafe":   "Unsafe",
};
