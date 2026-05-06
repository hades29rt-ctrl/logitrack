import asyncpg
from fastapi import APIRouter
from pydantic import BaseModel

router = APIRouter(prefix="/articles", tags=["Articles"])

DB_CONFIG = {
    "host": "localhost",
    "port": 5432,
    "user": "logitrack_user",
    "password": "logitrack_2024!",
    "database": "logitrack"
}

class EntreeStockSchema(BaseModel):
    reference: str
    quantite: int
    numero_lot: str = ""
    emplacement: str = ""
    motif: str = "reception_fournisseur"
    reference_bl: str = ""
    commentaire: str = ""

class SortieStockSchema(BaseModel):
    reference: str
    quantite: int
    numero_lot: str = ""
    motif: str = "expedition"
    numero_commande: str = ""
    destinataire: str = ""
    commentaire: str = ""

@router.get("/")
async def get_articles():
    conn = await asyncpg.connect(**DB_CONFIG)
    try:
        rows = await conn.fetch(
            "SELECT id, reference, designation, stock_actuel, stock_minimum, unite, statut FROM logitrack.articles ORDER BY reference"
        )
        return [dict(r) for r in rows]
    finally:
        await conn.close()

@router.post("/entree")
async def entree_stock(data: EntreeStockSchema):
    conn = await asyncpg.connect(**DB_CONFIG)
    try:
        article = await conn.fetchrow(
            "SELECT id, stock_actuel FROM logitrack.articles WHERE reference = $1",
            data.reference
        )
        if not article:
            return {"error": "Article non trouve"}

        stock_avant = article['stock_actuel']
        stock_apres = stock_avant + data.quantite

        await conn.execute(
            "UPDATE logitrack.articles SET stock_actuel = $1, updated_at = NOW() WHERE id = $2",
            stock_apres, article['id']
        )

        await conn.execute(
            """INSERT INTO logitrack.mouvements_stock
            (article_id, type_mvt, motif_entree, quantite, stock_avant, stock_apres, reference_doc, commentaire)
            VALUES ($1, 'entree', $2, $3, $4, $5, $6, $7)""",
            article['id'], data.motif, data.quantite,
            stock_avant, stock_apres, data.reference_bl, data.commentaire
        )

        return {
            "success": True,
            "reference": data.reference,
            "stock_avant": stock_avant,
            "stock_apres": stock_apres,
            "quantite_ajoutee": data.quantite
        }
    finally:
        await conn.close()

@router.post("/sortie")
async def sortie_stock(data: SortieStockSchema):
    conn = await asyncpg.connect(**DB_CONFIG)
    try:
        article = await conn.fetchrow(
            "SELECT id, stock_actuel FROM logitrack.articles WHERE reference = $1",
            data.reference
        )
        if not article:
            return {"error": "Article non trouve"}
        if data.quantite > article['stock_actuel']:
            return {"error": f"Stock insuffisant ({article['stock_actuel']} disponible)"}

        stock_avant = article['stock_actuel']
        stock_apres = stock_avant - data.quantite

        await conn.execute(
            "UPDATE logitrack.articles SET stock_actuel = $1, updated_at = NOW() WHERE id = $2",
            stock_apres, article['id']
        )

        await conn.execute(
            """INSERT INTO logitrack.mouvements_stock
            (article_id, type_mvt, motif_sortie, quantite, stock_avant, stock_apres, reference_doc, commentaire)
            VALUES ($1, 'sortie', $2, $3, $4, $5, $6, $7)""",
            article['id'], data.motif, data.quantite,
            stock_avant, stock_apres, data.numero_commande, data.commentaire
        )

        return {
            "success": True,
            "reference": data.reference,
            "stock_avant": stock_avant,
            "stock_apres": stock_apres,
            "quantite_retiree": data.quantite
        }
    finally:
        await conn.close()
