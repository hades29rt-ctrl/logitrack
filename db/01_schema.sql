-- =============================================================
--  LogiTrack Pro — Schéma base de données
--  Fichier  : 01_schema.sql
--  Version  : 1.0
--  SGBD     : PostgreSQL 17 / 18
--  Encodage : UTF-8
-- =============================================================

-- Extensions utiles
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";   -- UUID v4
CREATE EXTENSION IF NOT EXISTS "pgcrypto";     -- chiffrement
CREATE EXTENSION IF NOT EXISTS "unaccent";     -- recherche sans accent

-- =============================================================
--  SCHÉMA APPLICATIF
-- =============================================================
CREATE SCHEMA IF NOT EXISTS logitrack;
SET search_path TO logitrack, public;

-- =============================================================
--  TYPES ÉNUMÉRÉS
-- =============================================================

CREATE TYPE statut_bl        AS ENUM ('en_attente','en_cours','valide','litige','annule');
CREATE TYPE statut_expedition AS ENUM ('brouillon','preparation','pret','parti','livre','annule');
CREATE TYPE type_mouvement   AS ENUM ('entree','sortie','transfert','ajustement','rebut','retour');
CREATE TYPE motif_sortie     AS ENUM ('expedition','prelevement_interne','retour_fournisseur','rebut','inventaire');
CREATE TYPE motif_entree     AS ENUM ('reception_fournisseur','retour_client','ajustement_inventaire','production_interne');
CREATE TYPE statut_emplacement AS ENUM ('libre','occupe','reserve','bloque');
CREATE TYPE type_etiquette   AS ENUM ('reception','stockage','expedition','article','sscc');
CREATE TYPE statut_article   AS ENUM ('actif','inactif','archive');
CREATE TYPE priorite_cmd     AS ENUM ('urgent','normal','differe');

-- =============================================================
--  TABLE : fournisseurs
-- =============================================================
CREATE TABLE fournisseurs (
    id              SERIAL          PRIMARY KEY,
    code            VARCHAR(20)     NOT NULL UNIQUE,
    raison_sociale  VARCHAR(150)    NOT NULL,
    adresse         TEXT,
    code_postal     VARCHAR(10),
    ville           VARCHAR(100),
    pays            VARCHAR(60)     DEFAULT 'France',
    telephone       VARCHAR(20),
    email           VARCHAR(150),
    delai_livraison_jours INT       DEFAULT 3,
    actif           BOOLEAN         NOT NULL DEFAULT TRUE,
    created_at      TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ     NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE fournisseurs IS 'Annuaire des fournisseurs';

-- =============================================================
--  TABLE : articles
-- =============================================================
CREATE TABLE articles (
    id              SERIAL          PRIMARY KEY,
    reference       VARCHAR(50)     NOT NULL UNIQUE,
    designation     VARCHAR(200)    NOT NULL,
    description     TEXT,
    code_ean13      VARCHAR(13),
    code_gtin14     VARCHAR(14),
    unite           VARCHAR(20)     NOT NULL DEFAULT 'pièce',
    stock_actuel    INTEGER         NOT NULL DEFAULT 0,
    stock_minimum   INTEGER         NOT NULL DEFAULT 0,
    stock_maximum   INTEGER,
    poids_kg        NUMERIC(10,3),
    fournisseur_id  INTEGER         REFERENCES fournisseurs(id) ON DELETE SET NULL,
    statut          statut_article  NOT NULL DEFAULT 'actif',
    created_at      TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
    CONSTRAINT chk_stock_min CHECK (stock_minimum >= 0),
    CONSTRAINT chk_stock_max CHECK (stock_maximum IS NULL OR stock_maximum >= stock_minimum)
);

COMMENT ON TABLE articles IS 'Référentiel des articles / produits';
COMMENT ON COLUMN articles.stock_actuel IS 'Mis à jour automatiquement par trigger';

-- =============================================================
--  TABLE : emplacements
-- =============================================================
CREATE TABLE emplacements (
    id              SERIAL          PRIMARY KEY,
    code            VARCHAR(20)     NOT NULL UNIQUE,  -- ex: A-01, B-12
    allee           VARCHAR(10)     NOT NULL,
    rangee          INTEGER         NOT NULL,
    niveau          INTEGER         NOT NULL DEFAULT 1,
    capacite_max    INTEGER,
    statut          statut_emplacement NOT NULL DEFAULT 'libre',
    article_id      INTEGER         REFERENCES articles(id) ON DELETE SET NULL,
    created_at      TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ     NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE emplacements IS 'Plan de stockage — zones et allées';

-- =============================================================
--  TABLE : lots
-- =============================================================
CREATE TABLE lots (
    id              SERIAL          PRIMARY KEY,
    numero_lot      VARCHAR(50)     NOT NULL UNIQUE,  -- ex: LOT-20241119-07
    article_id      INTEGER         NOT NULL REFERENCES articles(id) ON DELETE RESTRICT,
    emplacement_id  INTEGER         REFERENCES emplacements(id) ON DELETE SET NULL,
    quantite        INTEGER         NOT NULL DEFAULT 0,
    date_fabrication DATE,
    date_peremption  DATE,
    date_entree     TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
    sscc            VARCHAR(20),    -- Numéro de palette GS1
    created_at      TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
    CONSTRAINT chk_quantite_lot CHECK (quantite >= 0)
);

COMMENT ON TABLE lots IS 'Lots de stock avec traçabilité complète';

-- =============================================================
--  TABLE : bons_livraison  (Réception)
-- =============================================================
CREATE TABLE bons_livraison (
    id              SERIAL          PRIMARY KEY,
    numero_bl       VARCHAR(50)     NOT NULL UNIQUE,  -- ex: BL-2024-0891
    fournisseur_id  INTEGER         NOT NULL REFERENCES fournisseurs(id),
    numero_commande VARCHAR(50),
    transporteur    VARCHAR(100),
    numero_tracking VARCHAR(100),
    nb_colis        INTEGER         DEFAULT 1,
    date_reception  DATE            NOT NULL DEFAULT CURRENT_DATE,
    heure_reception TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
    operateur       VARCHAR(100),
    statut          statut_bl       NOT NULL DEFAULT 'en_attente',
    observations    TEXT,
    created_at      TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ     NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE bons_livraison IS 'Bons de livraison reçus des fournisseurs';

-- =============================================================
--  TABLE : lignes_bl  (détail articles d'un BL)
-- =============================================================
CREATE TABLE lignes_bl (
    id              SERIAL          PRIMARY KEY,
    bl_id           INTEGER         NOT NULL REFERENCES bons_livraison(id) ON DELETE CASCADE,
    article_id      INTEGER         NOT NULL REFERENCES articles(id),
    lot_id          INTEGER         REFERENCES lots(id),
    quantite_attendue INTEGER       NOT NULL,
    quantite_recue  INTEGER         DEFAULT 0,
    ecart           INTEGER         GENERATED ALWAYS AS (quantite_recue - quantite_attendue) STORED,
    emplacement_id  INTEGER         REFERENCES emplacements(id),
    created_at      TIMESTAMPTZ     NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE lignes_bl IS 'Lignes articles d un bon de livraison';

-- =============================================================
--  TABLE : mouvements_stock
-- =============================================================
CREATE TABLE mouvements_stock (
    id              BIGSERIAL       PRIMARY KEY,
    article_id      INTEGER         NOT NULL REFERENCES articles(id),
    lot_id          INTEGER         REFERENCES lots(id),
    emplacement_id  INTEGER         REFERENCES emplacements(id),
    type_mvt        type_mouvement  NOT NULL,
    motif_entree    motif_entree,
    motif_sortie    motif_sortie,
    quantite        INTEGER         NOT NULL,
    stock_avant     INTEGER         NOT NULL,
    stock_apres     INTEGER         NOT NULL,
    reference_doc   VARCHAR(100),   -- BL, BdP, CMD numéro
    operateur       VARCHAR(100),
    commentaire     TEXT,
    scan_raw        TEXT,           -- code brut scanné par douchette
    created_at      TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
    CONSTRAINT chk_quantite_mvt CHECK (quantite > 0),
    CONSTRAINT chk_motif CHECK (
        (type_mvt = 'entree'  AND motif_entree IS NOT NULL) OR
        (type_mvt = 'sortie'  AND motif_sortie IS NOT NULL) OR
        (type_mvt NOT IN ('entree','sortie'))
    )
);

COMMENT ON TABLE mouvements_stock IS 'Historique complet de tous les mouvements de stock';

-- Index performance sur les requêtes fréquentes
CREATE INDEX idx_mvt_article_date ON mouvements_stock(article_id, created_at DESC);
CREATE INDEX idx_mvt_lot          ON mouvements_stock(lot_id) WHERE lot_id IS NOT NULL;
CREATE INDEX idx_mvt_type_date    ON mouvements_stock(type_mvt, created_at DESC);
CREATE INDEX idx_mvt_date         ON mouvements_stock(created_at DESC);

-- =============================================================
--  TABLE : commandes_expedition
-- =============================================================
CREATE TABLE commandes_expedition (
    id              SERIAL          PRIMARY KEY,
    numero_cmd      VARCHAR(50)     NOT NULL UNIQUE,  -- ex: CMD-4421
    client_nom      VARCHAR(150)    NOT NULL,
    client_adresse  TEXT,
    transporteur    VARCHAR(100),
    numero_tracking VARCHAR(100),
    priorite        priorite_cmd    NOT NULL DEFAULT 'normal',
    statut          statut_expedition NOT NULL DEFAULT 'brouillon',
    date_commande   DATE            NOT NULL DEFAULT CURRENT_DATE,
    date_expedition DATE,
    poids_total_kg  NUMERIC(10,3),
    operateur       VARCHAR(100),
    created_at      TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ     NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE commandes_expedition IS 'Commandes clients à expédier';

-- =============================================================
--  TABLE : lignes_expedition
-- =============================================================
CREATE TABLE lignes_expedition (
    id              SERIAL          PRIMARY KEY,
    commande_id     INTEGER         NOT NULL REFERENCES commandes_expedition(id) ON DELETE CASCADE,
    article_id      INTEGER         NOT NULL REFERENCES articles(id),
    lot_id          INTEGER         REFERENCES lots(id),
    quantite        INTEGER         NOT NULL,
    created_at      TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
    CONSTRAINT chk_qty_exp CHECK (quantite > 0)
);

COMMENT ON TABLE lignes_expedition IS 'Lignes articles d une commande d expédition';

-- =============================================================
--  TABLE : etiquettes_imprimees
-- =============================================================
CREATE TABLE etiquettes_imprimees (
    id              SERIAL          PRIMARY KEY,
    type_etiquette  type_etiquette  NOT NULL,
    article_id      INTEGER         REFERENCES articles(id),
    lot_id          INTEGER         REFERENCES lots(id),
    bl_id           INTEGER         REFERENCES bons_livraison(id),
    commande_id     INTEGER         REFERENCES commandes_expedition(id),
    code_ean128     TEXT            NOT NULL,    -- chaîne GS1 complète
    zpl_data        TEXT,                        -- commandes ZPL envoyées
    imprimante      VARCHAR(100),
    nb_exemplaires  INTEGER         NOT NULL DEFAULT 1,
    operateur       VARCHAR(100),
    created_at      TIMESTAMPTZ     NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE etiquettes_imprimees IS 'Journal d impression des étiquettes EAN-128';

-- =============================================================
--  TABLE : alertes_stock
-- =============================================================
CREATE TABLE alertes_stock (
    id              SERIAL          PRIMARY KEY,
    article_id      INTEGER         NOT NULL REFERENCES articles(id) ON DELETE CASCADE,
    type_alerte     VARCHAR(50)     NOT NULL,  -- 'stock_critique','peremption','rupture'
    message         TEXT            NOT NULL,
    valeur_seuil    INTEGER,
    valeur_actuelle INTEGER,
    acquittee       BOOLEAN         NOT NULL DEFAULT FALSE,
    acquittee_par   VARCHAR(100),
    acquittee_at    TIMESTAMPTZ,
    created_at      TIMESTAMPTZ     NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE alertes_stock IS 'Alertes déclenchées automatiquement (seuils stock)';

-- =============================================================
--  TABLE : utilisateurs
-- =============================================================
CREATE TABLE utilisateurs (
    id              SERIAL          PRIMARY KEY,
    login           VARCHAR(50)     NOT NULL UNIQUE,
    nom             VARCHAR(100)    NOT NULL,
    prenom          VARCHAR(100),
    email           VARCHAR(150)    UNIQUE,
    password_hash   TEXT            NOT NULL,
    role            VARCHAR(30)     NOT NULL DEFAULT 'operateur',
    actif           BOOLEAN         NOT NULL DEFAULT TRUE,
    derniere_connexion TIMESTAMPTZ,
    created_at      TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ     NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE utilisateurs IS 'Comptes utilisateurs de l application';
