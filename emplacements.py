import asyncpg
from fastapi import APIRouter
from pydantic import BaseModel

router = APIRouter(prefix="/emplacements", tags=["Emplacements"])

DB_CONFIG = {
    "host": "localhost",
    "port": 5432,
    "user": "logitrack_user",
    "password": "logitrack_2024!",
    "database": "logitrack"
}

class TransfertSchema(BaseModel):
    code_palette: str
    code_destination: str

class AffectationSchema(BaseModel):
    code_emplacement: str
    numero_lot: str
    article_reference: str
    quantite: int

@router.get("/")
async def get_emplacements():
    conn = await asyncpg.connect(**DB_CONFIG)
    try:
        rows = await conn.fetch("""
            SELECT
                e.id, e.code, e.allee, e.rangee, e.niveau,
                e.statut, e.capacite_max,
                a.reference   AS article_ref,
                a.designation AS article_designation,
                l.numero_lot,
                l.quantite    AS quantite_lot,
                l.id          AS lot_id
            FROM logitrack.emplacements e
            LEFT JOIN logitrack.articles a ON a.id = e.article_id
            LEFT JOIN logitrack.lots l ON l.emplacement_id = e.id AND l.quantite > 0
            ORDER BY e.allee, e.rangee, e.niveau
        """)
        return [dict(r) for r in rows]
    finally:
        await conn.close()

@router.get("/libres")
async def get_emplacements_libres():
    conn = await asyncpg.connect(**DB_CONFIG)
    try:
        rows = await conn.fetch("""
            SELECT id, code, allee, rangee, niveau
            FROM logitrack.emplacements
            WHERE statut = 'libre'
            ORDER BY allee, rangee, niveau
        """)
        return [dict(r) for r in rows]
    finally:
        await conn.close()

@router.get("/scan/{code}")
async def scan_emplacement(code: str):
    conn = await asyncpg.connect(**DB_CONFIG)
    try:
        emp = await conn.fetchrow("""
            SELECT
                e.id, e.code, e.allee, e.rangee, e.statut,
                a.reference AS article_ref,
                a.designation AS article_designation,
                l.numero_lot, l.quantite AS quantite_lot, l.id AS lot_id
            FROM logitrack.emplacements e
            LEFT JOIN logitrack.articles a ON a.id = e.article_id
            LEFT JOIN logitrack.lots l ON l.emplacement_id = e.id AND l.quantite > 0
            WHERE e.code = $1
        """, code.upper())

        if not emp:
            return {"error": f"Emplacement {code} non trouve", "type": "emplacement_inconnu"}

        return {
            "type": "emplacement",
            "id": emp['id'],
            "code": emp['code'],
            "allee": emp['allee'],
            "statut": emp['statut'],
            "article_ref": emp['article_ref'],
            "article_designation": emp['article_designation'],
            "numero_lot": emp['numero_lot'],
            "quantite_lot": emp['quantite_lot'],
            "lot_id": emp['lot_id']
        }
    finally:
        await conn.close()

@router.post("/transfert")
async def transfert_palette(data: TransfertSchema):
    conn = await asyncpg.connect(**DB_CONFIG)
    try:
        lot = await conn.fetchrow("""
            SELECT l.id, l.numero_lot, l.article_id, l.emplacement_id,
                   l.quantite, a.reference, a.designation,
                   e.code AS emplacement_actuel
            FROM logitrack.lots l
            JOIN logitrack.articles a ON a.id = l.article_id
            LEFT JOIN logitrack.emplacements e ON e.id = l.emplacement_id
            WHERE l.numero_lot = $1 OR l.sscc = $1
        """, data.code_palette)

        if not lot:
            return {"error": f"Palette {data.code_palette} non trouvee"}

        dest = await conn.fetchrow("""
            SELECT id, code, statut
            FROM logitrack.emplacements
            WHERE code = $1
        """, data.code_destination.upper())

        if not dest:
            return {"error": f"Emplacement {data.code_destination} non trouve"}

        if dest['statut'] == 'occupe':
            return {
                "error": f"Emplacement {data.code_destination} est deja occupe",
                "type": "emplacement_occupe"
            }

        if dest['statut'] == 'bloque':
            return {
                "error": f"Emplacement {data.code_destination} est bloque",
                "type": "emplacement_bloque"
            }

        emplacement_precedent = lot['emplacement_actuel']

        if lot['emplacement_id']:
            await conn.execute("""
                UPDATE logitrack.emplacements
                SET statut = 'libre', article_id = NULL, updated_at = NOW()
                WHERE id = $1
            """, lot['emplacement_id'])

        await conn.execute("""
            UPDATE logitrack.emplacements
            SET statut = 'occupe', article_id = $1, updated_at = NOW()
            WHERE id = $2
        """, lot['article_id'], dest['id'])

        await conn.execute("""
            UPDATE logitrack.lots
            SET emplacement_id = $1, updated_at = NOW()
            WHERE id = $2
        """, dest['id'], lot['id'])

        return {
            "success": True,
            "palette": data.code_palette,
            "article": lot['reference'],
            "designation": lot['designation'],
            "quantite": lot['quantite'],
            "emplacement_precedent": emplacement_precedent,
            "emplacement_destination": data.code_destination.upper()
        }
    finally:
        await conn.close()

@router.post("/affecter")
async def affecter_palette(data: AffectationSchema):
    conn = await asyncpg.connect(**DB_CONFIG)
    try:
        emp = await conn.fetchrow("""
            SELECT id, statut FROM logitrack.emplacements WHERE code = $1
        """, data.code_emplacement.upper())

        if not emp:
            return {"error": f"Emplacement {data.code_emplacement} non trouve"}

        if emp['statut'] == 'occupe':
            return {"error": f"Emplacement {data.code_emplacement} deja occupe"}

        article = await conn.fetchrow("""
            SELECT id FROM logitrack.articles WHERE reference = $1
        """, data.article_reference)

        if not article:
            return {"error": f"Article {data.article_reference} non trouve"}

        lot = await conn.fetchrow("""
            SELECT id FROM logitrack.lots WHERE numero_lot = $1
        """, data.numero_lot)

        if lot:
            await conn.execute("""
                UPDATE logitrack.lots
                SET emplacement_id = $1, updated_at = NOW()
                WHERE id = $2
            """, emp['id'], lot['id'])
        else:
            await conn.execute("""
                INSERT INTO logitrack.lots (numero_lot, article_id, emplacement_id, quantite)
                VALUES ($1, $2, $3, $4)
            """, data.numero_lot, article['id'], emp['id'], data.quantite)

        await conn.execute("""
            UPDATE logitrack.emplacements
            SET statut = 'occupe', article_id = $1, updated_at = NOW()
            WHERE id = $2
        """, article['id'], emp['id'])

        return {
            "success": True,
            "emplacement": data.code_emplacement.upper(),
            "article": data.article_reference,
            "lot": data.numero_lot,
            "quantite": data.quantite
        }
    finally:
        await conn.close()
