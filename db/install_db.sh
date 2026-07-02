#!/bin/bash
# =============================================================
#  LogiTrack Pro — Script d'initialisation base de données
#  Fichier  : install_db.sh
#  Usage    : bash install_db.sh [--seed]
# =============================================================

set -e  # arrêt immédiat en cas d'erreur

DB_HOST="${DB_HOST:-localhost}"
DB_PORT="${DB_PORT:-5432}"
DB_NAME="${DB_NAME:-logitrack}"
DB_USER="${DB_USER:-logitrack_user}"
DB_SUPERUSER="${DB_SUPERUSER:-postgres}"

GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

echo ""
echo "======================================================"
echo "  LogiTrack Pro — Initialisation PostgreSQL"
echo "======================================================"
echo ""

# Étape 1 — Créer l'utilisateur et la base (en superuser)
echo -e "${YELLOW}[1/5] Création de l'utilisateur et de la base...${NC}"
psql -U "$DB_SUPERUSER" -h "$DB_HOST" -p "$DB_PORT" -c \
    "CREATE USER logitrack_user WITH PASSWORD 'logitrack_2024!';" 2>/dev/null || true
psql -U "$DB_SUPERUSER" -h "$DB_HOST" -p "$DB_PORT" -c \
    "CREATE DATABASE logitrack OWNER logitrack_user ENCODING 'UTF8' TEMPLATE template0;" 2>/dev/null || true
psql -U "$DB_SUPERUSER" -h "$DB_HOST" -p "$DB_PORT" -c \
    "GRANT ALL PRIVILEGES ON DATABASE logitrack TO logitrack_user;" 2>/dev/null || true
echo -e "${GREEN}  OK${NC}"

# Étape 2 — Schéma
echo -e "${YELLOW}[2/5] Création des tables et types...${NC}"
PGPASSWORD=logitrack_2024! psql -U "$DB_USER" -h "$DB_HOST" -p "$DB_PORT" -d "$DB_NAME" \
    -f 01_schema.sql -v ON_ERROR_STOP=1
echo -e "${GREEN}  OK${NC}"

# Étape 3 — Triggers
echo -e "${YELLOW}[3/5] Création des triggers et fonctions...${NC}"
PGPASSWORD=logitrack_2024! psql -U "$DB_USER" -h "$DB_HOST" -p "$DB_PORT" -d "$DB_NAME" \
    -f 02_triggers.sql -v ON_ERROR_STOP=1
echo -e "${GREEN}  OK${NC}"

# Étape 4 — Vues
echo -e "${YELLOW}[4/5] Création des vues métier...${NC}"
PGPASSWORD=logitrack_2024! psql -U "$DB_USER" -h "$DB_HOST" -p "$DB_PORT" -d "$DB_NAME" \
    -f 03_views.sql -v ON_ERROR_STOP=1
echo -e "${GREEN}  OK${NC}"

# Étape 4b — Index
echo -e "${YELLOW}[4b/5] Création des index de performance...${NC}"
PGPASSWORD=logitrack_2024! psql -U "$DB_USER" -h "$DB_HOST" -p "$DB_PORT" -d "$DB_NAME" \
    -f 04_indexes.sql -v ON_ERROR_STOP=1
echo -e "${GREEN}  OK${NC}"

# Étape 5 — Données de test (optionnel)
if [[ "$1" == "--seed" ]]; then
    echo -e "${YELLOW}[5/5] Chargement des données de test...${NC}"
    PGPASSWORD=logitrack_2024! psql -U "$DB_USER" -h "$DB_HOST" -p "$DB_PORT" -d "$DB_NAME" \
        -f 05_seed.sql -v ON_ERROR_STOP=1
    echo -e "${GREEN}  OK${NC}"
else
    echo -e "      [5/5] Seed ignoré (ajouter --seed pour charger les données de test)"
fi

echo ""
echo -e "${GREEN}======================================================"
echo -e "  Base de données LogiTrack initialisée avec succès !"
echo -e "  Connexion : psql -U logitrack_user -d logitrack -h localhost"
echo -e "  API docs  : http://localhost:8000/docs"
echo -e "======================================================${NC}"
echo ""
