import mysql.connector
import os
from dotenv import load_dotenv

load_dotenv()

def get_connected():
  try:
    connection = mysql.connector.connect(
        host=os.getenv("DB_HOST"),
        user=os.getenv("DB_USER"),
        password=os.getenv("DB_PASSWORD"),
        database=os.getenv("DB_NAME")
    )

    print("Database Connected successfully")
    return connection
  
  except mysql.connector.Error as error:
    print("Database Connection failed:", error)
    return None  