from datetime import date

import mysql.connector
from flask import Blueprint, g, jsonify, request

from routes.api_helpers import (
    database_errors,
    inspection_json,
    json_object,
    missing_fields,
    open_connection,
    tool_json,
)

inspections_bp = Blueprint("inspections", __name__, url_prefix="/api/inspections")
STATUS_AFTER_INSPECTION = {
    "Passed": "Available",
    "Needs Maintenance": "Under Maintenance",
    "Failed / Unsafe": "Unsafe",
}


@inspections_bp.route("", methods=["GET"])
@database_errors
def get_inspections():
    connection, error = open_connection()
    if error:
        return error
    try:
        cursor = connection.cursor(dictionary=True)
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
            JOIN tools t ON t.tool_id = si.tool_id
            JOIN users u ON u.user_id = si.inspector_id
            ORDER BY si.inspection_id DESC
            """
        )
        return jsonify([inspection_json(row) for row in cursor.fetchall()])
    finally:
        if "cursor" in locals():
            cursor.close()
        connection.close()


@inspections_bp.route("", methods=["POST"])
@database_errors
def save_inspection():
    data = json_object(request.get_json(silent=True))
    is_safety_officer = g.current_user["role"].strip().lower() == "safety officer"
    required_fields = ["toolId", "date", "result"]
    if not is_safety_officer:
        required_fields.append("inspectorId")
    if data is None or missing_fields(data, *required_fields):
        return jsonify({"message": "Complete all required inspection fields."}), 400
    if data["result"] not in STATUS_AFTER_INSPECTION:
        return jsonify({"message": "Select a valid inspection result."}), 400
    try:
        inspector_id = (
            g.current_user["user_id"]
            if is_safety_officer
            else int(data["inspectorId"])
        )
        inspection_date = date.fromisoformat(data["date"])
    except (TypeError, ValueError):
        return jsonify({"message": "Enter a valid inspector and inspection date."}), 400

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
        if tool is None:
            connection.rollback()
            return jsonify({"message": f"Tool {data['toolId']} not found."}), 404
        if tool["current_status"] == "Borrowed":
            connection.rollback()
            return jsonify({"message": "Tool is currently borrowed."}), 409
        cursor.execute(
            """
            SELECT user_id FROM users
            WHERE user_id = %s AND account_status = 'Active'
            """,
            (inspector_id,),
        )
        if cursor.fetchone() is None:
            connection.rollback()
            return jsonify({"message": "Select an active inspector."}), 400

        condition = tool["current_condition"]
        was_bad = condition in ("Damaged", "Unsafe")
        if data["result"] == "Passed" and was_bad:
            condition = "Good"
        elif data["result"] == "Needs Maintenance":
            condition = "Damaged"
        elif data["result"] == "Failed / Unsafe":
            condition = "Unsafe"

        database_result = (
            "Failed" if data["result"] == "Failed / Unsafe" else data["result"]
        )
        cursor.execute(
            """
            INSERT INTO safety_inspections
              (tool_id, inspector_id, inspection_date, result, condition_found,
               findings, corrective_action, remarks)
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
            """,
            (
                tool["tool_id"],
                inspector_id,
                inspection_date,
                database_result,
                condition,
                data.get("findings", ""),
                None,
                data.get("remarks", ""),
            ),
        )
        cursor.execute(
            """
            UPDATE tools SET current_status = %s, current_condition = %s
            WHERE tool_id = %s
            """,
            (
                STATUS_AFTER_INSPECTION[data["result"]],
                condition,
                tool["tool_id"],
            ),
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
