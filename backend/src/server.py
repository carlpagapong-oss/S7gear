from flask import Flask
from flask_cors import CORS
from db import get_connected
from routes.loginRoute import login_bp

app = Flask(__name__)
CORS(app)

# Routes
app.register_blueprint(login_bp)


@app.route("/")
def home():
    return "S7Gear backend is running"


if __name__ == "__main__":
    print("Checking database...")
    test_connection = get_connected()
    if test_connection:
        test_connection.close()

    app.run(debug=True)