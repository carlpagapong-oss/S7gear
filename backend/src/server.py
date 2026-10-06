from flask import Flask, jsonify
from flask_cors import CORS
from db import get_connected

app = Flask(__name__)
CORS(app)




@app.route("/")
def home():
    return "S7Gear backend is running"





if __name__ == "__main__":
    print("Checking databse...")
    test_connection = get_connected()
    if test_connection: 
        test_connection.close()
    app.run(debug=True)