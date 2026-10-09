// =========================================================
// CONFIG — settings and business rules you may want to change
// =========================================================

// Pre-fills the "Inspector" field on the Safety Inspection page.
// When you add a login system, put the logged-in user's name here.
const currentUser = {
  name: "",
};

// When a tool is returned, its CONDITION decides its new STATUS.
// (Keep the "Condition upon return" dropdown in borrow.html in sync with these.)
const STATUS_AFTER_RETURN = {
  "Good":    "Available",
  "Fair":    "Under Inspection",
  "Damaged": "Under Maintenance",
  "Unsafe":  "Unsafe",
};

// After a safety inspection, the RESULT decides the tool's new STATUS.
const STATUS_AFTER_INSPECTION = {
  "Passed":            "Available",
  "Needs Maintenance": "Under Maintenance",
  "Failed / Unsafe":   "Unsafe",
};
