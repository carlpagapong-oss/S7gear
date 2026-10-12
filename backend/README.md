# S7Gear backend

The API uses the existing MySQL database configured in `src/.env`. Keep
`DB_NAME` set to the exact database you already use (`S7gear` in the current
configuration). The backend does not create another database. Apply the
documented migrations to add or update feature-specific schema in that database.

The API is adapted to the existing tables shown in the database:

| API data | Existing MySQL tables |
|---|---|
| Login and roles | `users`, `roles` |
| Employee choices | Active rows from `users` (`full_name` and `user_id`) |
| Tools and categories | `tools`, `tool_categories` |
| Borrowing history | `borrowings`, `borrowing_items` |
| Inspections | `safety_inspections` |
| Maintenance | `maintenance_records` |

The existing schema uses numeric primary keys for tools, borrowing items,
inspections, and maintenance. The API exposes tool codes and formatted record
IDs to the frontend while storing the existing numeric foreign keys. Deleting a
tool permanently removes its borrowing, inspection, and maintenance history.
Tools with an active borrowing cannot be deleted.

There is no public registration endpoint. Accounts must already exist in
`users`. The borrowing form accepts a free-form borrower name, including
people who are not registered users. Before using that feature, apply
`migrations/20261011_allow_external_borrower_names.sql` to the existing
database. It backfills names for existing borrowings and makes `borrower_id`
optional for new ones. To set or reset a user's password securely, run from `src`:

The backend creates the `inspection_schedules` table automatically when first
used. The application database user must have permission to create tables; if
it does not, apply `migrations/20261012_add_inspection_schedules.sql` manually.
Apply `migrations/20261012_allow_unsafe_tool_status.sql` to the same database
so tools that cannot be repaired can be marked Unsafe.
Apply `migrations/20261012_remove_unused_empty_columns.sql` to remove obsolete,
empty schema fields that are not used by the application. It removes
`tools.archived_at`, `borrowings.processed_by`,
`safety_inspections.next_inspection_date`, and
`maintenance_records.reported_by` and `maintenance_records.cost`.
Inspections are tracked against scheduled date ranges, so no changes to the
existing `safety_inspections` table are required. A tool can be inspected once
per scheduled period and becomes due again when the next scheduled date arrives. Existing
inspection records remain in history. Inspection results are `Passed` or
`Needs Maintenance`; the latter creates a pending `Inspection Follow-up`
record and puts the tool under maintenance. Completing maintenance returns the
tool to Available. A tool that cannot be repaired is recorded as Unrepairable
and marked Unsafe.

```sh
python hash_password.py
```

The script updates the password hash for an existing username; it does not
create users. Inspectors are selected from active `users`.
Maintenance actions are stored in `maintenance_records.parts_replaced`, the
closest corresponding action field in the current schema.

The login API issues an in-memory bearer session for frontend API requests.
Sessions are cleared when the backend restarts. Safety Officer accounts are
limited to tool listing, inspections, maintenance, and sign-out; their frontend
navigation opens a dedicated safety dashboard. Other roles retain the general
tool-management navigation, except Tool Manager accounts do not have access to
the safety inspection or maintenance pages and APIs.

Start Flask from `backend/src`:

```sh
python server.py
```

The frontend API base URL is `http://127.0.0.1:5000/api`.

| Method | Endpoint | Purpose |
|---|---|---|
| POST | `/login` | Sign in with an existing user account |
| GET | `/api/employees` | List active users for borrower/inspector selection |
| GET, POST | `/api/tools` | List or add tools |
| POST | `/api/tools/images` | Upload a PNG, JPEG, GIF, or WebP tool picture (5 MB max) |
| GET | `/api/tools/images/<filename>` | Read an uploaded tool picture |
| PUT, DELETE | `/api/tools/<tool_code>` | Update or permanently delete a tool and its history |
| GET | `/api/tools/<tool_code>/history` | Read a tool's history |
| GET, POST | `/api/borrows` | List or borrow tools; `?status=Active` filters active items |
| POST | `/api/borrows/<BR-id>/return` | Return a borrowed item |
| GET, POST | `/api/inspections` | List or save inspections |
| GET, POST | `/api/inspections/schedule` | Read or set the next inspection cycle date |
| GET, POST | `/api/maintenance` | List or add maintenance records |
| POST | `/api/maintenance/<MNT-id>/complete` | Complete a maintenance record and return the tool to Available |
| POST | `/api/maintenance/<MNT-id>/unrepairable` | Close a maintenance record as unrepairable and mark the tool Unsafe |

The existing maintenance table has no next-service date field, so the frontend
does not collect one. Inspection schedule dates are stored in the separate
`inspection_schedules` table.

Uploaded tool pictures are stored in `backend/uploads/tool-images` and are
excluded from source control.
