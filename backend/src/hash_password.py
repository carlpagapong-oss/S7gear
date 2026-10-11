from getpass import getpass

from werkzeug.security import generate_password_hash

from db import get_connected


def set_existing_user_password():
    username = input("Existing username: ").strip()
    password = getpass("Password: ")
    confirm_password = getpass("Confirm password: ")

    if not username or not password:
        raise ValueError("Username and password are required.")
    if password != confirm_password:
        raise ValueError("Passwords do not match.")

    connection = get_connected()
    if connection is None:
        raise RuntimeError("Cannot connect to the S7Gear database.")

    try:
        cursor = connection.cursor()
        cursor.execute(
            "SELECT user_id FROM users WHERE username = %s",
            (username,),
        )
        user = cursor.fetchone()
        if user is None:
            raise ValueError(f"User {username} does not exist.")

        cursor.execute(
            """
            UPDATE users SET password_hash = %s WHERE user_id = %s
            """,
            (generate_password_hash(password), user[0]),
        )
        connection.commit()
        print(f"Password hash updated for {username}.")
    except Exception:
        connection.rollback()
        raise
    finally:
        if "cursor" in locals():
            cursor.close()
        connection.close()


if __name__ == "__main__":
    set_existing_user_password()
