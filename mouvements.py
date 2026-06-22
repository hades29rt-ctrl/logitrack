import asyncpg
from fastapi import APIRouter
from typing import Optional

router = APIRouter(prefix="/mouvements", tags=["Mouvements"])

DB_CONFIG = {
    "host": "localhost",
    "port": 5432,
    "user": "logitrack_user",
    "password": "logitrack_2024!",
    "database": "logitrack",
}


@router.get("/")
async def get_mouvements(
    type_mvt: Optional[str] = None,
    reference: Optional[str] = None,
    date_debut: Optional[str] = None,
    date_fin: Optional[str] = None,
    limit: int = 200,
):
    conn = await asyncpg.connect(**DB_CONFIG)
    try:
        query = """
            SELECT
                m.id, m.type_mvt, m.motif_entree, m.motif_sortie,
                m.quantite, m.stock_avant, m.stock_apres,
                m.reference_doc, m.commentaire, m.operateur,
                m.created_at,
                a.reference, a.designation
            FROM logitrack.mouvements_stock m
            JOIN logitrack.articles a ON a.id = m.article_id
            WHERE 1=1
        """
        params = []

        if type_mvt:
            params.append(type_mvt)
            query += f" AND m.type_mvt = ${len(params)}"

        if reference:
            params.append(reference)
            query += f" AND a.reference = ${len(params)}"

        if date_debut:
            params.append(date_debut)
            query += f" AND m.created_at::date >= ${len(params)}::date"

        if date_fin:
            params.append(date_fin)
            query += f" AND m.created_at::date <= ${len(params)}::date"

        rows = await conn.fetch(query, *params)
        return [dict(r) for r in rows]
    finally:
        await conn.close()
