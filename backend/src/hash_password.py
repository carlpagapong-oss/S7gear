from werkzeug.security import generate_password_hash
from db import get_connected

conn = get_connected()
cursor = conn.cursor(dictionary=True)

cursor.execute("SELECT user_id, password_hash FROM users")
users = cursor.fetchall()

for u in users:
    # skip ones that are already hashed
    if u["password_hash"].startswith(("scrypt:", "pbkdf2:")):
        continue

    hashed = generate_password_hash(u["password_hash"])
    cursor.execute(
        "UPDATE users SET password_hash = %s WHERE user_id = %s",
        (hashed, u["user_id"]),
    )

conn.commit()
cursor.close()
conn.close()
print("Done")