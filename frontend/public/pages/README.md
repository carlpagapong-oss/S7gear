# S7Gear — Power Tool Management System

Plain HTML + CSS + JavaScript. No frameworks, no build step.

## Folder structure

```
S7Gear/
├── index.html            Home (dashboard)
├── records.html          Tool Records
├── borrow.html           Borrowing & Return
├── inspection.html       Safety Inspection
├── availability.html     Availability
├── history.html          History
│
├── css/
│   ├── style.css         ← the only file the pages link; it imports the rest
│   ├── base.css          colors, reset, small helper classes
│   ├── layout.css        sidebar, top bar, page headings
│   ├── components.css    badges, buttons, tabs, modal, toast
│   ├── forms.css         inputs, fields, option buttons
│   ├── tables.css        tables, search toolbar
│   ├── cards.css         cards, stat counters, lists, grids
│   └── responsive.css    tablet / phone layout
│
└── js/
    ├── config.js         settings + business rules (status after return/inspection)
    ├── helpers.js        small utility functions (dates, ids, escaping...)
    ├── seed-data.js      sample data for the first run
    ├── database.js       ★ ALL data reading/saving happens here ★
    ├── ui.js             sidebar, toast, modal, badges, tool table rows
    └── pages/
        ├── home.js
        ├── records.js
        ├── borrow.js
        ├── inspection.js
        ├── availability.js
        └── history.js
```

## How to run

Open the folder with a local server (the VS Code **Live Server** extension, or
run `python -m http.server` in the folder and visit `http://localhost:8000`).
Data is saved in the browser (localStorage) until you add a real database.

## How each page is built

Every page follows the same three-part pattern:

| Part | File | What it contains |
|------|------|------------------|
| Structure | `records.html` | The page layout, tables, forms and pop-ups (modals) |
| Looks | `css/*.css` | Colors, spacing, fonts |
| Behavior | `js/pages/records.js` | Loads data, fills the tables, handles buttons and forms |

The HTML holds the fixed structure. The page's JavaScript only fills in the
changing parts (table rows, numbers, lists) and reacts to clicks.

Every page loads the same shared scripts, in this order, then its own script:

```html
<script src="js/config.js"></script>
<script src="js/helpers.js"></script>
<script src="js/seed-data.js"></script>
<script src="js/database.js"></script>
<script src="js/ui.js"></script>
<script src="js/pages/records.js"></script>   <!-- different on each page -->
```

## I want to change…

| I want to… | Edit |
|-----------|------|
| Change a color | `css/base.css` (the `:root` list at the top) |
| Change how a table / card / button looks | the matching file in `css/` |
| Add or rename a sidebar menu item | `MENU_ITEMS` in `js/ui.js` |
| Add a column to a table | the `<thead>` in the page's `.html` **and** the row function in its `.js` |
| Change the inspection checklist | `CHECKLIST_ITEMS` in `js/pages/inspection.js` |
| Change what status a tool gets after return / inspection | `js/config.js` |
| Set the inspector's name automatically | `currentUser` in `js/config.js` |
| Change a badge color for a status | `STATUS_COLORS` in `js/ui.js` |

## Adding a new page

1. Copy an existing page (e.g. `availability.html`) to `reports.html`.
2. Change `<body data-page="reports">`, the `<title>` and the page content.
3. Create `js/pages/reports.js` and point the last `<script>` tag at it.
4. Add `{ page: "reports", file: "reports.html", icon: "📊", label: "Reports" }` to `MENU_ITEMS` in `js/ui.js`.

## Adding your database

**Only `js/database.js` needs to change.** The pages never touch storage directly;
they call functions such as `getTools()` or `borrowTool(...)`.

Rewrite what is *inside* each function so it calls your server, and keep the
name, the inputs and the return value the same. For example:

```js
// Before (localStorage)
async function getTools() {
  return readDatabase().tools.sort(sortOldestFirst);
}

// After (your server)
async function getTools() {
  const response = await fetch("/api/tools");
  return response.json();
}

// Functions that can be refused should throw an Error with a friendly message.
// The pages show that message in a toast.
async function addTool(tool) {
  const response = await fetch("/api/tools", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(tool),
  });
  if (!response.ok) throw new Error((await response.json()).message);
}
```

### Functions to replace, and a suggested API

| Function in `database.js` | Suggested endpoint | Returns |
|---|---|---|
| `getTools()` | `GET /api/tools` | list of tools |
| `addTool(tool)` | `POST /api/tools` | — |
| `updateTool(id, changes)` | `PUT /api/tools/:id` | — |
| `deleteTool(id)` | `DELETE /api/tools/:id` | — |
| `getBorrows()` | `GET /api/borrows` | list, newest first |
| `getActiveBorrows()` | `GET /api/borrows?status=Active` | list |
| `borrowTool(toolId, form)` | `POST /api/borrows` | the updated tool |
| `returnTool(borrowId, form)` | `POST /api/borrows/:id/return` | the updated tool |
| `getInspections()` | `GET /api/inspections` | list, newest first |
| `saveInspection(toolId, form)` | `POST /api/inspections` | the updated tool |
| `getMaintenanceRecords()` | `GET /api/maintenance` | list, newest first |
| `addMaintenanceRecord(record)` | `POST /api/maintenance` | — |
| `completeMaintenance(id)` | `POST /api/maintenance/:id/complete` | the maintenance record |
| `getToolHistory(toolId)` | `GET /api/tools/:id/history` | `{ borrows, inspections, maintenance }` |

### Suggested tables

They mirror the lists in `js/seed-data.js`: `tools`, `borrows`, `inspections`, `maintenance`.
Each record there is one row; each field is one column.

### Things to move to the server

- **Multi-step changes** — `borrowTool`, `returnTool`, `saveInspection`, `addMaintenanceRecord`
  and `completeMaintenance` each change two records at once (e.g. create a borrow record
  *and* set the tool to "Borrowed"). Do these inside one database transaction.
- **Rules** — the checks (tool must be Available, return date not before borrow date, a
  borrowed tool cannot be deleted) and the status rules in `js/config.js` should be enforced
  on the server too, because anyone can bypass the browser.
- **IDs** — let the database generate `PT-001`, `BR-001`... instead of `nextId()`.
- **Foreign keys** — `toolId` in `borrows`, `inspections` and `maintenance` should reference
  `tools.id`, so a tool with history can't be deleted by accident.
- **Cleanup** — when done, delete `seed-data.js` and its `<script>` tags, and remove the
  `readDatabase` / `writeDatabase` functions.
