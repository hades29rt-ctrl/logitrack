import asyncpg
from fastapi import APIRouter
from pydantic import BaseModel

router = APIRouter(prefix="/fournisseurs", tags=["Fournisseurs"])

DB_CONFIG = {
    "host": "localhost",
    "port": 5432,
    "user": "logitrack_user",
    "password": "logitrack_2024!",
    "database": "logitrack"
}

class FournisseurSchema(BaseModel):
    code: str
    raison_sociale: str
    adresse: str = ""
    code_postal: str = ""
    ville: str = ""
    pays: str = "France"
    telephone: str = ""
    email: str = ""
    delai_livraison_jours: int = 3

class FournisseurUpdateSchema(BaseModel):
    raison_sociale: str = ""
    adresse: str = ""
    code_postal: str = ""
    ville: str = ""
    pays: str = ""
    telephone: str = ""
    email: str = ""
    delai_livraison_jours: int = 0
    actif: bool = True

@router.get("/")
async def get_fournisseurs():
    conn = await asyncpg.connect(**DB_CONFIG)
    try:
        rows = await conn.fetch("""
            SELECT id, code, raison_sociale, ville, pays,
                   telephone, email, delai_livraison_jours, actif
            FROM logitrack.fournisseurs
            ORDER BY code
        """)
        return [dict(r) for r in rows]
    finally:
        await conn.close()

@router.get("/{fournisseur_id}")
async def get_fournisseur(fournisseur_id: int):
    conn = await asyncpg.connect(**DB_CONFIG)
    try:
        row = await conn.fetchrow("""
            SELECT id, code, raison_sociale, adresse, code_postal,
                   ville, pays, telephone, email, delai_livraison_jours, actif
            FROM logitrack.fournisseurs
            WHERE id = $1
        """, fournisseur_id)
        if not row:
            return {"error": "Fournisseur non trouve"}
        return dict(row)
    finally:
        await conn.close()

@router.post("/")
async def create_fournisseur(data: FournisseurSchema):
    conn = await asyncpg.connect(**DB_CONFIG)
    try:
        existing = await conn.fetchrow(
            "SELECT id FROM logitrack.fournisseurs WHERE code = $1",
            data.code
        )
        if existing:
            return {"error": f"Code {data.code} existe deja"}
        row = await conn.fetchrow("""
            INSERT INTO logitrack.fournisseurs
            (code, raison_sociale, adresse, code_postal, ville, pays,
             telephone, email, delai_livraison_jours)
            VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
            RETURNING id, code, raison_sociale
        """,
            data.code, data.raison_sociale, data.adresse,
            data.code_postal, data.ville, data.pays,
            data.telephone, data.email, data.delai_livraison_jours
        )
        return {"success": True, **dict(row)}
    finally:
        await conn.close()

@router.put("/{fournisseur_id}")
async def update_fournisseur(fournisseur_id: int, data: FournisseurUpdateSchema):
    conn = await asyncpg.connect(**DB_CONFIG)
    try:
        row = await conn.fetchrow("""
            UPDATE logitrack.fournisseurs SET
                raison_sociale        = COALESCE(NULLIF($1,''), raison_sociale),
                adresse               = COALESCE(NULLIF($2,''), adresse),
                code_postal           = COALESCE(NULLIF($3,''), code_postal),
                ville                 = COALESCE(NULLIF($4,''), ville),
                pays                  = COALESCE(NULLIF($5,''), pays),
                telephone             = COALESCE(NULLIF($6,''), telephone),
                email                 = COALESCE(NULLIF($7,''), email),
                delai_livraison_jours = CASE WHEN $8 > 0 THEN $8 ELSE delai_livraison_jours END,
                actif                 = $9,
                updated_at            = NOW()
            WHERE id = $10
            RETURNING id, code, raison_sociale, actif
        """,
            data.raison_sociale, data.adresse, data.code_postal,
            data.ville, data.pays, data.telephone, data.email,
            data.delai_livraison_jours, data.actif, fournisseur_id
        )
        if not row:
            return {"error": "Fournisseur non trouve"}
        return {"success": True, **dict(row)}
    finally:
        await conn.close()

@router.delete("/{fournisseur_id}")
async def delete_fournisseur(fournisseur_id: int):
    conn = await asyncpg.connect(**DB_CONFIG)
    try:
        row = await conn.fetchrow("""
            UPDATE logitrack.fournisseurs
            SET actif = FALSE, updated_at = NOW()
            WHERE id = $1
            RETURNING id, code
        """, fournisseur_id)
        if not row:
            return {"error": "Fournisseur non trouve"}
        return {"success": True, "message": f"Fournisseur {row['code']} desactive"}
    finally:
        await conn.close()
