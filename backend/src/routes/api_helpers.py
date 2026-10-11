import re
from datetime import date, datetime
from functools import wraps

import mysql.connector
from flask import jsonify

from db import get_connected


def database_errors(handler):
    @wraps(handler)
    def wrapped(*args, **kwargs):
        try:
            return handler(*args, **kwargs)
        except mysql.connector.IntegrityError as error:
            print("Database integrity error:", error)
            return jsonify({"message": "The record conflicts with existing data."}), 409
        except mysql.connector.Error as error:
            print("Database request failed:", error)
            return jsonify({"message": "Database request failed."}), 500

    return wrapped


def open_connection():
    connection = get_connected()
    if connection is None:
        return None, (jsonify({"message": "Database unavailable."}), 500)
    return connection, None


def json_object(data):
    if not isinstance(data, dict):
        return None
    return data


def missing_fields(data, *fields):
    return [field for field in fields if data.get(field) is None or data.get(field) == ""]


def parse_record_id(value, prefix):
    match = re.fullmatch(rf"{re.escape(prefix)}-(\d+)", str(value))
    return int(match.group(1)) if match else None


def format_record_id(prefix, value):
    return f"{prefix}-{int(value):03d}"


def iso_value(value, include_time=False):
    if value is None:
        return ""
    if isinstance(value, datetime):
        return value.strftime("%Y-%m-%d %H:%M" if include_time else "%Y-%m-%d")
    if isinstance(value, date):
        return value.isoformat()
    return str(value)


def tool_json(row):
    if row is None:
        return None
    return {
        "id": row["tool_code"],
        "type": row["type"],
        "brand": row.get("brand") or "",
        "model": row.get("model") or "",
        "category": row["category"],
        "power": row["power"],
        "imagePath": row["image_path"] or "",
        "condition": row["condition"],
        "status": row["status"],
        "lastInspection": iso_value(row["last_inspection"]),
    }


def borrow_json(row):
    return {
        "id": format_record_id("BR", row["borrowing_item_id"]),
        "toolId": row["tool_id"],
        "employeeId": row["employee_id"],
        "borrower": row["employee_name"],
        "borrowDate": iso_value(row["borrow_date"], include_time=True),
        "expected": iso_value(row["expected"]),
        "actual": iso_value(row["actual"]),
        "condReturned": row["cond_returned"] or "",
        "status": row["status"],
        "purpose": row["purpose"] or "",
        "remarks": row["remarks"] or "",
    }


def inspection_json(row):
    return {
        "id": format_record_id("INS", row["inspection_id"]),
        "toolId": row["tool_id"],
        "inspectorId": row["inspector_id"],
        "date": iso_value(row["inspection_date"]),
        "inspector": row["inspector_name"],
        "result": row["result"],
        "condition": row["condition"],
        "findings": row["findings"] or "",
        "remarks": row["remarks"] or "",
    }


def maintenance_json(row):
    return {
        "id": format_record_id("MNT", row["maintenance_id"]),
        "toolId": row["tool_id"],
        "date": iso_value(row["maintenance_date"]),
        "type": row["maintenance_type"],
        "issue": row["issue"],
        "action": row["action"],
        "status": row["status"],
        "next": iso_value(row["next"]),
    }
