// Sidebar menu. To add a page: add a line here, then create pages/<name>.html.
import { $, escapeHtml } from "../helpers.js";
import { logout } from "../api/client.js";

export const MENU_ITEMS = [
  { page: "home",         file: "home.html",         icon: "⌂",  label: "Home" },
  { page: "safety-home",  file: "safety-home.html",  icon: "⌂",  label: "Safety Board" },
  { page: "records",      file: "records.html",      icon: "🔧", label: "Tool Records" },
  { page: "borrow",       file: "borrow.html",       icon: "⇄",  label: "Borrowing & Return" },
  { page: "inspection",   file: "inspection.html",   icon: "✓",  label: "Safety Inspection" },
  { page: "maintenance",  file: "maintenance.html",  icon: "⚙",  label: "Maintenance" },
  { page: "availability", file: "availability.html", icon: "▦",  label: "Availability" },
  { page: "history",      file: "history.html",      icon: "⟲",  label: "History" },
];

// Each page sets <body data-page="..."> so we know which menu item to highlight.
export function showSidebar() {
  const currentPage = document.body.dataset.page;
  const role = (sessionStorage.getItem("role") || "").trim().toLowerCase();
  const isSafetyOfficer = role === "safety officer";
  const isToolManager = role === "tool manager";
  const allowedPages = isSafetyOfficer
    ? ["safety-home", "inspection", "maintenance"]
    : MENU_ITEMS
      .filter((item) => item.page !== "safety-home"
        && !(isToolManager && ["inspection", "maintenance"].includes(item.page)))
      .map((item) => item.page);
  const homePage = isSafetyOfficer ? "safety-home.html" : "home.html";

  if (!sessionStorage.getItem("auth_token")) {
    window.location.replace(new URL("login.html", window.location.href).href);
  } else if (!allowedPages.includes(currentPage)) {
    window.location.replace(new URL(homePage, window.location.href).href);
  }

  const links = MENU_ITEMS.filter((item) => allowedPages.includes(item.page)).map((item) => `
    <a href="${item.file}" class="${item.page === currentPage ? "active" : ""}">
      <span>${item.icon}</span>${item.label}
    </a>`).join("");
  const userName = sessionStorage.getItem("employee_name") || "Signed-in user";
  const userInitial = [...userName.trim()][0]?.toUpperCase() || "?";
  const userRole = sessionStorage.getItem("role") || "User";

  $("#sidebar").innerHTML = `
    <div class="brand">
      <div class="logo">🔧</div>
      <div><b>S7Gear</b><small>TOOL MANAGEMENT</small></div>
    </div>
    <nav>
      ${links}
      <div class="sidebar-profile" title="${escapeHtml(userName)}">
        <div class="profile-avatar" aria-hidden="true">${escapeHtml(userInitial)}</div>
        <div class="profile-copy">
          <b>${escapeHtml(userName)}</b>
          <small>${escapeHtml(userRole)}</small>
        </div>
      </div>
      <button type="button" class="logout-button">⇥ Log out</button>
    </nav>`;

  $(".logout-button").addEventListener("click", () => {
    logout().then(() => {
      sessionStorage.clear();
      window.location.href = new URL("login.html", window.location.href).href;
    }).catch((error) => {
      alert(`Could not sign out: ${error.message}`);
    });
  });
}
