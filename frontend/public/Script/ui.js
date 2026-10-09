// =========================================================
// UI — pieces of the interface shared by every page
//   1. Sidebar menu
//   2. Toast (small message at the bottom right)
//   3. Modal (pop-up window)
//   4. Badges (colored status pills)
//   5. Tool table rows (used by Tool Records and Availability)
// =========================================================


// ---------- 1. Sidebar ----------
// To add a page to the menu: add a line here, then create the page's .html file.
const MENU_ITEMS = [
  { page: "home",         file: "index.html",        icon: "⌂",  label: "Home" },
  { page: "records",      file: "records.html",      icon: "🔧", label: "Tool Records" },
  { page: "borrow",       file: "borrow.html",       icon: "⇄",  label: "Borrowing & Return" },
  { page: "inspection",   file: "inspection.html",   icon: "✓",  label: "Safety Inspection" },
  { page: "availability", file: "availability.html", icon: "▦",  label: "Availability" },
  { page: "history",      file: "history.html",      icon: "⟲",  label: "History" },
];

// Each page sets <body data-page="..."> so we know which menu item to highlight.
function showSidebar() {
  const currentPage = document.body.dataset.page;

  const links = MENU_ITEMS.map((item) => `
    <a href="${item.file}" class="${item.page === currentPage ? "active" : ""}">
      <span>${item.icon}</span>${item.label}
    </a>`).join("");

  $("#sidebar").innerHTML = `
    <div class="brand">
      <div class="logo">🔧</div>
      <div><b>S7Gear</b><small>TOOL MANAGEMENT</small></div>
    </div>
    <nav>${links}</nav>`;
}

showSidebar();


// ---------- 2. Toast ----------
let toastTimer;

function toast(message) {
  const box = $("#toast");
  box.textContent = message;
  box.classList.add("show");

  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => box.classList.remove("show"), 2500);
}


// ---------- 3. Modal ----------
// A modal is a <div class="modal hidden" id="..."> written in the page's HTML.

function openModal(id) {
  document.getElementById(id).classList.remove("hidden");
}

function closeModal(id) {
  document.getElementById(id).classList.add("hidden");
}

// Close a modal when its dark background or any [data-close-modal] button is clicked.
document.addEventListener("click", (event) => {
  if (event.target.classList.contains("modal")) {
    event.target.classList.add("hidden");
  }

  const closeButton = event.target.closest("[data-close-modal]");
  if (closeButton) {
    closeButton.closest(".modal").classList.add("hidden");
  }
});


// ---------- 4. Badges ----------
// Which color each status / result gets.
const STATUS_COLORS = {
  // tool status
  "Available": "b-green",
  "Borrowed": "b-blue",
  "Under Maintenance": "b-orange",
  "Under Inspection": "b-purple",
  "Unsafe": "b-red",
  // borrow status
  "Returned": "b-green",
  "Active": "b-blue",
  // inspection result
  "Passed": "b-green",
  "Needs Maintenance": "b-orange",
  "Failed / Unsafe": "b-red",
  // maintenance status
  "Completed": "b-green",
  "In Progress": "b-orange",
};

const CONDITION_COLORS = {
  "New": "b-blue",
  "Good": "b-green",
  "Fair": "b-orange",
  "Damaged": "b-red",
  "Unsafe": "b-red",
};

/** statusBadge("Available") -> green pill.  Pass true as 2nd argument for a ● dot. */
function statusBadge(status, withDot = false) {
  const color = STATUS_COLORS[status] ?? "b-gray";
  const dot = withDot ? "dot" : "";
  return `<span class="badge ${color} ${dot}">${escapeHtml(status)}</span>`;
}

function conditionBadge(condition) {
  const color = CONDITION_COLORS[condition] ?? "b-gray";
  return `<span class="badge ${color}">${escapeHtml(condition)}</span>`;
}


// ---------- 5. Tool table rows ----------

/**
 * One <tr> for the tool tables.
 * `borrow` is the tool's active borrowing (or undefined).
 * `showActions` adds the View / Edit / Delete buttons (Tool Records page only).
 */
function toolRowHtml(tool, borrow, showActions) {
  const actions = `
    <td>
      <div class="row nowrap">
        <button class="btn sm" data-action="view" data-id="${tool.id}">View</button>
        <button class="btn sm" data-action="edit" data-id="${tool.id}">Edit</button>
        <button class="btn sm danger" data-action="delete" data-id="${tool.id}">Delete</button>
      </div>
    </td>`;

  return `
    <tr>
      <td><b class="mono">${tool.id}</b></td>
      <td>${escapeHtml(tool.type)}</td>
      <td>${tool.power}</td>
      <td>${conditionBadge(tool.condition)}</td>
      <td>${statusBadge(tool.status, true)}</td>
      <td>${borrow ? escapeHtml(borrow.borrower) : "—"}</td>
      <td>${borrow ? borrow.expected : "—"}</td>
      <td>${tool.lastInspection || "—"}</td>
      ${showActions ? actions : ""}
    </tr>`;
}

/** A table row that says there is nothing to show. */
function emptyRowHtml(columns, message) {
  return `<tr><td colspan="${columns}" class="empty">${message}</td></tr>`;
}
