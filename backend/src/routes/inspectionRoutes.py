from datetime import date

import mysql.connector
from flask import Blueprint, g, jsonify, request

from routes.api_helpers import (
    database_errors,
    inspection_json,
    iso_value,
    json_object,
    missing_fields,
    open_connection,
    tool_json,
)

inspections_bp = Blueprint("inspections", __name__, url_prefix="/api/inspections")
STATUS_AFTER_INSPECTION = {
    "Passed": "Available",
    "Needs Maintenance": "Under Maintenance",
}
SCHEDULE_SETUP_ERROR = (
    "The database user needs CREATE TABLE permission. Apply "
    "backend/migrations/20261012_add_inspection_schedules.sql manually."
)


def ensure_inspection_schedule_table(connection):
    cursor = connection.cursor()
    try:
        try:
            cursor.execute(
                """
                CREATE TABLE IF NOT EXISTS inspection_schedules (
                    inspection_schedule_id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
                    scheduled_date DATE NOT NULL,
                    created_by INT NOT NULL,
                    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
                    PRIMARY KEY (inspection_schedule_id),
                    KEY idx_inspection_schedules_date (scheduled_date, inspection_schedule_id)
                ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
                """
            )
        except mysql.connector.Error as error:
            if error.errno in (1044, 1142):
                return False
            raise
    finally:
        cursor.close()
    return True


def inspection_schedule_json(cursor):
    cursor.execute(
        """
        SELECT inspection_schedule_id, scheduled_date
        FROM inspection_schedules
        WHERE scheduled_date <= CURDATE()
        ORDER BY scheduled_date DESC, inspection_schedule_id DESC
        LIMIT 1
        """
    )
    current = cursor.fetchone()
    cursor.execute(
        """
        SELECT inspection_schedule_id, scheduled_date
        FROM inspection_schedules
        WHERE scheduled_date > CURDATE()
        ORDER BY scheduled_date, inspection_schedule_id
        LIMIT 1
        """
    )
    upcoming = cursor.fetchone()
    inspected_tools = []
    if current:
        cycle_end = upcoming["scheduled_date"] if upcoming else None
        cycle_end_filter = "AND si.inspection_date < %s" if cycle_end else ""
        params = [current["scheduled_date"]]
        if cycle_end:
            params.append(cycle_end)
        cursor.execute(
            f"""
            SELECT t.tool_code AS tool_id, si.inspection_date,
                   CASE WHEN si.result = 'Failed'
                              OR si.condition_found IN ('Damaged', 'Unsafe')
                        THEN 'Needs Maintenance'
                        ELSE si.result END AS result
            FROM safety_inspections si
            JOIN tools t ON t.tool_id = si.tool_id
            WHERE si.inspection_date >= %s {cycle_end_filter}
            ORDER BY si.inspection_id DESC
            """,
            tuple(params),
        )
        inspected_tools = [
            {
                "toolId": row["tool_id"],
                "date": iso_value(row["inspection_date"]),
                "result": row["result"],
            }
            for row in cursor.fetchall()
        ]

    def schedule_json(row):
        if row is None:
            return None
        return {
            "id": row["inspection_schedule_id"],
            "date": iso_value(row["scheduled_date"]),
        }

    return {
        "current": schedule_json(current),
        "upcoming": schedule_json(upcoming),
        "inspections": inspected_tools,
    }


@inspections_bp.route("/schedule", methods=["GET"])
@database_errors
def get_inspection_schedule():
    connection, error = open_connection()
    if error:
        return error
    try:
        if not ensure_inspection_schedule_table(connection):
            return jsonify({"message": SCHEDULE_SETUP_ERROR}), 500
        cursor = connection.cursor(dictionary=True)
        return jsonify(inspection_schedule_json(cursor))
    finally:
        if "cursor" in locals():
            cursor.close()
        connection.close()


@inspections_bp.route("/schedule", methods=["POST"])
@database_errors
def save_inspection_schedule():
    if g.current_user["role"].strip().lower() != "safety officer":
        return jsonify({"message": "Only Safety Officers can schedule inspection cycles."}), 403
    data = json_object(request.get_json(silent=True))
    if data is None or missing_fields(data, "date"):
        return jsonify({"message": "Choose an inspection date."}), 400
    try:
        scheduled_date = date.fromisoformat(data["date"])
    except (TypeError, ValueError):
        return jsonify({"message": "Enter a valid inspection date."}), 400
    if scheduled_date < date.today():
        return jsonify({"message": "Inspection dates cannot be in the past."}), 400

    connection, error = open_connection()
    if error:
        return error
    try:
        if not ensure_inspection_schedule_table(connection):
            return jsonify({"message": SCHEDULE_SETUP_ERROR}), 500
        connection.start_transaction()
        cursor = connection.cursor(dictionary=True)
        cursor.execute(
            """
            SELECT inspection_schedule_id
            FROM inspection_schedules
            WHERE scheduled_date > CURDATE()
            ORDER BY scheduled_date, inspection_schedule_id
            LIMIT 1
            FOR UPDATE
            """
        )
        upcoming = cursor.fetchone()
        if upcoming:
            cursor.execute(
                """
                UPDATE inspection_schedules
                SET scheduled_date = %s, created_by = %s
                WHERE inspection_schedule_id = %s
                """,
                (
                    scheduled_date,
                    g.current_user["user_id"],
                    upcoming["inspection_schedule_id"],
                ),
            )
        else:
            cursor.execute(
                """
                INSERT INTO inspection_schedules (scheduled_date, created_by)
                VALUES (%s, %s)
                """,
                (scheduled_date, g.current_user["user_id"]),
            )
        connection.commit()
        return jsonify(inspection_schedule_json(cursor)), 201
    except mysql.connector.Error:
        connection.rollback()
        raise
    finally:
        if "cursor" in locals():
            cursor.close()
        connection.close()


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
                   CASE WHEN si.result = 'Failed'
                              OR si.condition_found IN ('Damaged', 'Unsafe')
                        THEN 'Needs Maintenance'
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
        if not ensure_inspection_schedule_table(connection):
            return jsonify({"message": SCHEDULE_SETUP_ERROR}), 500
        connection.start_transaction()
        cursor = connection.cursor(dictionary=True)
        cursor.execute(
            """
            SELECT inspection_schedule_id, scheduled_date
            FROM inspection_schedules
            WHERE scheduled_date <= CURDATE()
            ORDER BY scheduled_date DESC, inspection_schedule_id DESC
            LIMIT 1
            FOR UPDATE
            """
        )
        active_schedule = cursor.fetchone()
        if active_schedule is None:
            connection.rollback()
            return jsonify({"message": "Schedule an inspection date before inspecting tools."}), 409
        if inspection_date < active_schedule["scheduled_date"]:
            connection.rollback()
            return jsonify({"message": "The inspection date is before the active inspection schedule."}), 409
        cursor.execute(
            """
            SELECT scheduled_date
            FROM inspection_schedules
            WHERE scheduled_date > CURDATE()
            ORDER BY scheduled_date, inspection_schedule_id
            LIMIT 1
            """
        )
        upcoming_schedule = cursor.fetchone()
        if upcoming_schedule and inspection_date >= upcoming_schedule["scheduled_date"]:
            connection.rollback()
            return jsonify({"message": "The inspection date falls on or after the next scheduled cycle."}), 409
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
        cycle_end = upcoming_schedule["scheduled_date"] if upcoming_schedule else None
        cycle_end_filter = "AND inspection_date < %s" if cycle_end else ""
        inspection_params = [tool["tool_id"], active_schedule["scheduled_date"]]
        if cycle_end:
            inspection_params.append(cycle_end)
        cursor.execute(
            f"""
            SELECT inspection_id FROM safety_inspections
            WHERE tool_id = %s AND inspection_date >= %s {cycle_end_filter}
            LIMIT 1
            """,
            tuple(inspection_params),
        )
        if cursor.fetchone():
            connection.rollback()
            return jsonify({"message": "This tool is already inspected in the active cycle."}), 409
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

        database_result = "Passed"
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
        if data["result"] == "Needs Maintenance":
            findings = data.get("findings", "")
            issue = (
                findings.strip()
                if isinstance(findings, str) and findings.strip()
                else "Maintenance required based on safety inspection."
            )
            action = data.get("remarks", "")
            if not isinstance(action, str) or not action.strip():
                action = "Maintenance action required."
            cursor.execute(
                """
                INSERT INTO maintenance_records
                  (tool_id, maintenance_type, description, maintenance_status,
                   started_at, completed_at, parts_replaced, remarks)
                VALUES (%s, %s, %s, 'Pending', %s, NULL, %s, NULL)
                """,
                (
                    tool["tool_id"],
                    "Inspection Follow-up",
                    issue,
                    f"{inspection_date.isoformat()} 00:00:00",
                    action.strip(),
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
