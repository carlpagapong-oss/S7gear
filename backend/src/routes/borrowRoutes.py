from datetime import date, datetime

import mysql.connector
from flask import Blueprint, jsonify, request

from routes.api_helpers import (
    borrow_json,
    database_errors,
    json_object,
    missing_fields,
    open_connection,
    parse_record_id,
    tool_json,
)

borrows_bp = Blueprint("borrows", __name__, url_prefix="/api/borrows")
STATUS_AFTER_RETURN = {
    "Good": "Available",
    "Fair": "Under Inspection",
    "Damaged": "Under Maintenance",
    "Unsafe": "Unsafe",
}

BORROW_SELECT = """
    SELECT bi.borrowing_item_id, t.tool_code AS tool_id,
           b.borrower_id AS employee_id,
           COALESCE(b.borrower_name, u.full_name) AS employee_name,
           b.borrowed_at AS borrow_date, b.expected_return_at AS expected,
           bi.returned_at AS actual,
           bi.condition_when_returned AS cond_returned,
           IF(bi.returned_at IS NULL, 'Active', 'Returned') AS status,
           b.purpose, CONCAT_WS(' | ', b.remarks, bi.remarks) AS remarks
    FROM borrowing_items bi
    JOIN borrowings b ON b.borrowing_id = bi.borrowing_id
    LEFT JOIN users u ON u.user_id = b.borrower_id
    JOIN tools t ON t.tool_id = bi.tool_id
"""


@borrows_bp.route("", methods=["GET"])
@database_errors
def get_borrows():
    status = request.args.get("status")
    if status and status not in ("Active", "Returned"):
        return jsonify({"message": "Unsupported borrowing status."}), 400

    connection, error = open_connection()
    if error:
        return error
    try:
        cursor = connection.cursor(dictionary=True)
        query = BORROW_SELECT
        if status == "Active":
            query += " WHERE bi.returned_at IS NULL"
        elif status == "Returned":
            query += " WHERE bi.returned_at IS NOT NULL"
        query += " ORDER BY bi.borrowing_item_id DESC"
        cursor.execute(query)
        return jsonify([borrow_json(row) for row in cursor.fetchall()])
    finally:
        if "cursor" in locals():
            cursor.close()
        connection.close()


@borrows_bp.route("", methods=["POST"])
@database_errors
def borrow_tool():
    data = json_object(request.get_json(silent=True))
    if data is None or missing_fields(
        data, "toolId", "borrowerName", "date", "time", "expected", "purpose"
    ):
        return jsonify({"message": "Complete all required borrowing fields."}), 400
    if not isinstance(data["borrowerName"], str) or not data["borrowerName"].strip():
        return jsonify({"message": "Enter a borrower name."}), 400
    borrower_name = data["borrowerName"].strip()
    if len(borrower_name) > 255:
        return jsonify({"message": "Borrower name must be 255 characters or fewer."}), 400
    try:
        borrowed_at = datetime.strptime(
            f"{data['date']} {data['time']}", "%Y-%m-%d %H:%M"
        )
        expected_return = date.fromisoformat(data["expected"])
    except (TypeError, ValueError):
        return jsonify({"message": "Enter valid borrower and borrowing details."}), 400
    if expected_return < borrowed_at.date():
        return jsonify({"message": "Return date must be after borrow date."}), 400

    connection, error = open_connection()
    if error:
        return error
    try:
        connection.start_transaction()
        cursor = connection.cursor(dictionary=True)
        cursor.execute(
            "SELECT * FROM tools WHERE tool_code = %s FOR UPDATE",
            (data["toolId"],),
        )
        tool = cursor.fetchone()
        if tool is None or tool["current_status"] != "Available":
            connection.rollback()
            return jsonify({"message": "Select an available tool first."}), 409
        cursor.execute(
            """
            INSERT INTO borrowings
              (borrower_id, borrower_name, borrowed_at, expected_return_at, status, purpose, remarks)
            VALUES (NULL, %s, %s, %s, 'Borrowed', %s, %s)
            """,
            (
                borrower_name,
                borrowed_at,
                expected_return,
                data["purpose"],
                data.get("remarks") or None,
            ),
        )
        borrowing_id = cursor.lastrowid
        cursor.execute(
            """
            INSERT INTO borrowing_items
              (borrowing_id, tool_id, condition_when_borrowed, remarks)
            VALUES (%s, %s, %s, %s)
            """,
            (
                borrowing_id,
                tool["tool_id"],
                tool["current_condition"],
                data.get("remarks") or None,
            ),
        )
        cursor.execute(
            "UPDATE tools SET current_status = 'Borrowed' WHERE tool_id = %s",
            (tool["tool_id"],),
        )
        cursor.execute(
            """
            SELECT t.tool_id AS id, t.tool_code, t.tool_type AS type,
                   c.category_name AS category, t.power_type AS power,
                   t.image_path, t.current_condition AS `condition`,
                   t.current_status AS status,
                   (SELECT MAX(si.inspection_date)
                    FROM safety_inspections si WHERE si.tool_id = t.tool_id) AS last_inspection
            FROM tools t JOIN tool_categories c ON c.category_id = t.category_id
            WHERE t.tool_id = %s
            """,
            (tool["tool_id"],),
        )
        updated_tool = cursor.fetchone()
        connection.commit()
        updated_tool["id"] = data["toolId"]
        return jsonify(tool_json(updated_tool)), 201
    except mysql.connector.Error:
        connection.rollback()
        raise
    finally:
        if "cursor" in locals():
            cursor.close()
        connection.close()


@borrows_bp.route("/<borrow_id>/return", methods=["POST"])
@database_errors
def return_tool(borrow_id):
    item_id = parse_record_id(borrow_id, "BR")
    if item_id is None:
        return jsonify({"message": f"Borrowing {borrow_id} not found."}), 404
    data = json_object(request.get_json(silent=True))
    if data is None or missing_fields(data, "date", "condition"):
        return jsonify({"message": "Return date and condition are required."}), 400
    if data["condition"] not in STATUS_AFTER_RETURN:
        return jsonify({"message": "Select a valid return condition."}), 400
    try:
        returned_at = datetime.strptime(
            f"{data['date']} {data.get('time') or '00:00'}", "%Y-%m-%d %H:%M"
        )
    except (TypeError, ValueError):
        return jsonify({"message": "Enter a valid return date and time."}), 400

    connection, error = open_connection()
    if error:
        return error
    try:
        connection.start_transaction()
        cursor = connection.cursor(dictionary=True)
        cursor.execute(
            """
            SELECT bi.*, b.borrowed_at, b.borrowing_id, t.tool_code, t.tool_id
            FROM borrowing_items bi
            JOIN borrowings b ON b.borrowing_id = bi.borrowing_id
            JOIN tools t ON t.tool_id = bi.tool_id
            WHERE bi.borrowing_item_id = %s
            FOR UPDATE
            """,
            (item_id,),
        )
        item = cursor.fetchone()
        if item is None:
            connection.rollback()
            return jsonify({"message": f"Borrowing {borrow_id} not found."}), 404
        if item["returned_at"] is not None:
            connection.rollback()
            return jsonify({"message": "This tool was already returned."}), 409
        if returned_at.date() < item["borrowed_at"].date():
            connection.rollback()
            return jsonify({"message": "Return date cannot be before the borrow date."}), 400

        remarks = " | ".join(
            value for value in (item["remarks"], data.get("remarks", "")) if value
        )
        cursor.execute(
            """
            UPDATE borrowing_items
            SET returned_at = %s, condition_when_returned = %s, remarks = %s
            WHERE borrowing_item_id = %s
            """,
            (returned_at, data["condition"], remarks, item_id),
        )
        cursor.execute(
            "UPDATE tools SET current_condition = %s, current_status = %s WHERE tool_id = %s",
            (
                data["condition"],
                STATUS_AFTER_RETURN[data["condition"]],
                item["tool_id"],
            ),
        )
        cursor.execute(
            """
            SELECT COUNT(*) AS active_items
            FROM borrowing_items
            WHERE borrowing_id = %s AND returned_at IS NULL
            """,
            (item["borrowing_id"],),
        )
        if cursor.fetchone()["active_items"] == 0:
            cursor.execute(
                "UPDATE borrowings SET status = 'Returned' WHERE borrowing_id = %s",
                (item["borrowing_id"],),
            )
        cursor.execute(
            """
            SELECT t.tool_id AS id, t.tool_code, t.tool_type AS type,
                   c.category_name AS category, t.power_type AS power,
                   t.image_path, t.current_condition AS `condition`,
                   t.current_status AS status,
                   (SELECT MAX(si.inspection_date)
                    FROM safety_inspections si WHERE si.tool_id = t.tool_id) AS last_inspection
            FROM tools t JOIN tool_categories c ON c.category_id = t.category_id
            WHERE t.tool_id = %s
            """,
            (item["tool_id"],),
        )
        updated_tool = cursor.fetchone()
        updated_tool["id"] = item["tool_code"]
        connection.commit()
        return jsonify(tool_json(updated_tool))
    except mysql.connector.Error:
        connection.rollback()
        raise
    finally:
        if "cursor" in locals():
            cursor.close()
        connection.close()
