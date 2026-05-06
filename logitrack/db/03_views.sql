SET search_path TO logitrack, public;

CREATE OR REPLACE VIEW v_stock_articles AS
SELECT
    a.id,
    a.reference,
    a.designation,
    a.unite,
    a.stock_actuel,
    a.stock_minimum,
    a.stock_maximum,
    CASE
        WHEN a.stock_actuel = 0 THEN 'rupture'
        WHEN a.stock_actuel <= a.stock_minimum THEN 'critique'
        WHEN a.stock_minimum > 0 AND a.stock_actuel <= a.stock_minimum * 1.5 THEN 'bas'
        ELSE 'ok'
    END AS niveau_stock,
    ROUND(
        CASE WHEN a.stock_maximum > 0
             THEN a.stock_actuel::NUMERIC / a.stock_maximum * 100
             ELSE NULL
        END, 1
    ) AS taux_remplissage_pct,
    f.raison_sociale AS fournisseur,
    a.statut,
    a.updated_at AS derniere_maj
FROM logitrack.articles a
LEFT JOIN logitrack.fournisseurs f ON f.id = a.fournisseur_id
WHERE a.statut = 'actif';

CREATE OR REPLACE VIEW v_mouvements_jour AS
SELECT
    m.id,
    m.created_at,
    a.reference AS ref_article,
    a.designation,
    m.type_mvt,
    COALESCE(m.motif_entree::TEXT, m.motif_sortie::TEXT) AS motif,
    m.quantite,
    m.stock_avant,
    m.stock_apres,
    l.numero_lot,
    e.code AS emplacement,
    m.reference_doc,
    m.operateur,
    m.scan_raw
FROM logitrack.mouvements_stock m
JOIN logitrack.articles a ON a.id = m.article_id
LEFT JOIN logitrack.lots l ON l.id = m.lot_id
LEFT JOIN logitrack.emplacements e ON e.id = m.emplacement_id
WHERE m.created_at >= CURRENT_DATE
ORDER BY m.created_at DESC;

CREATE OR REPLACE VIEW v_alertes_actives AS
SELECT
    al.id,
    al.created_at,
    al.type_alerte,
    al.message,
    al.valeur_seuil,
    al.valeur_actuelle,
    a.reference,
    a.designation,
    a.stock_actuel
FROM logitrack.alertes_stock al
JOIN logitrack.articles a ON a.id = al.article_id
WHERE al.acquittee = FALSE
ORDER BY
    CASE al.type_alerte
        WHEN 'rupture'        THEN 1
        WHEN 'stock_critique' THEN 2
        WHEN 'peremption'     THEN 3
        ELSE 4
    END,
    al.created_at DESC;

CREATE OR REPLACE VIEW v_plan_stockage AS
SELECT
    em.id,
    em.code,
    em.allee,
    em.rangee,
    em.niveau,
    em.statut,
    em.capacite_max,
    a.reference AS article_ref,
    a.designation AS article_designation,
    l.numero_lot,
    l.quantite AS quantite_lot
FROM logitrack.emplacements em
LEFT JOIN logitrack.articles a ON a.id = em.article_id
LEFT JOIN logitrack.lots l ON l.emplacement_id = em.id AND l.quantite > 0
ORDER BY em.allee, em.rangee, em.niveau;

CREATE OR REPLACE VIEW v_dashboard_kpis AS
SELECT
    (SELECT COUNT(*) FROM logitrack.bons_livraison WHERE DATE(date_reception) = CURRENT_DATE) AS receptions_jour,
    (SELECT COUNT(*) FROM logitrack.bons_livraison WHERE DATE(date_reception) = CURRENT_DATE - 1) AS receptions_hier,
    (SELECT COUNT(*) FROM logitrack.commandes_expedition WHERE DATE(date_expedition) = CURRENT_DATE) AS expeditions_jour,
    (SELECT COUNT(*) FROM logitrack.commandes_expedition WHERE DATE(date_expedition) = CURRENT_DATE - 1) AS expeditions_hier,
    (SELECT COALESCE(SUM(stock_actuel), 0) FROM logitrack.articles WHERE statut = 'actif') AS total_articles_stock,
    (SELECT COUNT(*) FROM logitrack.emplacements) AS total_emplacements,
    (SELECT COUNT(*) FROM logitrack.emplacements WHERE statut = 'occupe') AS emplacements_occupes,
    ROUND(
        (SELECT COUNT(*) FROM logitrack.emplacements WHERE statut = 'occupe')::NUMERIC /
        NULLIF((SELECT COUNT(*) FROM logitrack.emplacements), 0) * 100, 1
    ) AS taux_remplissage_pct,
    (SELECT COUNT(*) FROM logitrack.alertes_stock WHERE acquittee = FALSE) AS alertes_actives,
    (SELECT COUNT(*) FROM logitrack.mouvements_stock WHERE created_at >= CURRENT_DATE AND type_mvt = 'entree') AS entrees_jour,
    (SELECT COUNT(*) FROM logitrack.mouvements_stock WHERE created_at >= CURRENT_DATE AND type_mvt = 'sortie') AS sorties_jour;

CREATE OR REPLACE VIEW v_receptions_en_cours AS
SELECT
    bl.id,
    bl.numero_bl,
    bl.date_reception,
    bl.heure_reception,
    f.raison_sociale AS fournisseur,
    bl.transporteur,
    bl.numero_tracking,
    bl.nb_colis,
    bl.statut,
    bl.operateur,
    COUNT(lb.id) AS nb_lignes,
    SUM(lb.quantite_attendue) AS qte_attendue_total,
    SUM(lb.quantite_recue) AS qte_recue_total
FROM logitrack.bons_livraison bl
JOIN logitrack.fournisseurs f ON f.id = bl.fournisseur_id
LEFT JOIN logitrack.lignes_bl lb ON lb.bl_id = bl.id
WHERE bl.statut NOT IN ('annule')
AND bl.date_reception >= CURRENT_DATE - 7
GROUP BY bl.id, f.raison_sociale
ORDER BY bl.heure_reception DESC;
