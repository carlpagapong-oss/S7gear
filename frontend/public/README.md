# S7Gear — Power Tool Management System

Plain HTML + CSS + JavaScript. No frameworks, no build step.

## Folder structure

```
S7Gear/
├── index.html              redirects to pages/home.html
├── pages/                  HTML (structure)
│   ├── home.html  records.html  borrow.html
│   └── inspection.html  availability.html  history.html
├── style/                  CSS (looks)
│   ├── style.css           ← the only file pages link; it imports the rest
│   └── base / layout / components / forms / tables / cards / responsive .css
└── script/                 JavaScript (behavior, ES modules)
    ├── config.js           settings + business rules
    ├── helpers.js          small utilities (dates, ids, escaping...)
    ├── seed-data.js        sample data for the first run
    ├── database.js         ★ ALL data reading/saving happens here ★
    ├── ui/                 shared interface pieces
    │   ├── layout.js       initLayout() — call once per page
    │   ├── sidebar.js      MENU_ITEMS + sidebar
    │   ├── toast.js  modal.js  badges.js  tool-table.js
    └── pages/              one script per page (home, records, borrow, ...)
```

## How to run

Scripts are ES modules, so open the folder with a local server (VS Code
**Live Server**, or `python -m http.server` and visit `http://localhost:8000`).
Double-clicking the HTML files will not work.

## How each page is built

Every page follows the same three-part pattern:

| Part | File | What it contains |
|------|------|------------------|
| Structure | `pages/records.html` | The page layout, tables, forms and pop-ups (modals) |
| Looks | `style/*.css` | Colors, spacing, fonts |
| Behavior | `script/pages/records.js` | Loads data, fills the tables, handles buttons and forms |

The HTML holds the fixed structure. The page's JavaScript only fills in the
changing parts (table rows, numbers, lists) and reacts to clicks.

Every page loads one module, which imports what it needs:

```html
<script type="module" src="../script/pages/records.js"></script>
```

## I want to change…

| I want to… | Edit |
|-----------|------|
| Change a color | `style/base.css` (the `:root` list at the top) |
| Change how a table / card / button looks | the matching file in `style/` |
| Add or rename a sidebar menu item | `MENU_ITEMS` in `script/ui/sidebar.js` |
| Add a column to a table | the `<thead>` in the page's `.html` **and** the row function in its `.js` |
| Change the inspection checklist | `CHECKLIST_ITEMS` in `script/pages/inspection.js` |
| Change what status a tool gets after return / inspection | `script/config.js` |
| Set the inspector's name automatically | `currentUser` in `script/config.js` |
| Change a badge color for a status | `STATUS_COLORS` in `script/ui/sidebar.js` |

## Adding a new page

1. Copy a page (e.g. `pages/availability.html`) to `pages/reports.html`.
2. Change `<body data-page="reports">`, the `<title>` and the page content.
3. Create `script/pages/reports.js` and point the last `<script>` tag at it.
4. Add `{ page: "reports", file: "reports.html", icon: "📊", label: "Reports" }` to `MENU_ITEMS` in `script/ui/sidebar.js`.

## Adding your database

**Only `script/database.js` needs to change.** The pages never touch storage directly;
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

They mirror the lists in `script/seed-data.js`: `tools`, `borrows`, `inspections`, `maintenance`.
Each record there is one row; each field is one column.

### Things to move to the server

- **Multi-step changes** — `borrowTool`, `returnTool`, `saveInspection`, `addMaintenanceRecord`
  and `completeMaintenance` each change two records at once (e.g. create a borrow record
  *and* set the tool to "Borrowed"). Do these inside one database transaction.
- **Rules** — the checks (tool must be Available, return date not before borrow date, a
  borrowed tool cannot be deleted) and the status rules in `script/config.js` should be enforced
  on the server too, because anyone can bypass the browser.
- **IDs** — let the database generate `PT-001`, `BR-001`... instead of `nextId()`.
- **Foreign keys** — `toolId` in `borrows`, `inspections` and `maintenance` should reference
  `tools.id`, so a tool with history can't be deleted by accident.
- **Cleanup** — when done, delete `seed-data.js` and its `<script>` tags, and remove the
  `readDatabase` / `writeDatabase` functions.
