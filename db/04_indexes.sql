-- =============================================================
--  LogiTrack Pro — Index de performance
--  Fichier  : 04_indexes.sql
--  À exécuter APRÈS 03_views.sql
-- =============================================================

SET search_path TO logitrack, public;

-- =============================================================
--  Articles
-- =============================================================
CREATE INDEX idx_articles_reference
    ON logitrack.articles(reference);

CREATE INDEX idx_articles_statut
    ON logitrack.articles(statut)
    WHERE statut = 'actif';

CREATE INDEX idx_articles_stock_min
    ON logitrack.articles(stock_actuel, stock_minimum)
    WHERE statut = 'actif';

CREATE INDEX idx_articles_fournisseur
    ON logitrack.articles(fournisseur_id)
    WHERE fournisseur_id IS NOT NULL;

-- Recherche texte sur désignation (sans accent)
CREATE INDEX idx_articles_designation_search
    ON logitrack.articles
    USING GIN (to_tsvector('french', unaccent(designation)));

-- =============================================================
--  Lots
-- =============================================================
CREATE INDEX idx_lots_numero
    ON logitrack.lots(numero_lot);

CREATE INDEX idx_lots_article
    ON logitrack.lots(article_id);

CREATE INDEX idx_lots_emplacement
    ON logitrack.lots(emplacement_id)
    WHERE emplacement_id IS NOT NULL;

CREATE INDEX idx_lots_peremption
    ON logitrack.lots(date_peremption)
    WHERE date_peremption IS NOT NULL AND quantite > 0;

-- =============================================================
--  Bons de livraison
-- =============================================================
CREATE INDEX idx_bl_numero
    ON logitrack.bons_livraison(numero_bl);

CREATE INDEX idx_bl_date_reception
    ON logitrack.bons_livraison(date_reception DESC);

CREATE INDEX idx_bl_statut
    ON logitrack.bons_livraison(statut);

CREATE INDEX idx_bl_fournisseur
    ON logitrack.bons_livraison(fournisseur_id);

-- =============================================================
--  Mouvements de stock (table volumineuse)
-- =============================================================
-- Déjà créés dans 01_schema.sql :
--   idx_mvt_article_date, idx_mvt_lot, idx_mvt_type_date, idx_mvt_date

CREATE INDEX idx_mvt_reference_doc
    ON logitrack.mouvements_stock(reference_doc)
    WHERE reference_doc IS NOT NULL;

CREATE INDEX idx_mvt_operateur
    ON logitrack.mouvements_stock(operateur)
    WHERE operateur IS NOT NULL;

-- Partitionnement futur conseillé par mois sur created_at
-- quand le volume dépasse ~10M de lignes

-- =============================================================
--  Commandes expédition
-- =============================================================
CREATE INDEX idx_exp_numero
    ON logitrack.commandes_expedition(numero_cmd);

CREATE INDEX idx_exp_statut
    ON logitrack.commandes_expedition(statut);

CREATE INDEX idx_exp_date
    ON logitrack.commandes_expedition(date_expedition DESC)
    WHERE date_expedition IS NOT NULL;

CREATE INDEX idx_exp_priorite_statut
    ON logitrack.commandes_expedition(priorite, statut)
    WHERE statut NOT IN ('livre','annule');

-- =============================================================
--  Emplacements
-- =============================================================
CREATE INDEX idx_emp_code
    ON logitrack.emplacements(code);

CREATE INDEX idx_emp_allee_statut
    ON logitrack.emplacements(allee, statut);

-- =============================================================
--  Alertes
-- =============================================================
CREATE INDEX idx_alertes_actives
    ON logitrack.alertes_stock(article_id, acquittee)
    WHERE acquittee = FALSE;

-- =============================================================
--  Étiquettes
-- =============================================================
CREATE INDEX idx_etiq_date
    ON logitrack.etiquettes_imprimees(created_at DESC);

CREATE INDEX idx_etiq_lot
    ON logitrack.etiquettes_imprimees(lot_id)
    WHERE lot_id IS NOT NULL;

-- =============================================================
--  Utilisateurs
-- =============================================================
CREATE UNIQUE INDEX idx_users_login
    ON logitrack.utilisateurs(login);

CREATE UNIQUE INDEX idx_users_email
    ON logitrack.utilisateurs(email)
    WHERE email IS NOT NULL;
