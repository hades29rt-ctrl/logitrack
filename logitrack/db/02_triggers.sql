SET search_path TO logitrack, public;

CREATE OR REPLACE FUNCTION fn_set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$;

DO $$
DECLARE
    t TEXT;
BEGIN
    FOREACH t IN ARRAY ARRAY[
        'fournisseurs','articles','emplacements','lots',
        'bons_livraison','commandes_expedition','utilisateurs'
    ] LOOP
        EXECUTE format(
            'CREATE TRIGGER trg_%I_updated_at
             BEFORE UPDATE ON logitrack.%I
             FOR EACH ROW EXECUTE FUNCTION logitrack.fn_set_updated_at()',
            t, t
        );
    END LOOP;
END;
$$;

CREATE OR REPLACE FUNCTION fn_maj_stock_article()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
    UPDATE logitrack.articles
    SET stock_actuel = NEW.stock_apres,
        updated_at   = NOW()
    WHERE id = NEW.article_id;
    RETURN NEW;
END;
$$;

CREATE TRIGGER trg_mvt_maj_stock
AFTER INSERT ON logitrack.mouvements_stock
FOR EACH ROW EXECUTE FUNCTION logitrack.fn_maj_stock_article();

CREATE OR REPLACE FUNCTION fn_maj_statut_emplacement()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
    IF OLD.emplacement_id IS NOT NULL AND OLD.emplacement_id <> COALESCE(NEW.emplacement_id, -1) THEN
        UPDATE logitrack.emplacements
        SET statut     = 'libre',
            article_id = NULL,
            updated_at = NOW()
        WHERE id = OLD.emplacement_id;
    END IF;
    IF NEW.emplacement_id IS NOT NULL THEN
        UPDATE logitrack.emplacements
        SET statut     = 'occupe',
            article_id = NEW.article_id,
            updated_at = NOW()
        WHERE id = NEW.emplacement_id;
    END IF;
    RETURN NEW;
END;
$$;

CREATE TRIGGER trg_lot_emplacement
AFTER INSERT OR UPDATE OF emplacement_id ON logitrack.lots
FOR EACH ROW EXECUTE FUNCTION logitrack.fn_maj_statut_emplacement();

CREATE OR REPLACE FUNCTION fn_generer_alerte_stock()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE
    v_art logitrack.articles%ROWTYPE;
BEGIN
    SELECT * INTO v_art FROM logitrack.articles WHERE id = NEW.article_id;
    IF v_art.stock_actuel <= v_art.stock_minimum AND v_art.stock_minimum > 0 THEN
        INSERT INTO logitrack.alertes_stock
            (article_id, type_alerte, message, valeur_seuil, valeur_actuelle)
        VALUES (
            v_art.id,
            CASE WHEN v_art.stock_actuel = 0 THEN 'rupture' ELSE 'stock_critique' END,
            format('Article %s - stock %s (seuil : %s)',
                   v_art.reference, v_art.stock_actuel, v_art.stock_minimum),
            v_art.stock_minimum,
            v_art.stock_actuel
        )
        ON CONFLICT DO NOTHING;
    END IF;
    RETURN NEW;
END;
$$;

CREATE TRIGGER trg_alerte_stock
AFTER UPDATE OF stock_actuel ON logitrack.articles
FOR EACH ROW
WHEN (NEW.stock_actuel <> OLD.stock_actuel)
EXECUTE FUNCTION logitrack.fn_generer_alerte_stock();

CREATE OR REPLACE FUNCTION fn_alertes_peremption(jours_avant INT DEFAULT 7)
RETURNS INT LANGUAGE plpgsql AS $$
DECLARE
    nb           INT := 0;
    rec          RECORD;
    jours_restants INT;
BEGIN
    FOR rec IN
        SELECT l.id, l.numero_lot, l.article_id, l.date_peremption,
               a.reference, a.designation
        FROM logitrack.lots l
        JOIN logitrack.articles a ON a.id = l.article_id
        WHERE l.date_peremption IS NOT NULL
          AND l.date_peremption BETWEEN CURRENT_DATE AND CURRENT_DATE + jours_avant
          AND l.quantite > 0
          AND NOT EXISTS (
              SELECT 1 FROM logitrack.alertes_stock al
              WHERE al.article_id = l.article_id
                AND al.type_alerte = 'peremption'
                AND al.acquittee = FALSE
                AND DATE(al.created_at) = CURRENT_DATE
          )
    LOOP
        jours_restants := (rec.date_peremption - CURRENT_DATE)::INT;
        INSERT INTO logitrack.alertes_stock
            (article_id, type_alerte, message, valeur_actuelle)
        VALUES (
            rec.article_id,
            'peremption',
            format('Lot %s (%s) - peremption le %s',
                   rec.numero_lot, rec.designation,
                   TO_CHAR(rec.date_peremption, 'DD/MM/YYYY')),
            jours_restants
        );
        nb := nb + 1;
    END LOOP;
    RETURN nb;
END;
$$;
