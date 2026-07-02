import asyncpg
from fastapi import APIRouter
from pydantic import BaseModel
from typing import Optional

router = APIRouter(prefix="/clients", tags=["Clients"])

DB_CONFIG = {
    "host": "localhost",
    "port": 5432,
    "user": "logitrack_user",
    "password": "logitrack_2024!",
    "database": "logitrack"
}

class ClientSchema(BaseModel):
    code: str
    raison_sociale: str
    adresse: str = ""
    code_postal: str = ""
    ville: str = ""
    pays: str = "France"
    telephone: str = ""
    email: str = ""
    logo_url: str = ""

class ClientUpdateSchema(BaseModel):
    raison_sociale: str = ""
    adresse: str = ""
    code_postal: str = ""
    ville: str = ""
    pays: str = ""
    telephone: str = ""
    email: str = ""
    logo_url: str = ""
    actif: bool = True

@router.get("/")
async def get_clients():
    conn = await asyncpg.connect(**DB_CONFIG)
    try:
        rows = await conn.fetch("""
            SELECT id, code, raison_sociale, ville, pays,
                   telephone, email, logo_url, actif
            FROM logitrack.clients
            WHERE actif = TRUE
            ORDER BY raison_sociale
        """)
        return [dict(r) for r in rows]
    finally:
        await conn.close()

@router.get("/{client_id}")
async def get_client(client_id: int):
    conn = await asyncpg.connect(**DB_CONFIG)
    try:
        row = await conn.fetchrow("""
            SELECT id, code, raison_sociale, adresse, code_postal,
                   ville, pays, telephone, email, logo_url, actif
            FROM logitrack.clients
            WHERE id = $1
        """, client_id)
        if not row:
            return {"error": "Client non trouve"}
        return dict(row)
    finally:
        await conn.close()

@router.post("/")
async def create_client(data: ClientSchema):
    conn = await asyncpg.connect(**DB_CONFIG)
    try:
        existing = await conn.fetchrow(
            "SELECT id FROM logitrack.clients WHERE code = $1",
            data.code
        )
        if existing:
            return {"error": f"Code {data.code} existe deja"}
        row = await conn.fetchrow("""
            INSERT INTO logitrack.clients
            (code, raison_sociale, adresse, code_postal, ville, pays,
             telephone, email, logo_url)
            VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
            RETURNING id, code, raison_sociale
        """,
            data.code, data.raison_sociale, data.adresse,
            data.code_postal, data.ville, data.pays,
            data.telephone, data.email, data.logo_url or None
        )
        return {"success": True, **dict(row)}
    finally:
        await conn.close()

@router.put("/{client_id}")
async def update_client(client_id: int, data: ClientUpdateSchema):
    conn = await asyncpg.connect(**DB_CONFIG)
    try:
        row = await conn.fetchrow("""
            UPDATE logitrack.clients SET
                raison_sociale = COALESCE(NULLIF($1,''), raison_sociale),
                adresse        = COALESCE(NULLIF($2,''), adresse),
                code_postal    = COALESCE(NULLIF($3,''), code_postal),
                ville          = COALESCE(NULLIF($4,''), ville),
                pays           = COALESCE(NULLIF($5,''), pays),
                telephone      = COALESCE(NULLIF($6,''), telephone),
                email          = COALESCE(NULLIF($7,''), email),
                logo_url       = COALESCE(NULLIF($8,''), logo_url),
                actif          = $9,
                updated_at     = NOW()
            WHERE id = $10
            RETURNING id, code, raison_sociale, actif
        """,
            data.raison_sociale, data.adresse, data.code_postal,
            data.ville, data.pays, data.telephone, data.email,
            data.logo_url, data.actif, client_id
        )
        if not row:
            return {"error": "Client non trouve"}
        return {"success": True, **dict(row)}
    finally:
        await conn.close()

@router.delete("/{client_id}")
async def desactiver_client(client_id: int):
    conn = await asyncpg.connect(**DB_CONFIG)
    try:
        row = await conn.fetchrow("""
            UPDATE logitrack.clients
            SET actif = FALSE, updated_at = NOW()
            WHERE id = $1
            RETURNING id, code
        """, client_id)
        if not row:
            return {"error": "Client non trouve"}
        return {"success": True, "message": f"Client {row['code']} desactive"}
    finally:
        await conn.close()
