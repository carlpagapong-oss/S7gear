# S7Gear — Power Tool Management System

Plain HTML, CSS, and JavaScript with an Electron shell.

## Folder structure

```
frontend/
├── main.js                 Electron entry point
└── public/
    ├── pages/              HTML structure
    ├── Style/              CSS
    └── Script/
        ├── config.js       Frontend settings
        ├── helpers.js      Shared UI/data utilities
        ├── database.js     Compatibility exports for page modules
        ├── api/            Backend API calls, grouped by resource
        ├── ui/             Shared interface components
        └── pages/          One behavior module per page
```

## Running the app

The page scripts are ES modules. Run the pages through Electron or a local
server; opening HTML files directly will not load their module imports.

## How each page is built

Each page has three parts:

| Part | Folder | What it contains |
|---|---|---|
| Structure | `pages/` | Tables, forms, and modals |
| Looks | `Style/` | Colors, spacing, and component styles |
| Behavior | `Script/pages/` | Loads data and handles user actions |

The page modules import data functions from `Script/database.js`. That file
only re-exports functions; the actual HTTP requests are separated by resource
under `Script/api/`.

## Data API modules

| File | Responsibility |
|---|---|
| `Script/api/client.js` | API base URL, JSON requests, and API errors |
| `Script/api/tools.api.js` | Tool list, add, update, and delete |
| `Script/api/borrows.api.js` | Borrowing and returning tools |
| `Script/api/employees.api.js` | Employee choices for borrowing and inspections |
| `Script/api/inspections.api.js` | Safety inspections |
| `Script/api/maintenance.api.js` | Maintenance records |
| `Script/api/history.api.js` | A tool's combined history |

The API base URL is currently `http://127.0.0.1:5000/api`, configured in
`Script/api/client.js`. The Flask endpoints are in the `backend/` folder and
are adapted to the existing MySQL tables. Follow `backend/README.md` to start
the server. Add tools through the Records page or use the inventory already
stored in the database.

Multi-record operations (borrow, return, inspection, and maintenance changes)
are handled in backend transactions. The backend is the source of truth for
availability checks, status transitions, and generated borrowing, inspection,
and maintenance IDs.

## I want to change…

| I want to… | Edit |
|---|---|
| Change a color | `Style/base.css` |
| Change how a table, card, or button looks | The matching file in `Style/` |
| Add or rename a sidebar menu item | `Script/ui/sidebar.js` |
| Add a column to a table | The page's HTML and its matching row-rendering function |
| Change the inspection checklist | `Script/pages/inspection.js` |
| Change inspector defaults | `Script/config.js` |
| Change API request behavior | `Script/api/client.js` or the resource API module |
