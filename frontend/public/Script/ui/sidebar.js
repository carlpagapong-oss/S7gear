// Sidebar menu. To add a page: add a line here, then create pages/<name>.html.
import { $ } from "../helpers.js";

export const MENU_ITEMS = [
  { page: "home",         file: "home.html",         icon: "⌂",  label: "Home" },
  { page: "records",      file: "records.html",      icon: "🔧", label: "Tool Records" },
  { page: "borrow",       file: "borrow.html",       icon: "⇄",  label: "Borrowing & Return" },
  { page: "inspection",   file: "inspection.html",   icon: "✓",  label: "Safety Inspection" },
  { page: "availability", file: "availability.html", icon: "▦",  label: "Availability" },
  { page: "history",      file: "history.html",      icon: "⟲",  label: "History" },
];

// Each page sets <body data-page="..."> so we know which menu item to highlight.
export function showSidebar() {
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
