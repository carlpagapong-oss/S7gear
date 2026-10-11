# S7Gear backend

The API uses the existing MySQL database configured in `src/.env`. Keep
`DB_NAME` set to the exact database you already use (`S7gear` in the current
configuration). The backend does not create another database or new tables.

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
IDs to the frontend while storing the existing numeric foreign keys. Existing
records are retained; deleting a tool with history is rejected.

There is no public registration endpoint. Accounts must already exist in
`users`. To set or reset a user's password securely, run from `src`:

```sh
python hash_password.py
```

The script updates the password hash for an existing username; it does not
create users. Borrowers and inspectors are selected from active `users`.
Maintenance actions are stored in `maintenance_records.parts_replaced`, the
closest corresponding action field in the current schema.

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
| PUT, DELETE | `/api/tools/<tool_code>` | Update or delete a tool |
| GET | `/api/tools/<tool_code>/history` | Read a tool's history |
| GET, POST | `/api/borrows` | List or borrow tools; `?status=Active` filters active items |
| POST | `/api/borrows/<BR-id>/return` | Return a borrowed item |
| GET, POST | `/api/inspections` | List or save inspections |
| GET, POST | `/api/maintenance` | List or add maintenance records |
| POST | `/api/maintenance/<MNT-id>/complete` | Complete a maintenance record |

The existing maintenance table has no next-service date field, so the frontend
does not collect one. Inspection records continue to use their existing
`next_inspection_date` column if maintained through the database.

Uploaded tool pictures are stored in `backend/uploads/tool-images` and are
excluded from source control.
