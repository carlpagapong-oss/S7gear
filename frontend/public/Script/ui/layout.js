// Layout — call initLayout() once at the top of every page script.
import { showSidebar } from "./sidebar.js";
import { initModals } from "./modal.js";

export function initLayout() {
  showSidebar();
  initModals();
}
