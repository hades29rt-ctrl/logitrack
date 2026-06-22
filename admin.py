import asyncio
import asyncpg
import hashlib
import secrets


async def create():
    conn = await asyncpg.connect(
        host="localhost",
        port=5432,
        user="logitrack_user",
        password="logitrack_2024!",
        database="logitrack",
    )
    pwd = "adm1"
    salt = secrets.token_hex(16)
    h = hashlib.sha256(f"{salt}{pwd}".encode()).hexdigest()
    password_hash = f"{salt}:{h}"
    await conn.execute(
        "UPDATE logitrack.utilisateurs SET password_hash = $1 WHERE login = 'admin'",
        password_hash,
    )
    print("OK — Login: admin / Password: adm1")
    await conn.close()


asyncio.run(create())
