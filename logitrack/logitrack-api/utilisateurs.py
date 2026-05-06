import asyncpg
import hashlib
import secrets
from fastapi import APIRouter
from pydantic import BaseModel
from typing import Optional
from datetime import date

router = APIRouter(prefix="/utilisateurs", tags=["Utilisateurs"])

DB_CONFIG = {
    "host": "localhost",
    "port": 5432,
    "user": "logitrack_user",
    "password": "logitrack_2024!",
    "database": "logitrack"
}

ROLES = ['operateur', 'superviseur', 'admin']

def hash_password(password: str) -> str:
    salt = secrets.token_hex(16)
    h = hashlib.sha256(f"{salt}{password}".encode()).hexdigest()
    return f"{salt}:{h}"

def verify_password(password: str, stored: str) -> bool:
    try:
        salt, h = stored.split(":")
        return hashlib.sha256(f"{salt}{password}".encode()).hexdigest() == h
    except Exception:
        return False

class UtilisateurCreateSchema(BaseModel):
    login: str
    nom: str
    prenom: str = ""
    email: str = ""
    password: str
    role: str = "operateur"

class UtilisateurUpdateSchema(BaseModel):
    nom: str = ""
    prenom: str = ""
    email: str = ""
    role: str = ""
    actif: bool = True

class PasswordChangeSchema(BaseModel):
    nouveau_password: str

class LoginSchema(BaseModel):
    login: str
    password: str

class FlashageSchema(BaseModel):
    utilisateur_id: int
    code_scan: str
    type_scan: str = "reception"
    reference_article: str = ""
    emplacement: str = ""

@router.get("/")
async def get_utilisateurs():
    conn = await asyncpg.connect(**DB_CONFIG)
    try:
        rows = await conn.fetch("""
            SELECT id, login, nom, prenom, email, role, actif, derniere_connexion
            FROM logitrack.utilisateurs
            ORDER BY role, login
        """)
        return [dict(r) for r in rows]
    finally:
        await conn.close()

@router.post("/login")
async def login(data: LoginSchema):
    conn = await asyncpg.connect(**DB_CONFIG)
    try:
        user = await conn.fetchrow("""
            SELECT id, login, nom, prenom, role, password_hash, actif
            FROM logitrack.utilisateurs
            WHERE login = $1
        """, data.login)

        if not user:
            return {"success": False, "error": "Utilisateur non trouve"}
        if not user['actif']:
            return {"success": False, "error": "Compte desactive"}
        if not verify_password(data.password, user['password_hash']):
            return {"success": False, "error": "Mot de passe incorrect"}

        await conn.execute("""
            UPDATE logitrack.utilisateurs
            SET derniere_connexion = NOW()
            WHERE id = $1
        """, user['id'])

        return {
            "success": True,
            "id": user['id'],
            "login": user['login'],
            "nom": user['nom'],
            "prenom": user['prenom'],
            "role": user['role']
        }
    finally:
        await conn.close()

@router.post("/")
async def create_utilisateur(data: UtilisateurCreateSchema):
    if data.role not in ROLES:
        return {"error": f"Role invalide — choisir parmi : {', '.join(ROLES)}"}
    if len(data.password) < 2 or len(data.password) > 5:
        return {"error": "Mot de passe doit faire entre 2 et 5 caracteres"}

    conn = await asyncpg.connect(**DB_CONFIG)
    try:
        existing = await conn.fetchrow(
            "SELECT id FROM logitrack.utilisateurs WHERE login = $1",
            data.login
        )
        if existing:
            return {"error": f"Login {data.login} existe deja"}

        password_hash = hash_password(data.password)
        row = await conn.fetchrow("""
            INSERT INTO logitrack.utilisateurs
            (login, nom, prenom, email, password_hash, role)
            VALUES ($1, $2, $3, $4, $5, $6)
            RETURNING id, login, nom, role
        """,
            data.login, data.nom, data.prenom,
            data.email or None, password_hash, data.role
        )
        return {"success": True, **dict(row)}
    finally:
        await conn.close()

@router.put("/{user_id}")
async def update_utilisateur(user_id: int, data: UtilisateurUpdateSchema):
    if data.role and data.role not in ROLES and data.role != "":
        return {"error": f"Role invalide — choisir parmi : {', '.join(ROLES)}"}

    conn = await asyncpg.connect(**DB_CONFIG)
    try:
        row = await conn.fetchrow("""
            UPDATE logitrack.utilisateurs SET
                nom    = COALESCE(NULLIF($1,''), nom),
                prenom = COALESCE(NULLIF($2,''), prenom),
                email  = COALESCE(NULLIF($3,''), email),
                role   = COALESCE(NULLIF($4,''), role),
                actif  = $5,
                updated_at = NOW()
            WHERE id = $6
            RETURNING id, login, nom, role, actif
        """,
            data.nom, data.prenom, data.email,
            data.role, data.actif, user_id
        )
        if not row:
            return {"error": "Utilisateur non trouve"}
        return {"success": True, **dict(row)}
    finally:
        await conn.close()

@router.put("/{user_id}/password")
async def change_password(user_id: int, data: PasswordChangeSchema):
    if len(data.nouveau_password) < 2 or len(data.nouveau_password) > 5:
        return {"error": "Mot de passe doit faire entre 2 et 5 caracteres"}

    conn = await asyncpg.connect(**DB_CONFIG)
    try:
        password_hash = hash_password(data.nouveau_password)
        row = await conn.fetchrow("""
            UPDATE logitrack.utilisateurs
            SET password_hash = $1, updated_at = NOW()
            WHERE id = $2
            RETURNING id, login
        """, password_hash, user_id)
        if not row:
            return {"error": "Utilisateur non trouve"}
        return {"success": True, "message": f"Mot de passe de {row['login']} mis a jour"}
    finally:
        await conn.close()

@router.delete("/{user_id}")
async def supprimer_utilisateur(user_id: int):
    conn = await asyncpg.connect(**DB_CONFIG)
    try:
        user = await conn.fetchrow(
            "SELECT login, role FROM logitrack.utilisateurs WHERE id = $1",
            user_id
        )
        if not user:
            return {"error": "Utilisateur non trouve"}
        if user['role'] in ('admin', 'superviseur'):
            return {"error": "Impossible de supprimer un admin ou superviseur"}

        await conn.execute(
            "DELETE FROM logitrack.utilisateurs WHERE id = $1",
            user_id
        )
        return {"success": True, "message": f"Utilisateur {user['login']} supprime"}
    finally:
        await conn.close()

@router.post("/flashage")
async def enregistrer_flashage(data: FlashageSchema):
    conn = await asyncpg.connect(**DB_CONFIG)
    try:
        user = await conn.fetchrow(
            "SELECT login, role FROM logitrack.utilisateurs WHERE id = $1",
            data.utilisateur_id
        )
        if not user:
            return {"error": "Utilisateur non trouve"}
        if user['role'] in ('superviseur', 'admin'):
            return {"success": True, "message": "Flashage non archive pour superviseur/admin"}

        await conn.execute("""
            INSERT INTO logitrack.historique_flashage
            (utilisateur_id, login, code_scan, type_scan, reference_article, emplacement, date_flashage)
            VALUES ($1, $2, $3, $4, $5, $6, CURRENT_DATE)
        """,
            data.utilisateur_id, user['login'],
            data.code_scan, data.type_scan,
            data.reference_article, data.emplacement
        )
        return {"success": True}
    finally:
        await conn.close()

@router.get("/{user_id}/historique")
async def get_historique_flashage(user_id: int, date_debut: Optional[str] = None, date_fin: Optional[str] = None):
    conn = await asyncpg.connect(**DB_CONFIG)
    try:
        query = """
            SELECT id, login, code_scan, type_scan, reference_article,
                   emplacement, date_flashage, created_at
            FROM logitrack.historique_flashage
            WHERE utilisateur_id = $1
        """
        params = [user_id]

        if date_debut:
            params.append(date_debut)
            query += f" AND date_flashage >= ${len(params)}"
        if date_fin:
            params.append(date_fin)
            query += f" AND date_flashage <= ${len(params)}"

        query += " ORDER BY created_at DESC LIMIT 500"

        rows = await conn.fetch(query, *params)
        return [dict(r) for r in rows]
    finally:
        await conn.close()

@router.get("/historique/jour")
async def get_historique_jour(date_jour: Optional[str] = None):
    conn = await asyncpg.connect(**DB_CONFIG)
    try:
        jour = date_jour or str(date.today())
        rows = await conn.fetch("""
            SELECT h.id, h.login, h.code_scan, h.type_scan,
                   h.reference_article, h.emplacement,
                   h.date_flashage, h.created_at,
                   u.nom, u.prenom
            FROM logitrack.historique_flashage h
            JOIN logitrack.utilisateurs u ON u.id = h.utilisateur_id
            WHERE h.date_flashage = $1
            ORDER BY h.created_at DESC
        """, jour)
        return [dict(r) for r in rows]
    finally:
        await conn.close()
