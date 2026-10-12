from datetime import date

import mysql.connector
from flask import Blueprint, jsonify, request

from routes.api_helpers import (
    database_errors,
    json_object,
    maintenance_json,
    missing_fields,
    iso_value,
    open_connection,
    parse_record_id,
)

maintenance_bp = Blueprint("maintenance", __name__, url_prefix="/api/maintenance")
UNREPAIRABLE_REMARK = "Cannot be repaired"


@maintenance_bp.route("", methods=["GET"])
@database_errors
def get_maintenance_records():
    connection, error = open_connection()
    if error:
        return error
    try:
        cursor = connection.cursor(dictionary=True)
        cursor.execute(
            """
            SELECT mr.maintenance_id, t.tool_code AS tool_id,
                   t.tool_type AS tool_type, t.brand, t.model,
                   t.power_type AS power, t.image_path,
                   t.current_status AS tool_status,
                   c.category_name AS category,
                   t.current_condition AS tool_condition,
                   COALESCE(mr.started_at, mr.created_at) AS maintenance_date,
                   mr.maintenance_type, mr.description AS issue,
                   COALESCE(mr.parts_replaced, '') AS `action`,
                   CASE WHEN mr.remarks = %s THEN 'Unrepairable'
                        WHEN mr.maintenance_status = 'Pending'
                        THEN 'In Progress' ELSE mr.maintenance_status END AS status,
                   NULL AS next
            FROM maintenance_records mr
            JOIN tools t ON t.tool_id = mr.tool_id
            JOIN tool_categories c ON c.category_id = t.category_id
            ORDER BY mr.maintenance_id DESC
            """,
            (UNREPAIRABLE_REMARK,),
        )
        return jsonify([maintenance_json(row) for row in cursor.fetchall()])
    finally:
        if "cursor" in locals():
            cursor.close()
        connection.close()


@maintenance_bp.route("", methods=["POST"])
@database_errors
def add_maintenance_record():
    data = json_object(request.get_json(silent=True))
    if data is None or missing_fields(
        data, "toolId", "date", "type", "issue", "action", "status"
    ):
        return jsonify({"message": "Complete all required maintenance fields."}), 400
    if data["status"] not in ("In Progress", "Completed"):
        return jsonify({"message": "Select a valid maintenance status."}), 400
    try:
        maintenance_date = date.fromisoformat(data["date"])
    except (TypeError, ValueError):
        return jsonify({"message": "Enter a valid maintenance date."}), 400

    connection, error = open_connection()
    if error:
        return error
    try:
        connection.start_transaction()
        cursor = connection.cursor(dictionary=True)
        cursor.execute(
            "SELECT tool_id, current_status FROM tools WHERE tool_code = %s FOR UPDATE",
            (data["toolId"],),
        )
        tool = cursor.fetchone()
        if tool is None:
            connection.rollback()
            return jsonify({"message": f"Tool {data['toolId']} not found."}), 404

        cursor.execute(
            """
            INSERT INTO maintenance_records
              (tool_id, maintenance_type, description, maintenance_status,
               started_at, completed_at, parts_replaced, remarks)
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
            """,
            (
                tool["tool_id"],
                data["type"],
                data["issue"],
                data["status"],
                f"{data['date']} 00:00:00",
                f"{data['date']} 00:00:00" if data["status"] == "Completed" else None,
                data["action"],
                None,
            ),
        )
        if data["status"] == "In Progress" and tool["current_status"] != "Borrowed":
            cursor.execute(
                "UPDATE tools SET current_status = 'Under Maintenance' WHERE tool_id = %s",
                (tool["tool_id"],),
            )
        elif data["status"] == "Completed" and tool["current_status"] != "Borrowed":
            cursor.execute(
                """
                UPDATE tools SET current_status = 'Available'
                WHERE tool_id = %s AND current_status != 'Borrowed'
                """,
                (tool["tool_id"],),
            )
        connection.commit()
        return jsonify({"message": "Maintenance record added."}), 201
    except mysql.connector.Error:
        connection.rollback()
        raise
    finally:
        if "cursor" in locals():
            cursor.close()
        connection.close()


@maintenance_bp.route("/<maintenance_id>/complete", methods=["POST"])
@database_errors
def complete_maintenance(maintenance_id):
    if parse_record_id(maintenance_id, "MNT") is None:
        return jsonify({"message": f"Maintenance record {maintenance_id} not found."}), 404
    try:
        numeric_id = int(maintenance_id.split("-", 1)[1])
    except ValueError:
        return jsonify({"message": f"Maintenance record {maintenance_id} not found."}), 404

    connection, error = open_connection()
    if error:
        return error
    try:
        connection.start_transaction()
        cursor = connection.cursor(dictionary=True)
        cursor.execute(
            """
            SELECT mr.*, t.tool_code,
                   COALESCE(mr.started_at, mr.created_at) AS record_date
            FROM maintenance_records mr
            JOIN tools t ON t.tool_id = mr.tool_id
            WHERE mr.maintenance_id = %s FOR UPDATE
            """,
            (numeric_id,),
        )
        record = cursor.fetchone()
        if record is None:
            connection.rollback()
            return jsonify({"message": f"Maintenance record {maintenance_id} not found."}), 404
        if record["maintenance_status"] == "Completed":
            connection.rollback()
            return jsonify({"message": "This maintenance record is already completed."}), 409

        cursor.execute(
            """
            UPDATE maintenance_records
            SET maintenance_status = 'Completed', completed_at = CURRENT_TIMESTAMP
            WHERE maintenance_id = %s
            """,
            (numeric_id,),
        )
        cursor.execute(
            """
            UPDATE tools SET current_status = 'Available'
            WHERE tool_id = %s AND current_status != 'Borrowed'
            """,
            (record["tool_id"],),
        )
        connection.commit()
        return jsonify({
            "id": maintenance_id,
            "toolId": record["tool_code"],
            "date": iso_value(record["record_date"]),
            "type": record["maintenance_type"],
            "issue": record["description"],
            "action": record["parts_replaced"] or "",
            "status": "Completed",
            "next": "",
        })
    except mysql.connector.Error:
        connection.rollback()
        raise
    finally:
        if "cursor" in locals():
            cursor.close()
        connection.close()


@maintenance_bp.route("/<maintenance_id>/unrepairable", methods=["POST"])
@database_errors
def mark_maintenance_unrepairable(maintenance_id):
    if parse_record_id(maintenance_id, "MNT") is None:
        return jsonify({"message": f"Maintenance record {maintenance_id} not found."}), 404
    try:
        numeric_id = int(maintenance_id.split("-", 1)[1])
    except ValueError:
        return jsonify({"message": f"Maintenance record {maintenance_id} not found."}), 404

    connection, error = open_connection()
    if error:
        return error
    try:
        connection.start_transaction()
        cursor = connection.cursor(dictionary=True)
        cursor.execute(
            """
            SELECT mr.*, t.tool_code, t.current_status AS tool_status
            FROM maintenance_records mr
            JOIN tools t ON t.tool_id = mr.tool_id
            WHERE mr.maintenance_id = %s FOR UPDATE
            """,
            (numeric_id,),
        )
        record = cursor.fetchone()
        if record is None:
            connection.rollback()
            return jsonify({"message": f"Maintenance record {maintenance_id} not found."}), 404
        if record["maintenance_status"] == "Completed":
            connection.rollback()
            return jsonify({"message": "This maintenance record is already closed."}), 409
        if record["tool_status"] == "Borrowed":
            connection.rollback()
            return jsonify({"message": "A borrowed tool cannot be marked unrepairable."}), 409

        cursor.execute(
            """
            UPDATE maintenance_records
            SET maintenance_status = 'Completed', completed_at = CURRENT_TIMESTAMP,
                remarks = %s
            WHERE maintenance_id = %s
            """,
            (UNREPAIRABLE_REMARK, numeric_id),
        )
        cursor.execute(
            """
            UPDATE tools
            SET current_status = 'Unsafe', current_condition = 'Unsafe'
            WHERE tool_id = %s
            """,
            (record["tool_id"],),
        )
        connection.commit()
        return jsonify({
            "id": maintenance_id,
            "toolId": record["tool_code"],
            "status": "Unrepairable",
        })
    except mysql.connector.Error:
        connection.rollback()
        raise
    finally:
        if "cursor" in locals():
            cursor.close()
        connection.close()
