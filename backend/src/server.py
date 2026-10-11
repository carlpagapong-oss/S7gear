import re

from flask import Flask
from flask import g, jsonify, request
from flask_cors import CORS
from auth_sessions import delete_session, get_session
from db import get_connected
from routes.borrowRoutes import borrows_bp
from routes.employeeRoutes import employees_bp
from routes.inspectionRoutes import inspections_bp
from routes.loginRoute import login_bp
from routes.maintenanceRoutes import maintenance_bp
from routes.toolRoutes import tools_bp

app = Flask(__name__)
CORS(app)

SAFETY_OFFICER_ROLE = "safety officer"
TOOL_MANAGER_ROLE = "tool manager"


def safety_officer_can_access(path, method):
    if path == "/api/tools" and method == "GET":
        return True
    if path == "/api/inspections" and method in ("GET", "POST"):
        return True
    if path == "/api/maintenance" and method in ("GET", "POST"):
        return True
    return (
        method == "POST"
        and re.fullmatch(r"/api/maintenance/MNT-\d+/complete", path) is not None
    )


@app.before_request
def authorize_api_request():
    if not request.path.startswith("/api/") or request.method == "OPTIONS":
        return None

    if request.method == "GET" and request.path.startswith("/api/tools/images/"):
        return None

    authorization = request.headers.get("Authorization", "")
    scheme, _, token = authorization.partition(" ")
    session = get_session(token) if scheme.lower() == "bearer" and token else None
    if session is None:
        return jsonify({"message": "Sign in to access this resource."}), 401

    g.current_user = session
    if (
        session["role"].strip().lower() == TOOL_MANAGER_ROLE
    ):
        if request.path == "/api/inspections":
            return jsonify({"message": "Tool Managers are not allowed to access safety inspections."}), 403
        if request.path == "/api/maintenance" or request.path.startswith("/api/maintenance/"):
            return jsonify({"message": "Tool Managers are not allowed to access maintenance."}), 403

    if (
        session["role"].strip().lower() == SAFETY_OFFICER_ROLE
        and not (
            safety_officer_can_access(request.path, request.method)
            or (request.path == "/api/session" and request.method == "DELETE")
        )
    ):
        return jsonify({"message": "Your role is not allowed to access this resource."}), 403
    return None


@app.route("/api/session", methods=["DELETE"])
def logout():
    authorization = request.headers.get("Authorization", "")
    _, _, token = authorization.partition(" ")
    delete_session(token)
    return jsonify({"message": "Signed out."})


app.register_blueprint(login_bp)
app.register_blueprint(tools_bp)
app.register_blueprint(employees_bp)
app.register_blueprint(borrows_bp)
app.register_blueprint(inspections_bp)
app.register_blueprint(maintenance_bp)


@app.route("/")
def home():
    return "S7Gear backend is running"


if __name__ == "__main__":
    print("Checking database...")
    test_connection = get_connected()
    if test_connection:
        test_connection.close()

    app.run(debug=True)