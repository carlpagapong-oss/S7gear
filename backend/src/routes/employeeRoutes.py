from flask import Blueprint, jsonify

from routes.api_helpers import database_errors, open_connection

employees_bp = Blueprint("employees", __name__, url_prefix="/api/employees")


@employees_bp.route("", methods=["GET"])
@database_errors
def get_employees():
    connection, error = open_connection()
    if error:
        return error
    try:
        cursor = connection.cursor(dictionary=True)
        cursor.execute(
            """
            SELECT user_id, full_name
            FROM users
            WHERE account_status = 'Active'
            ORDER BY full_name
            """
        )
        return jsonify([
            {"id": row["user_id"], "name": row["full_name"]}
            for row in cursor.fetchall()
        ])
    finally:
        if "cursor" in locals():
            cursor.close()
        connection.close()
