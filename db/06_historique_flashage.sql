SET search_path TO logitrack, public;

CREATE TABLE IF NOT EXISTS logitrack.historique_flashage (
    id                BIGSERIAL    PRIMARY KEY,
    utilisateur_id    INTEGER      NOT NULL REFERENCES logitrack.utilisateurs(id) ON DELETE CASCADE,
    login             VARCHAR(50)  NOT NULL,
    code_scan         TEXT         NOT NULL,
    type_scan         VARCHAR(50)  NOT NULL DEFAULT 'reception',
    reference_article VARCHAR(50),
    emplacement       VARCHAR(20),
    date_flashage     DATE         NOT NULL DEFAULT CURRENT_DATE,
    created_at        TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_flashage_user_date
    ON logitrack.historique_flashage(utilisateur_id, date_flashage DESC);

CREATE INDEX IF NOT EXISTS idx_flashage_date
    ON logitrack.historique_flashage(date_flashage DESC);

CREATE INDEX IF NOT EXISTS idx_flashage_login
    ON logitrack.historique_flashage(login);

GRANT ALL PRIVILEGES ON logitrack.historique_flashage TO logitrack_user;
GRANT ALL PRIVILEGES ON SEQUENCE logitrack.historique_flashage_id_seq TO logitrack_user;

CREATE OR REPLACE VIEW logitrack.v_flashage_resume AS
SELECT
    h.date_flashage,
    h.utilisateur_id,
    h.login,
    u.nom,
    u.prenom,
    COUNT(*)                                               AS nb_scans,
    COUNT(CASE WHEN h.type_scan = 'reception'  THEN 1 END) AS nb_receptions,
    COUNT(CASE WHEN h.type_scan = 'stockage'   THEN 1 END) AS nb_stockages,
    COUNT(CASE WHEN h.type_scan = 'expedition' THEN 1 END) AS nb_expeditions,
    MIN(h.created_at)                                      AS premier_scan,
    MAX(h.created_at)                                      AS dernier_scan
FROM logitrack.historique_flashage h
JOIN logitrack.utilisateurs u ON u.id = h.utilisateur_id
GROUP BY h.date_flashage, h.utilisateur_id, h.login, u.nom, u.prenom
ORDER BY h.date_flashage DESC, nb_scans DESC;

SELECT 'Table historique_flashage creee' AS message;
