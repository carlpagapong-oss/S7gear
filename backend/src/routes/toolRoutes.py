import re
from datetime import date

from flask import Blueprint, jsonify, request

from routes.api_helpers import (
    borrow_json,
    database_errors,
    inspection_json,
    maintenance_json,
    open_connection,
    tool_json,
)

tools_bp = Blueprint("tools", __name__, url_prefix="/api/tools")
TOOL_ID_PATTERN = re.compile(r"^PT-\d{3,}$")
TOOL_FIELDS = {
    "type": "tool_type",
    "power": "power_type",
    "imagePath": "image_path",
    "condition": "current_condition",
    "status": "current_status",
}
TOOL_STATUSES = {
    "Available",
    "Borrowed",
    "Under Maintenance",
    "Under Inspection",
    "Unsafe",
}
TOOL_CONDITIONS = {"New", "Good", "Fair", "Damaged", "Unsafe"}

TOOL_SELECT = """
    SELECT t.tool_id AS id, t.tool_code, t.tool_type AS type,
           c.category_name AS category, t.power_type AS power,
           t.image_path, t.current_condition AS `condition`,
           t.current_status AS status,
           (
             SELECT MAX(si.inspection_date)
             FROM safety_inspections si
             WHERE si.tool_id = t.tool_id
           ) AS last_inspection
    FROM tools t
    JOIN tool_categories c ON c.category_id = t.category_id
"""


def validate_tool_values(changes):
    if "type" in changes and not isinstance(changes["type"], str):
        return "Tool type must be text."
    if "category" in changes and not isinstance(changes["category"], str):
        return "Tool category must be text."
    if "imagePath" in changes and not isinstance(changes["imagePath"], str):
        return "Image path must be text."
    if "imagePath" in changes and len(changes["imagePath"]) > 500:
        return "Image path must be 500 characters or fewer."
    if "power" in changes and changes["power"] not in ("Corded", "Cordless"):
        return "Select a valid power type."
    if "condition" in changes and changes["condition"] not in TOOL_CONDITIONS:
        return "Select a valid tool condition."
    if "status" in changes and changes["status"] not in TOOL_STATUSES:
        return "Select a valid tool status."
    return None


@tools_bp.route("", methods=["GET"])
@database_errors
def get_tools():
    connection, error = open_connection()
    if error:
        return error
    try:
        cursor = connection.cursor(dictionary=True)
        cursor.execute(TOOL_SELECT + " ORDER BY t.tool_id")
        return jsonify([tool_json(row) for row in cursor.fetchall()])
    finally:
        if "cursor" in locals():
            cursor.close()
        connection.close()


@tools_bp.route("", methods=["POST"])
@database_errors
def add_tool():
    data = request.get_json(silent=True)
    if not isinstance(data, dict):
        return jsonify({"message": "A tool object is required."}), 400
    required = ("id", "type", "category", "power", "condition")
    if any(not data.get(field) for field in required):
        return jsonify({"message": "Complete all required tool fields."}), 400
    if not isinstance(data["id"], str) or not TOOL_ID_PATTERN.fullmatch(data["id"]):
        return jsonify({"message": "Tool ID must look like PT-001."}), 400
    validation_error = validate_tool_values(data)
    if validation_error:
        return jsonify({"message": validation_error}), 400

    connection, error = open_connection()
    if error:
        return error
    try:
        cursor = connection.cursor(dictionary=True)
        cursor.execute(
            "SELECT category_id FROM tool_categories WHERE category_name = %s",
            (data["category"].strip(),),
        )
        category = cursor.fetchone()
        if category is None:
            return jsonify({"message": "Select a category that exists in Tool Categories."}), 400

        cursor.execute(
            """
            INSERT INTO tools
              (tool_code, category_id, tool_type, power_type, image_path,
               current_status, current_condition)
            VALUES (%s, %s, %s, %s, %s, %s, %s)
            """,
            (
                data["id"].upper(),
                category["category_id"],
                data["type"].strip(),
                data["power"],
                data.get("imagePath") or None,
                data.get("status", "Available"),
                data["condition"],
            ),
        )
        connection.commit()
        cursor.execute(TOOL_SELECT + " WHERE t.tool_code = %s", (data["id"].upper(),))
        return jsonify(tool_json(cursor.fetchone())), 201
    finally:
        if "cursor" in locals():
            cursor.close()
        connection.close()


@tools_bp.route("/<tool_code>", methods=["PUT"])
@database_errors
def update_tool(tool_code):
    data = request.get_json(silent=True)
    if not isinstance(data, dict):
        return jsonify({"message": "A tool update object is required."}), 400
    changes = {key: value for key, value in data.items() if key in (*TOOL_FIELDS, "category", "lastInspection")}
    if not changes:
        return jsonify({"message": "No supported tool fields were supplied."}), 400
    validation_error = validate_tool_values(changes)
    if validation_error:
        return jsonify({"message": validation_error}), 400
    if changes.get("lastInspection"):
        try:
            date.fromisoformat(changes["lastInspection"])
        except (TypeError, ValueError):
            return jsonify({"message": "Enter a valid last inspection date."}), 400

    connection, error = open_connection()
    if error:
        return error
    try:
        cursor = connection.cursor(dictionary=True)
        cursor.execute(
            "SELECT tool_id, current_status FROM tools WHERE tool_code = %s FOR UPDATE",
            (tool_code,),
        )
        tool = cursor.fetchone()
        if tool is None:
            return jsonify({"message": f"Tool {tool_code} not found."}), 404
        if changes.get("status") == "Borrowed" and tool["current_status"] != "Borrowed":
            return jsonify({"message": "Use the borrowing workflow to mark a tool borrowed."}), 409
        if (
            "status" in changes
            and tool["current_status"] == "Borrowed"
            and changes["status"] != "Borrowed"
        ):
            return jsonify({"message": "Return this tool before changing its status."}), 409

        assignments = []
        values = []
        for key, value in changes.items():
            if key == "category":
                cursor.execute(
                    "SELECT category_id FROM tool_categories WHERE category_name = %s",
                    (value.strip(),),
                )
                category = cursor.fetchone()
                if category is None:
                    return jsonify({"message": "Select a category that exists in Tool Categories."}), 400
                assignments.append("category_id = %s")
                values.append(category["category_id"])
            elif key == "lastInspection":
                return jsonify({"message": "Inspection dates are set by saving an inspection."}), 400
            else:
                assignments.append(f"{TOOL_FIELDS[key]} = %s")
                values.append(value or None if key == "imagePath" else value)

        cursor.execute(
            f"UPDATE tools SET {', '.join(assignments)} WHERE tool_id = %s",
            (*values, tool["tool_id"]),
        )
        connection.commit()
        cursor.execute(TOOL_SELECT + " WHERE t.tool_id = %s", (tool["tool_id"],))
        return jsonify(tool_json(cursor.fetchone()))
    finally:
        if "cursor" in locals():
            cursor.close()
        connection.close()


@tools_bp.route("/<tool_code>", methods=["DELETE"])
@database_errors
def delete_tool(tool_code):
    connection, error = open_connection()
    if error:
        return error
    try:
        cursor = connection.cursor(dictionary=True)
        cursor.execute(
            "SELECT tool_id, current_status FROM tools WHERE tool_code = %s FOR UPDATE",
            (tool_code,),
        )
        tool = cursor.fetchone()
        if tool is None:
            return jsonify({"message": f"Tool {tool_code} not found."}), 404
        if tool["current_status"] == "Borrowed":
            return jsonify({"message": "Cannot delete a borrowed tool."}), 409

        cursor.execute(
            """
            SELECT
              (SELECT COUNT(*) FROM borrowing_items WHERE tool_id = %s) +
              (SELECT COUNT(*) FROM safety_inspections WHERE tool_id = %s) +
              (SELECT COUNT(*) FROM maintenance_records WHERE tool_id = %s) AS history_count
            """,
            (tool["tool_id"], tool["tool_id"], tool["tool_id"]),
        )
        if cursor.fetchone()["history_count"]:
            return jsonify({"message": "Cannot delete a tool that has history."}), 409

        cursor.execute("DELETE FROM tools WHERE tool_id = %s", (tool["tool_id"],))
        connection.commit()
        return "", 204
    finally:
        if "cursor" in locals():
            cursor.close()
        connection.close()


@tools_bp.route("/<tool_code>/history", methods=["GET"])
@database_errors
def get_tool_history(tool_code):
    connection, error = open_connection()
    if error:
        return error
    try:
        cursor = connection.cursor(dictionary=True)
        cursor.execute("SELECT tool_id FROM tools WHERE tool_code = %s", (tool_code,))
        tool = cursor.fetchone()
        if tool is None:
            return jsonify({"message": f"Tool {tool_code} not found."}), 404
        tool_id = tool["tool_id"]

        cursor.execute(
            """
            SELECT bi.borrowing_item_id, t.tool_code AS tool_id,
                   b.borrower_id AS employee_id, u.full_name AS employee_name,
                   b.borrowed_at AS borrow_date, b.expected_return_at AS expected,
                   bi.returned_at AS actual,
                   bi.condition_when_returned AS cond_returned,
                   IF(bi.returned_at IS NULL, 'Active', 'Returned') AS status,
                   b.purpose, CONCAT_WS(' | ', b.remarks, bi.remarks) AS remarks
            FROM borrowing_items bi
            JOIN borrowings b ON b.borrowing_id = bi.borrowing_id
            JOIN users u ON u.user_id = b.borrower_id
            JOIN tools t ON t.tool_id = bi.tool_id
            WHERE bi.tool_id = %s
            ORDER BY bi.borrowing_item_id DESC
            """,
            (tool_id,),
        )
        borrows = cursor.fetchall()
        cursor.execute(
            """
            SELECT si.inspection_id, t.tool_code AS tool_id,
                   si.inspector_id, u.full_name AS inspector_name,
                   si.inspection_date,
                   CASE WHEN si.result = 'Failed' THEN 'Failed / Unsafe'
                        ELSE si.result END AS result,
                   si.condition_found AS `condition`, si.findings,
                   CONCAT_WS(' | ', si.corrective_action, si.remarks) AS remarks
            FROM safety_inspections si
            JOIN users u ON u.user_id = si.inspector_id
            JOIN tools t ON t.tool_id = si.tool_id
            WHERE si.tool_id = %s
            ORDER BY si.inspection_id DESC
            """,
            (tool_id,),
        )
        inspections = cursor.fetchall()
        cursor.execute(
            """
            SELECT mr.maintenance_id, t.tool_code AS tool_id,
                   COALESCE(mr.started_at, mr.created_at) AS maintenance_date,
                   mr.maintenance_type, mr.description AS issue,
                   COALESCE(mr.parts_replaced, '') AS `action`,
                   CASE WHEN mr.maintenance_status = 'Pending'
                        THEN 'In Progress' ELSE mr.maintenance_status END AS status,
                   NULL AS next
            FROM maintenance_records mr
            JOIN tools t ON t.tool_id = mr.tool_id
            WHERE mr.tool_id = %s
            ORDER BY mr.maintenance_id DESC
            """,
            (tool_id,),
        )
        maintenance = cursor.fetchall()
        return jsonify({
            "borrows": [borrow_json(row) for row in borrows],
            "inspections": [inspection_json(row) for row in inspections],
            "maintenance": [maintenance_json(row) for row in maintenance],
        })
    finally:
        if "cursor" in locals():
            cursor.close()
        connection.close()
