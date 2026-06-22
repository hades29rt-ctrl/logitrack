import asyncpg
from fastapi import APIRouter
from pydantic import BaseModel
from typing import Optional, List
from datetime import date

router = APIRouter(prefix="/expedition", tags=["Expedition"])

DB_CONFIG = {
    "host": "localhost",
    "port": 5432,
    "user": "logitrack_user",
    "password": "logitrack_2024!",
    "database": "logitrack"
}

class LigneBLSchema(BaseModel):
    emplacement: str
    poids_reel: float = 0.0

class CreerBLSchema(BaseModel):
    numero_cmd: str
    client_id: int
    transporteur: str = ""
    priorite: str = "normal"
    commentaire: str = ""
    lignes: List[LigneBLSchema] = []

class AjouterLigneSchema(BaseModel):
    bl_id: int
    emplacement: str
    poids_reel: float = 0.0
    quantité_expedition: int = 0

@router.get("/bls")
async def get_bls():
    conn = await asyncpg.connect(**DB_CONFIG)
    try:
        rows = await conn.fetch("""
            SELECT
                ce.id, ce.numero_cmd, ce.statut,
                ce.transporteur, ce.priorite,
                ce.nb_palettes, ce.poids_total,
                ce.date_expedition, ce.created_at,
                c.raison_sociale AS client_nom,
                c.ville AS client_ville
            FROM logitrack.commandes_expedition ce
            LEFT JOIN logitrack.clients c ON c.id = ce.client_id
            ORDER BY ce.created_at DESC
            LIMIT 50
        """)
        return [dict(r) for r in rows]
    finally:
        await conn.close()

@router.get("/bls/{bl_id}")
async def get_bl(bl_id: int):
    conn = await asyncpg.connect(**DB_CONFIG)
    try:
        bl = await conn.fetchrow("""
            SELECT
                ce.id, ce.numero_cmd, ce.statut,
                ce.transporteur, ce.priorite,
                ce.nb_palettes, ce.poids_total,
                ce.date_expedition, ce.created_at,
                ce.commentaire,
                c.id AS client_id,
                c.raison_sociale AS client_nom,
                c.adresse AS client_adresse,
                c.code_postal AS client_cp,
                c.ville AS client_ville,
                c.pays AS client_pays,
                c.logo_url AS client_logo
            FROM logitrack.commandes_expedition ce
            LEFT JOIN logitrack.clients c ON c.id = ce.client_id
            WHERE ce.id = $1
        """, bl_id)

        if not bl:
            return {"error": "BL non trouve"}

        lignes = await conn.fetch("""
            SELECT
                le.id, le.article_id, le.quantite,
                le.poids_reel, le.numero_lot, le.emplacement,
                a.reference AS article_ref,
                a.designation AS article_designation,
                a.poids_kg AS poids_unitaire
            FROM logitrack.lignes_expedition le
            JOIN logitrack.articles a ON a.id = le.article_id
            WHERE le.commande_id = $1
            ORDER BY le.numero_lot, le.id
        """, bl_id)

        return {
            **dict(bl),
            "lignes": [dict(l) for l in lignes]
        }
    finally:
        await conn.close()

@router.post("/scan")
async def scan_palette(data: AjouterLigneSchema):
    conn = await asyncpg.connect(**DB_CONFIG)
    try:
        emp = await conn.fetchrow("""
            SELECT
                e.id AS emp_id, e.code, e.statut, e.article_id,
                a.reference, a.designation, a.poids_kg,
                l.id AS lot_id, l.numero_lot, l.quantite AS lot_quantite,
                l.date_entree
            FROM logitrack.emplacements e
            LEFT JOIN logitrack.articles a ON a.id = e.article_id
            LEFT JOIN logitrack.lots l ON l.emplacement_id = e.id AND l.quantite > 0
            WHERE e.code = $1
        """, data.emplacement.upper())

        if not emp:
            return {"error": f"Emplacement {data.emplacement} non trouve"}

        if emp['statut'] == 'libre':
            return {"error": f"Emplacement {data.emplacement} est vide"}

        if not emp['lot_id']:
            return {"error": f"Aucun lot sur emplacement {data.emplacement}"}

        nb_palettes_lot = await conn.fetchval("""
            SELECT COUNT(*) FROM logitrack.lots
            WHERE numero_lot = $1 AND quantite > 0
        """, emp['numero_lot'])

        return {
            "success": True,
            "emplacement": emp['code'],
            "emp_id": emp['emp_id'],
            "article_ref": emp['reference'],
            "article_designation": emp['designation'],
            "lot_id": emp['lot_id'],
            "numero_lot": emp['numero_lot'],
            "quantite": emp['lot_quantite'],
            "poids_unitaire": float(emp['poids_kg'] or 0),
            "poids_reel": data.poids_reel,
            "date_entree": str(emp['date_entree']) if emp['date_entree'] else None,
            "nb_palettes_lot": nb_palettes_lot,
            "article_id": emp['article_id']
        }
    finally:
        await conn.close()

@router.post("/bls")
async def creer_bl(data: CreerBLSchema):
    conn = await asyncpg.connect(**DB_CONFIG)
    try:
        existing = await conn.fetchrow(
            "SELECT id FROM logitrack.commandes_expedition WHERE numero_cmd = $1",
            data.numero_cmd
        )
        if existing:
            return {"error": f"Numero {data.numero_cmd} existe deja"}

        bl = await conn.fetchrow("""
            INSERT INTO logitrack.commandes_expedition
            (numero_cmd, client_id, transporteur, priorite, statut,
             date_expedition, nb_palettes, poids_total)
            VALUES ($1, $2, $3, $4, 'preparation', CURRENT_DATE, 0, 0)
            RETURNING id, numero_cmd
        """,
            data.numero_cmd, data.client_id,
            data.transporteur, data.priorite
        )
        return {"success": True, "id": bl['id'], "numero_cmd": bl['numero_cmd']}
    finally:
        await conn.close()

@router.post("/bls/{bl_id}/lignes")
async def ajouter_ligne(bl_id: int, data: AjouterLigneSchema):
    conn = await asyncpg.connect(**DB_CONFIG)
    try:
        emp = await conn.fetchrow("""
            SELECT
                e.id AS emp_id, e.article_id,
                a.reference, a.designation,
                l.id AS lot_id, l.numero_lot, l.quantite
            FROM logitrack.emplacements e
            LEFT JOIN logitrack.articles a ON a.id = e.article_id
            LEFT JOIN logitrack.lots l ON l.emplacement_id = e.id AND l.quantite > 0
            WHERE e.code = $1
        """, data.emplacement.upper())

        if not emp or not emp['lot_id']:
            return {"error": f"Emplacement {data.emplacement} vide ou non trouve"}

        deja = await conn.fetchrow("""
            SELECT id FROM logitrack.lignes_expedition
            WHERE commande_id = $1 AND emplacement = $2
        """, bl_id, data.emplacement.upper())

        if deja:
            return {"error": f"Emplacement {data.emplacement} deja dans ce BL"}

        await conn.execute("""
         INSERT INTO logitrack.lignes_expedition
         (commande_id, article_id, quantite, poids_reel, numero_lot, emplacement, quantite_expedition)
          VALUES ($1, $2, $3, $4, $5, $6, $7)
            """,
         bl_id, emp['article_id'], emp['quantite'],
         data.poids_reel, emp['numero_lot'], data.emplacement.upper(),
         data.quantite_expedition if data.quantite_expedition > 0 else emp['quantite']
)

        stats = await conn.fetchrow("""
            SELECT COUNT(*) AS nb, COALESCE(SUM(poids_reel), 0) AS poids
            FROM logitrack.lignes_expedition
            WHERE commande_id = $1
        """, bl_id)

        await conn.execute("""
            UPDATE logitrack.commandes_expedition
            SET nb_palettes = $1, poids_total = $2, updated_at = NOW()
            WHERE id = $3
        """, stats['nb'], stats['poids'], bl_id)

        return {
            "success": True,
            "article_ref": emp['reference'],
            "article_designation": emp['designation'],
            "numero_lot": emp['numero_lot'],
            "quantite": emp['quantite'],
            "poids_reel": data.poids_reel,
            "emplacement": data.emplacement.upper()
        }
    finally:
        await conn.close()

@router.delete("/bls/{bl_id}/lignes/{emplacement}")
async def supprimer_ligne(bl_id: int, emplacement: str):
    conn = await asyncpg.connect(**DB_CONFIG)
    try:
        await conn.execute("""
            DELETE FROM logitrack.lignes_expedition
            WHERE commande_id = $1 AND emplacement = $2
        """, bl_id, emplacement.upper())

        stats = await conn.fetchrow("""
            SELECT COUNT(*) AS nb, COALESCE(SUM(poids_reel), 0) AS poids
            FROM logitrack.lignes_expedition
            WHERE commande_id = $1
        """, bl_id)

        await conn.execute("""
            UPDATE logitrack.commandes_expedition
            SET nb_palettes = $1, poids_total = $2, updated_at = NOW()
            WHERE id = $3
        """, stats['nb'], stats['poids'], bl_id)

        return {"success": True}
    finally:
        await conn.close()

@router.post("/bls/{bl_id}/valider")
async def valider_bl(bl_id: int):
    conn = await asyncpg.connect(**DB_CONFIG)
    try:
        lignes = await conn.fetch("""
            SELECT article_id, quantite, numero_lot, emplacement,
                   (SELECT id FROM logitrack.emplacements WHERE code = emplacement) AS emp_id,
                   (SELECT id FROM logitrack.lots WHERE numero_lot = le.numero_lot AND emplacement_id = (SELECT id FROM logitrack.emplacements WHERE code = le.emplacement)) AS lot_id
            FROM logitrack.lignes_expedition le
            WHERE commande_id = $1
        """, bl_id)

        for ligne in lignes:
            quantite_expediee = ligne.get('quantite_expedition') or ligne['quantite']

            if ligne['lot_id']:
                lot = await conn.fetchrow(
                    "SELECT quantite FROM logitrack.lots WHERE id = $1",
                    ligne['lot_id']
                )
                nouvelle_qte = max(0, (lot['quantite'] or 0) - quantite_expediee)
                await conn.execute("""
                    UPDATE logitrack.lots
                    SET quantite = $1, updated_at = NOW()
                    WHERE id = $2
                """, nouvelle_qte, ligne['lot_id'])

                if nouvelle_qte == 0 and ligne['emp_id']:
                    await conn.execute("""
                        UPDATE logitrack.emplacements
                        SET statut = 'libre', article_id = NULL, updated_at = NOW()
                        WHERE id = $1
                    """, ligne['emp_id'])

            art = await conn.fetchrow(
                "SELECT stock_actuel FROM logitrack.articles WHERE id = $1",
                ligne['article_id']
            )
            if art:
                stock_apres = max(0, art['stock_actuel'] - quantite_expediee)
                await conn.execute(
                    "UPDATE logitrack.articles SET stock_actuel = $1, updated_at = NOW() WHERE id = $2",
                    stock_apres, ligne['article_id']
                )
                await conn.execute("""
                    INSERT INTO logitrack.mouvements_stock
                    (article_id, type_mvt, motif_sortie, quantite, stock_avant, stock_apres, reference_doc)
                    VALUES ($1, 'sortie', 'expedition', $2, $3, $4, $5)
                """, ligne['article_id'], quantite_expediee,
                    art['stock_actuel'], stock_apres,
                    f"BL-{bl_id}")

                await conn.execute("""
                    UPDATE logitrack.commandes_expedition
                    SET statut = 'livre', updated_at = NOW()
                    WHERE id = $1
                """, bl_id)

                return {"success": True, "message": f"BL {bl_id} valide — stock et emplacements mis a jour"}
    finally:
        await conn.close()
