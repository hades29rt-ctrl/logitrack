import asyncpg
from fastapi import APIRouter
from pydantic import BaseModel

router = APIRouter(prefix="/articles", tags=["Articles"])

DB_CONFIG = {
    "host": "127.0.0.1",
    "port": 5432,
    "user": "postgres",
    "password": "143625",
    "database": "logitrack",
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


class ArticleCreateSchema(BaseModel):
    reference: str
    designation: str
    unite: str = "piece"
    stock_minimum: int = 0
    stock_maximum: int = 0
    poids_kg: float = 0.0
    code_ean13: str = ""
    code_gtin14: str = ""
    fournisseur_id: int = 0


class ArticleUpdateSchema(BaseModel):
    designation: str = ""
    unite: str = ""
    stock_minimum: int = 0
    stock_maximum: int = 0
    poids_kg: float = 0.0
    code_ean13: str = ""
    code_gtin14: str = ""
    fournisseur_id: int = 0
    statut: str = "actif"


@router.get("/")
async def get_articles():
    conn = await asyncpg.connect(**DB_CONFIG, ssl=False)
    try:
        rows = await conn.fetch(
            """SELECT id, reference, designation, stock_actuel AS stock, stock_minimum AS stock_min,
            CASE 
                    WHEN stock_actuel <= stock_minimum THEN '⚠️ Réappro'
                    ELSE '✅ OK'
                END AS statut FROM logitrack.articles ORDER BY reference"""
        )
        return [dict(r) for r in rows]
    finally:
        await conn.close()


@router.get("/lookup/{code}")
async def lookup_article(code: str):
    conn = await asyncpg.connect(**DB_CONFIG)
    try:
        code13 = code[-13:] if len(code) >= 13 else code
        code14 = code[-14:] if len(code) >= 14 else code
        row = await conn.fetchrow(
            """
            SELECT id, reference, designation, stock_actuel, stock_minimum, unite
            FROM logitrack.articles
            WHERE reference = $1
               OR code_ean13 = $1
               OR code_gtin14 = $1
               OR code_ean13 = $2
               OR code_gtin14 = $3
        """,
            code,
            code13,
            code14,
        )
        if not row:
            return {"found": False}
        return {"found": True, **dict(row)}
    finally:
        await conn.close()


@router.post("/entree")
async def entree_stock(data: EntreeStockSchema):
    conn = await asyncpg.connect(**DB_CONFIG)
    try:
        article = await conn.fetchrow(
            "SELECT id, stock_actuel FROM logitrack.articles WHERE reference = $1",
            data.reference,
        )
        if not article:
            return {"error": "Article non trouve"}

        stock_avant = article["stock_actuel"]
        stock_apres = stock_avant + data.quantite

        await conn.execute(
            "UPDATE logitrack.articles SET stock_actuel = $1, updated_at = NOW() WHERE id = $2",
            stock_apres,
            article["id"],
        )
        await conn.execute(
            """INSERT INTO logitrack.mouvements_stock
            (article_id, type_mvt, motif_entree, quantite, stock_avant, stock_apres, reference_doc, commentaire)
            VALUES ($1, 'entree', $2, $3, $4, $5, $6, $7)""",
            article["id"],
            data.motif,
            data.quantite,
            stock_avant,
            stock_apres,
            data.reference_bl,
            data.commentaire,
        )
        return {
            "success": True,
            "reference": data.reference,
            "stock_avant": stock_avant,
            "stock_apres": stock_apres,
            "quantite_ajoutee": data.quantite,
        }
    finally:
        await conn.close()


@router.post("/sortie")
async def sortie_stock(data: SortieStockSchema):
    conn = await asyncpg.connect(**DB_CONFIG)
    try:
        article = await conn.fetchrow(
            "SELECT id, stock_actuel FROM logitrack.articles WHERE reference = $1",
            data.reference,
        )
        if not article:
            return {"error": "Article non trouve"}
        if data.quantite > article["stock_actuel"]:
            return {
                "error": f"Stock insuffisant ({article['stock_actuel']} disponible)"
            }

        stock_avant = article["stock_actuel"]
        stock_apres = stock_avant - data.quantite

        await conn.execute(
            "UPDATE logitrack.articles SET stock_actuel = $1, updated_at = NOW() WHERE id = $2",
            stock_apres,
            article["id"],
        )
        await conn.execute(
            """INSERT INTO logitrack.mouvements_stock
            (article_id, type_mvt, motif_sortie, quantite, stock_avant, stock_apres, reference_doc, commentaire)
            VALUES ($1, 'sortie', $2, $3, $4, $5, $6, $7)""",
            article["id"],
            data.motif,
            data.quantite,
            stock_avant,
            stock_apres,
            data.numero_commande,
            data.commentaire,
        )
        return {
            "success": True,
            "reference": data.reference,
            "stock_avant": stock_avant,
            "stock_apres": stock_apres,
            "quantite_retiree": data.quantite,
        }
    finally:
        await conn.close()


@router.post("/")
async def create_article(data: ArticleCreateSchema):
    conn = await asyncpg.connect(**DB_CONFIG)
    try:
        existing = await conn.fetchrow(
            "SELECT id FROM logitrack.articles WHERE reference = $1", data.reference
        )
        if existing:
            return {"error": f"Reference {data.reference} existe deja"}
        row = await conn.fetchrow(
            """
            INSERT INTO logitrack.articles
            (reference, designation, unite, stock_minimum, stock_maximum,
             poids_kg, code_ean13, code_gtin14, fournisseur_id)
            VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
            RETURNING id, reference, designation
        """,
            data.reference,
            data.designation,
            data.unite,
            data.stock_minimum,
            data.stock_maximum if data.stock_maximum > 0 else None,
            data.poids_kg if data.poids_kg > 0 else None,
            data.code_ean13 or None,
            data.code_gtin14 or None,
            data.fournisseur_id if data.fournisseur_id > 0 else None,
        )
        return {"success": True, **dict(row)}
    finally:
        await conn.close()


@router.put("/{article_id}")
async def update_article(article_id: int, data: ArticleUpdateSchema):
    conn = await asyncpg.connect(**DB_CONFIG)
    try:
        row = await conn.fetchrow(
            """
            UPDATE logitrack.articles SET
                designation    = COALESCE(NULLIF($1,''), designation),
                unite          = COALESCE(NULLIF($2,''), unite),
                stock_minimum  = $3,
                stock_maximum  = NULLIF($4, 0),
                poids_kg       = NULLIF($5::numeric, 0),
                code_ean13     = COALESCE(NULLIF($6,''), code_ean13),
                code_gtin14    = COALESCE(NULLIF($7,''), code_gtin14),
                fournisseur_id = NULLIF($8, 0),
                statut         = $9::logitrack.statut_article,
                updated_at     = NOW()
            WHERE id = $10
            RETURNING id, reference, designation, statut
        """,
            data.designation,
            data.unite,
            data.stock_minimum,
            data.stock_maximum,
            data.poids_kg,
            data.code_ean13,
            data.code_gtin14,
            data.fournisseur_id,
            data.statut,
            article_id,
        )
        if not row:
            return {"error": "Article non trouve"}
        return {"success": True, **dict(row)}
    finally:
        await conn.close()


@router.delete("/{article_id}")
async def supprimer_article(article_id: int):
    conn = await asyncpg.connect(**DB_CONFIG)
    try:
        art = await conn.fetchrow(
            "SELECT reference, stock_actuel FROM logitrack.articles WHERE id = $1",
            article_id,
        )
        if not art:
            return {"error": "Article non trouve"}
        if art["stock_actuel"] > 0:
            return {
                "error": f"Stock non vide ({art['stock_actuel']} unites) — videz le stock avant de supprimer"
            }
        await conn.execute("DELETE FROM logitrack.articles WHERE id = $1", article_id)
        return {"success": True, "message": f"Article {art['reference']} supprime"}
    finally:
        await conn.close()
