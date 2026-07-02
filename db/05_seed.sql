SET search_path TO logitrack, public;

INSERT INTO utilisateurs (login, nom, prenom, email, password_hash, role) VALUES
('dupont.m', 'Dupont', 'Marc',  'marc.dupont@logitrack.local',  crypt('password123', gen_salt('bf')), 'operateur'),
('martin.l', 'Martin', 'Lucie', 'lucie.martin@logitrack.local', crypt('password123', gen_salt('bf')), 'superviseur'),
('garcia.p', 'Garcia', 'Pedro', 'pedro.garcia@logitrack.local', crypt('password123', gen_salt('bf')), 'operateur'),
('admin',    'Admin',  'System','admin@logitrack.local',         crypt('admin2024!',  gen_salt('bf')), 'admin')
ON CONFLICT (login) DO NOTHING;

INSERT INTO fournisseurs (code, raison_sociale, ville, pays, email, delai_livraison_jours) VALUES
('F-001', 'Distri-Tech SARL', 'Lyon',      'France',    'commandes@distri-tech.fr',  2),
('F-002', 'LogiParts SA',     'Paris',     'France',    'orders@logiparts.com',      3),
('F-003', 'Fournitures Pro',  'Bordeaux',  'France',    'contact@fournitures-pro.fr',5),
('F-004', 'EuroStock GmbH',   'Stuttgart', 'Allemagne', 'info@eurostock.de',         7)
ON CONFLICT (code) DO NOTHING;

INSERT INTO articles (reference, designation, code_ean13, unite, stock_actuel, stock_minimum, stock_maximum, poids_kg, fournisseur_id)
SELECT ref, des, ean, u, sa, smin, smax, pds, (SELECT id FROM fournisseurs WHERE code = fc)
FROM (VALUES
    ('ART-0055', 'Cable USB-C 2m',          '3700123456789', 'piece',   480, 50,  1000, 0.080, 'F-001'),
    ('ART-0118', 'Adaptateur HDMI',          '3700123456796', 'piece',     2, 20,   500, 0.050, 'F-001'),
    ('ART-0042', 'Boitier plastique 15L',    '3700123456802', 'piece',     5, 30,   300, 0.450, 'F-002'),
    ('ART-0201', 'Palette Europe 120x80',    '3700123456819', 'piece',   125, 40,   200,22.000, 'F-002'),
    ('ART-0088', 'Film etirable 500m',       '3700123456826', 'rouleau',  18, 10,   100, 4.200, 'F-003'),
    ('ART-0231', 'Film retractable 400m',    '3700123456833', 'rouleau',  12,  5,    50, 3.100, 'F-003'),
    ('ART-0310', 'Ruban adhesif 50mm x 66m', '3700123456840', 'rouleau',  95, 20,   500, 0.300, 'F-003'),
    ('ART-0415', 'Etiquettes blanches A4',   '3700123456857', 'boite',    34, 10,   200, 0.500, 'F-002'),
    ('ART-0502', 'Cable Ethernet Cat6 3m',   '3700123456864', 'piece',   210, 30,   600, 0.120, 'F-001'),
    ('ART-0611', 'Hub USB 7 ports',          '3700123456871', 'piece',    67, 15,   300, 0.350, 'F-004')
) AS t(ref, des, ean, u, sa, smin, smax, pds, fc)
ON CONFLICT (reference) DO NOTHING;

DO $$
DECLARE
    allee CHAR(1);
    i     INT;
BEGIN
    FOREACH allee IN ARRAY ARRAY['A','B','C'] LOOP
        FOR i IN 1..8 LOOP
            INSERT INTO logitrack.emplacements (code, allee, rangee, niveau, capacite_max)
            VALUES (allee || '-' || LPAD(i::TEXT, 2, '0') || '-00', allee, i, 0, 1)
            ON CONFLICT (code) DO NOTHING;
        END LOOP;
    END LOOP;
END;
$$;

INSERT INTO lots (numero_lot, article_id, emplacement_id, quantite, date_entree)
SELECT
    'LOT-' || TO_CHAR(NOW() - INTERVAL '5 days', 'YYYYMMDD') || '-' || LPAD(a.rn_art::TEXT, 2, '0'),
    a.art_id,
    e.emp_id,
    a.art_stock,
    NOW() - INTERVAL '5 days'
FROM (
    SELECT id AS art_id,
           stock_actuel AS art_stock,
           ROW_NUMBER() OVER (ORDER BY id) AS rn_art
    FROM logitrack.articles
    WHERE stock_actuel > 0 AND statut = 'actif'
) a
JOIN (
    SELECT id AS emp_id,
           ROW_NUMBER() OVER (ORDER BY id) AS rn_emp
    FROM logitrack.emplacements
) e ON e.rn_emp = a.rn_art
ON CONFLICT (numero_lot) DO NOTHING;

INSERT INTO bons_livraison (numero_bl, fournisseur_id, transporteur, numero_tracking, nb_colis, statut, operateur)
SELECT num, (SELECT id FROM fournisseurs WHERE code = fc), transp, track, col, st::statut_bl, op
FROM (VALUES
    ('BL-2024-0891', 'F-001', 'DHL',       '1Z999AA100891', 3, 'en_cours', 'dupont.m'),
    ('BL-2024-0889', 'F-002', 'TNT',       'TX44821889',    2, 'valide',   'martin.l'),
    ('BL-2024-0887', 'F-003', 'Chronopost','CHR772870',     1, 'valide',   'dupont.m'),
    ('BL-2024-0885', 'F-001', 'DHL',       '1Z999AA100885', 5, 'litige',   'garcia.p')
) AS t(num, fc, transp, track, col, st, op)
ON CONFLICT (numero_bl) DO NOTHING;

INSERT INTO commandes_expedition (numero_cmd, client_nom, client_adresse, transporteur, priorite, statut, date_expedition)
VALUES
('CMD-4421', 'Aubert SA',   '12 rue du Commerce 69001 Lyon',    'DHL',        'urgent', 'preparation', CURRENT_DATE),
('CMD-4418', 'Martinez Co', '5 allee des Pins 33000 Bordeaux',  'TNT',        'normal', 'brouillon',   CURRENT_DATE + 1),
('CMD-4415', 'NordLogis',   '88 bd du Nord 59000 Lille',        'Chronopost', 'differe','brouillon',   CURRENT_DATE + 3)
ON CONFLICT (numero_cmd) DO NOTHING;

INSERT INTO mouvements_stock
    (article_id, type_mvt, motif_entree, quantite, stock_avant, stock_apres, reference_doc, operateur, created_at)
SELECT
    a.id, 'entree', 'reception_fournisseur',
    a.stock_actuel, 0, a.stock_actuel,
    'BL-2024-INIT', 'admin',
    NOW() - INTERVAL '10 days'
FROM logitrack.articles a
WHERE a.statut = 'actif' AND a.stock_actuel > 0;

SELECT logitrack.fn_alertes_peremption(7);

DO $$
BEGIN
    RAISE NOTICE '=== Seed LogiTrack termine ===';
    RAISE NOTICE 'Utilisateurs  : %', (SELECT COUNT(*) FROM logitrack.utilisateurs);
    RAISE NOTICE 'Fournisseurs  : %', (SELECT COUNT(*) FROM logitrack.fournisseurs);
    RAISE NOTICE 'Articles      : %', (SELECT COUNT(*) FROM logitrack.articles);
    RAISE NOTICE 'Emplacements  : %', (SELECT COUNT(*) FROM logitrack.emplacements);
    RAISE NOTICE 'Lots          : %', (SELECT COUNT(*) FROM logitrack.lots);
    RAISE NOTICE 'BLs           : %', (SELECT COUNT(*) FROM logitrack.bons_livraison);
    RAISE NOTICE 'Mouvements    : %', (SELECT COUNT(*) FROM logitrack.mouvements_stock);
END;
$$;
