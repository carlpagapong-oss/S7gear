from flask import Blueprint, request, jsonify
from werkzeug.security import check_password_hash
from db import get_connected

login_bp = Blueprint("login", __name__)


@login_bp.route("/login", methods=["POST"])
def login():
    data = request.get_json(silent=True) or {}
    username = data.get("username")
    password = data.get("password")

    # validation
    if not username or not password:
        return jsonify({"status": "error", "message": "Missing fields"}), 400

    # connect to database
    connection = get_connected()
    if connection is None:
        return jsonify({"status": "error", "message": "Database error"}), 500

    cursor = connection.cursor(dictionary=True)
    cursor.execute(
        """
        SELECT u.user_id, u.full_name, u.password_hash,
               u.account_status, r.role_name
        FROM users u
        JOIN roles r ON u.role_id = r.role_id
        WHERE u.username = %s
        """,
        (username,),
    )
    user = cursor.fetchone()
    cursor.close()
    connection.close()

    if user is None or not check_password_hash(user["password_hash"], password):
        return jsonify({"status": "error", "message": "Invalid credentials"}), 401

    if user["account_status"] != "Active":
        return jsonify({"status": "error", "message": "Account is not active"}), 403

    return jsonify({
        "status": "ok",
        "user_id": user["user_id"],
        "full_name": user["full_name"],
        "role": user["role_name"],
    })