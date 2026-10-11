from flask import Flask
from flask_cors import CORS
from db import get_connected
from routes.borrowRoutes import borrows_bp
from routes.employeeRoutes import employees_bp
from routes.inspectionRoutes import inspections_bp
from routes.loginRoute import login_bp
from routes.maintenanceRoutes import maintenance_bp
from routes.toolRoutes import tools_bp

app = Flask(__name__)
CORS(app)

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