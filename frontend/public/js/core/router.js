import { $ } from "./helpers.js";
import { CLICK } from "./events.js";

const NAV_ITEMS = [
  { id: "home",         icon: "⌂",  label: "Home" },
  { id: "records",      icon: "🔧", label: "Tool Records" },
  { id: "borrow",       icon: "⇄",  label: "Borrowing & Return" },
  { id: "inspection",   icon: "✓",  label: "Safety Inspection" },
  { id: "availability", icon: "▦",  label: "Availability" },
  { id: "history",      icon: "⟲",  label: "History" },
];

// pageId -> { render: () => html, after?: () => void }
const pages = {};
let currentPage = "home";

/**
 * Register a page.
 *   render() returns the page HTML.
 *   after()  (optional) runs once the HTML is on screen — use it to attach listeners.
 */
export function registerPage(id, { render, after }) {
  pages[id] = { render, after };
}

export function go(pageId) {
  currentPage = pageId;
  render();
  window.scrollTo(0, 0);
}

export function render() {
  const page = pages[currentPage];

  $("#nav").innerHTML = NAV_ITEMS.map(({ id, icon, label }) => `
    <a data-go="${id}" class="${id === currentPage ? "active" : ""}">
      <span>${icon}</span>${label}
    </a>`).join("");

  $("#pageTitle").textContent = NAV_ITEMS.find((item) => item.id === currentPage).label;
  $("#content").innerHTML = page.render();
  page.after?.();
}

CLICK.go = (el) => go(el.dataset.go);
