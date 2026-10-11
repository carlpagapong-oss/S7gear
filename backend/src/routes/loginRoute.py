from flask import Blueprint, jsonify, request
from werkzeug.security import check_password_hash

from auth_sessions import create_session
from routes.api_helpers import database_errors, open_connection

login_bp = Blueprint("login", __name__)


@login_bp.route("/login", methods=["POST"])
@database_errors
def login():
    data = request.get_json(silent=True)
    if not isinstance(data, dict):
        return jsonify({"status": "error", "message": "Username and password are required."}), 400
    username = data.get("username", "")
    password = data.get("password", "")
    if not isinstance(username, str) or not isinstance(password, str):
        return jsonify({"status": "error", "message": "Username and password must be text."}), 400
    username = username.strip()

    if not username:
        return jsonify({"status": "error", "message": "Username is missing."}), 400
    if not password:
        return jsonify({"status": "error", "message": "Password is missing."}), 400

    connection, error = open_connection()
    if error:
        return jsonify({"status": "error", "message": "Database unavailable."}), 500
    try:
        cursor = connection.cursor(dictionary=True)
        cursor.execute(
            """
            SELECT u.user_id, u.user_id AS employee_id, u.username,
                   u.password_hash, u.full_name AS employee_name,
                   u.account_status, r.role_name
            FROM users u
            JOIN roles r ON r.role_id = u.role_id
            WHERE u.username = %s
            """,
            (username,),
        )
        user = cursor.fetchone()
    finally:
        if "cursor" in locals():
            cursor.close()
        connection.close()

    if user is None or not check_password_hash(user["password_hash"], password):
        return jsonify({"status": "error", "message": "Invalid credentials."}), 401
    if user["account_status"] != "Active":
        return jsonify({"status": "error", "message": "Account is not active."}), 403

    return jsonify({
        "status": "ok",
        "user_id": user["user_id"],
        "employee_id": user["employee_id"],
        "employee_name": user["employee_name"],
        "username": user["username"],
        "role": user["role_name"],
        "token": create_session(user["user_id"], user["role_name"]),
    })
