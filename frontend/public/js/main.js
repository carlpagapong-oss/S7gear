import { initEvents } from "./core/events.js";
import { render } from "./core/router.js";

// Importing a page file registers it with the router.
import "./pages/home.js";
import "./pages/records.js";
import "./pages/borrow.js";
import "./pages/inspection.js";
import "./pages/availability.js";
import "./pages/history.js";

initEvents();
render();
