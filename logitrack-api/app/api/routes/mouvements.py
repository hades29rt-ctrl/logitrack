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
        conditions = ["1=1"]
        params = []

        if type_mvt:
            params.append(type_mvt)
            conditions.append(f"m.type_mvt = ${len(params)}")

        if reference:
            params.append(reference)
            conditions.append(f"a.reference = ${len(params)}")

        if date_debut:
            params.append(date_debut)
            conditions.append(f"m.created_at >= (${len(params)}::text)::timestamptz")

        if date_fin:
            params.append(date_fin + " 23:59:59")
            conditions.append(f"m.created_at <= (${len(params)}::text)::timestamptz")

        where = " AND ".join(conditions)

        query = f"""
            SELECT
                m.id, m.type_mvt, m.motif_entree, m.motif_sortie,
                m.quantite, m.stock_avant, m.stock_apres,
                m.reference_doc, m.commentaire, m.operateur,
                m.created_at,
                a.reference, a.designation
            FROM logitrack.mouvements_stock m
            JOIN logitrack.articles a ON a.id = m.article_id
            WHERE {where}
            ORDER BY m.created_at DESC
            LIMIT {limit}
        """

        rows = await conn.fetch(query, *params)
        return [dict(r) for r in rows]
    finally:
        await conn.close()


@router.get("/stats/evolution")
async def get_evolution_stock(jours: int = 30):
    conn = await asyncpg.connect(**DB_CONFIG)
    try:
        rows = await conn.fetch(f"""
            SELECT
                m.created_at::date AS jour,
                SUM(CASE WHEN m.type_mvt = 'entree' THEN m.quantite ELSE 0 END) AS total_entrees,
                SUM(CASE WHEN m.type_mvt = 'sortie' THEN m.quantite ELSE 0 END) AS total_sorties
            FROM logitrack.mouvements_stock m
            WHERE m.created_at >= NOW() - INTERVAL '{jours} days'
            GROUP BY m.created_at::date
            ORDER BY jour
        """)
        return [dict(r) for r in rows]
    finally:
        await conn.close()


@router.get("/stats/top-articles")
async def get_top_articles(limit: int = 10):
    conn = await asyncpg.connect(**DB_CONFIG)
    try:
        rows = await conn.fetch(f"""
            SELECT
                a.reference,
                a.designation,
                COUNT(m.id) AS nb_mouvements,
                SUM(m.quantite) AS total_quantite,
                SUM(CASE WHEN m.type_mvt = 'entree' THEN m.quantite ELSE 0 END) AS total_entrees,
                SUM(CASE WHEN m.type_mvt = 'sortie' THEN m.quantite ELSE 0 END) AS total_sorties
            FROM logitrack.mouvements_stock m
            JOIN logitrack.articles a ON a.id = m.article_id
            WHERE m.created_at >= NOW() - INTERVAL '30 days'
            GROUP BY a.id, a.reference, a.designation
            ORDER BY nb_mouvements DESC
            LIMIT {limit}
        """)
        return [dict(r) for r in rows]
    finally:
        await conn.close()
