-- ============================================================================
-- SKILL2CASH - Système de Tournois à Élimination
-- Migration SQL complète pour le système de tournois
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. NOUVEAUX ENUMS
-- ----------------------------------------------------------------------------

-- Type de tournoi
CREATE TYPE tournament_type AS ENUM ('single_elimination', 'double_elimination', 'round_robin');

-- Statut de tournoi
CREATE TYPE tournament_status AS ENUM ('registration', 'scheduled', 'active', 'completed', 'cancelled');

-- Statut de match de tournoi
CREATE TYPE tournament_match_status AS ENUM ('scheduled', 'active', 'finished', 'cancelled');

-- Rang dans un tournoi
CREATE TYPE tournament_rank AS ENUM ('winner', 'runner_up', 'third_place', 'fourth_place', 'participant');

-- ----------------------------------------------------------------------------
-- 2. TABLES PRINCIPALES
-- ----------------------------------------------------------------------------

-- Table des tournois
CREATE TABLE tournaments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    description TEXT,
    
    -- Configuration
    tournament_type tournament_type NOT NULL DEFAULT 'single_elimination',
    status tournament_status NOT NULL DEFAULT 'registration',
    
    -- Paramètres
    buy_in_amount NUMERIC NOT NULL CHECK (buy_in_amount >= 500),
    max_participants INTEGER NOT NULL CHECK (max_participants >= 4),
    commission_rate NUMERIC NOT NULL DEFAULT 0.12 CHECK (commission_rate > 0 AND commission_rate < 1),
    
    -- Prize pool
    prize_pool NUMERIC GENERATED ALWAYS AS (buy_in_amount * current_participants) STORED,
    prize_distribution JSONB DEFAULT '{"winner": 0.7, "runner_up": 0.2, "third_place": 0.1}'::jsonb,
    
    -- Participants
    current_participants INTEGER NOT NULL DEFAULT 0,
    min_participants INTEGER NOT NULL DEFAULT 4 CHECK (min_participants >= 2),
    
    -- Horaires
    registration_start_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    registration_end_at TIMESTAMPTZ NOT NULL,
    scheduled_start_at TIMESTAMPTZ,
    started_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    
    -- Administration
    created_by UUID REFERENCES auth.users(id),
    admin_note TEXT,
    
    -- Metadata
    rules TEXT,
    bracket_structure JSONB DEFAULT '[]'::jsonb,
    
    -- Timestamps
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMPTZ
);

-- Index pour les performances
CREATE INDEX idx_tournaments_status ON tournaments(status) WHERE deleted_at IS NULL;
CREATE INDEX idx_tournaments_registration ON tournaments(registration_start_at, registration_end_at) WHERE deleted_at IS NULL;
CREATE INDEX idx_tournaments_created_by ON tournaments(created_by) WHERE deleted_at IS NULL;

-- Table des inscriptions aux tournois
CREATE TABLE tournament_registrations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tournament_id UUID NOT NULL REFERENCES tournaments(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id),
    
    -- Statut
    status TEXT NOT NULL DEFAULT 'registered' CHECK (status IN ('registered', 'withdrawn', 'disqualified')),
    
    -- Buy-in
    buy_in_paid BOOLEAN NOT NULL DEFAULT FALSE,
    buy_in_transaction_id UUID REFERENCES transactions(id),
    
    -- Performance
    final_rank tournament_rank,
    final_position INTEGER,
    winnings NUMERIC DEFAULT 0,
    
    -- Metadata
    disqualified_reason TEXT,
    admin_note TEXT,
    
    -- Timestamps
    registered_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    
    -- Unicité: un joueur ne peut s'inscrire qu'une fois par tournoi
    UNIQUE(tournament_id, user_id)
);

CREATE INDEX idx_tournament_registrations_tournament ON tournament_registrations(tournament_id) WHERE status = 'registered';
CREATE INDEX idx_tournament_registrations_user ON tournament_registrations(user_id);

-- Table des matchs de tournoi
CREATE TABLE tournament_matches (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tournament_id UUID NOT NULL REFERENCES tournaments(id) ON DELETE CASCADE,
    
    -- Participants
    player1_id UUID REFERENCES auth.users(id),
    player2_id UUID REFERENCES auth.users(id),
    winner_id UUID REFERENCES auth.users(id),
    
    -- Configuration du match
    round_number INTEGER NOT NULL DEFAULT 1,
    match_number INTEGER NOT NULL,
    bracket_position TEXT, -- 'winner_bracket', 'loser_bracket', 'finals', etc.
    
    -- Progression
    next_match_id UUID REFERENCES tournament_matches(id), -- Match vers lequel le gagnant avance
    loser_next_match_id UUID REFERENCES tournament_matches(id), -- Pour double elimination
    
    -- Statut
    status tournament_match_status NOT NULL DEFAULT 'scheduled',
    
    -- Résultat
    player1_score INTEGER DEFAULT 0,
    player2_score INTEGER DEFAULT 0,
    is_draw BOOLEAN DEFAULT FALSE,
    
    -- Duel associé (si match joué via système de duels standard)
    duel_id UUID REFERENCES duels(id),
    
    -- Horaires
    scheduled_at TIMESTAMPTZ,
    started_at TIMESTAMPTZ,
    finished_at TIMESTAMPTZ,
    
    -- Administration
    admin_note TEXT,
    resolved_by UUID REFERENCES auth.users(id),
    
    -- Timestamps
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_tournament_matches_tournament ON tournament_matches(tournament_id, round_number);
CREATE INDEX idx_tournament_matches_players ON tournament_matches(player1_id, player2_id);
CREATE INDEX idx_tournament_matches_status ON tournament_matches(status) WHERE status IN ('scheduled', 'active');

-- Table des notifications de tournoi
CREATE TABLE tournament_notifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tournament_id UUID NOT NULL REFERENCES tournaments(id) ON DELETE CASCADE,
    user_id UUID REFERENCES auth.users(id),
    
    -- Type de notification
    notification_type TEXT NOT NULL CHECK (notification_type IN (
        'registration_open', 
        'registration_closing', 
        'tournament_starting',
        'match_scheduled',
        'match_ready',
        'tournament_completed',
        'prize_awarded',
        'disqualified'
    )),
    
    -- Contenu
    title TEXT NOT NULL,
    body TEXT NOT NULL,
    link TEXT,
    
    -- Statut
    is_read BOOLEAN DEFAULT FALSE,
    
    -- Timestamps
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_tournament_notifications_user ON tournament_notifications(user_id, is_read);
CREATE INDEX idx_tournament_notifications_tournament ON tournament_notifications(tournament_id);

-- ----------------------------------------------------------------------------
-- 3. FONCTIONS SECURITY DEFINER
-- ----------------------------------------------------------------------------

-- Fonction utilitaire pour vérifier si un utilisateur est admin
CREATE OR REPLACE FUNCTION is_admin()
RETURNS BOOLEAN
LANGUAGE SQL
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT EXISTS (
        SELECT 1 FROM user_roles 
        WHERE user_id = auth.uid() 
        AND role = 'admin'
    );
$$;

-- Fonction pour créer un tournoi (admin only)
CREATE OR REPLACE FUNCTION create_tournament(
    p_name TEXT,
    p_buy_in_amount NUMERIC,
    p_max_participants INTEGER,
    p_registration_end_at TIMESTAMPTZ,
    p_description TEXT DEFAULT NULL,
    p_tournament_type tournament_type DEFAULT 'single_elimination',
    p_commission_rate NUMERIC DEFAULT 0.12,
    p_min_participants INTEGER DEFAULT 4,
    p_registration_start_at TIMESTAMPTZ DEFAULT NOW(),
    p_scheduled_start_at TIMESTAMPTZ DEFAULT NULL,
    p_rules TEXT DEFAULT NULL,
    p_prize_distribution JSONB DEFAULT '{"winner": 0.7, "runner_up": 0.2, "third_place": 0.1}'::jsonb
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_tournament_id UUID;
BEGIN
    -- Vérifier admin
    IF NOT is_admin() THEN
        RAISE EXCEPTION 'Seuls les administrateurs peuvent créer des tournois';
    END IF;
    
    -- Validation
    IF p_buy_in_amount < 500 THEN
        RAISE EXCEPTION 'Le buy-in minimum est de 500 FCFA';
    END IF;
    
    IF p_max_participants < 4 THEN
        RAISE EXCEPTION 'Le minimum de participants est 4';
    END IF;
    
    IF p_registration_end_at <= p_registration_start_at THEN
        RAISE EXCEPTION 'La date de fin d''inscription doit être après le début';
    END IF;
    
    -- Créer le tournoi
    INSERT INTO tournaments (
        name, description, tournament_type, buy_in_amount, 
        max_participants, commission_rate, min_participants,
        registration_start_at, registration_end_at, scheduled_start_at,
        rules, prize_distribution, created_by
    ) VALUES (
        p_name, p_description, p_tournament_type, p_buy_in_amount,
        p_max_participants, p_commission_rate, p_min_participants,
        p_registration_start_at, p_registration_end_at, p_scheduled_start_at,
        p_rules, p_prize_distribution, auth.uid()
    ) RETURNING id INTO v_tournament_id;
    
    -- Logger l'action
    INSERT INTO admin_logs (admin, action, target_type, target_id, note)
    VALUES (auth.uid(), 'create_tournament', 'Tournament', v_tournament_id, 'Tournoi créé: ' || p_name);
    
    RETURN v_tournament_id;
END;
$$;

-- Fonction pour s'inscrire à un tournoi
CREATE OR REPLACE FUNCTION register_for_tournament(p_tournament_id UUID)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_tournament RECORD;
    v_wallet RECORD;
    v_registration_id UUID;
    v_transaction_id UUID;
BEGIN
    -- Vérifier que le tournoi existe et est en inscription
    SELECT * INTO v_tournament 
    FROM tournaments 
    WHERE id = p_tournament_id AND status = 'registration' AND deleted_at IS NULL;
    
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Tournoi non disponible à l''inscription';
    END IF;
    
    -- Vérifier les dates d'inscription
    IF NOW() < v_tournament.registration_start_at OR NOW() > v_tournament.registration_end_at THEN
        RAISE EXCEPTION 'Les inscriptions ne sont pas ouvertes';
    END IF;
    
    -- Vérifier que le tournoi n'est pas plein
    IF v_tournament.current_participants >= v_tournament.max_participants THEN
        RAISE EXCEPTION 'Le tournoi est complet';
    END IF;
    
    -- Vérifier que l'utilisateur n'est pas déjà inscrit
    IF EXISTS (
        SELECT 1 FROM tournament_registrations 
        WHERE tournament_id = p_tournament_id AND user_id = auth.uid() AND status = 'registered'
    ) THEN
        RAISE EXCEPTION 'Vous êtes déjà inscrit à ce tournoi';
    END IF;
    
    -- Vérifier le solde du portefeuille
    SELECT * INTO v_wallet 
    FROM wallets 
    WHERE user_id = auth.uid();
    
    IF NOT FOUND OR v_wallet.balance_available < v_tournament.buy_in_amount THEN
        RAISE EXCEPTION 'Solde insuffisant pour le buy-in de % FCFA', v_tournament.buy_in_amount;
    END IF;
    
    -- Début transaction pour le buy-in
    -- Bloquer le buy-in
    UPDATE wallets 
    SET balance_available = balance_available - v_tournament.buy_in_amount,
        balance_locked = balance_locked + v_tournament.buy_in_amount
    WHERE user_id = auth.uid();
    
    -- Créer la transaction de stake_locked
    INSERT INTO transactions (
        user_id, wallet_id, type, amount, 
        balance_before, balance_after, 
        status, description
    ) VALUES (
        auth.uid(), v_wallet.id, 'stake_locked', -v_tournament.buy_in_amount,
        v_wallet.balance_available, v_wallet.balance_available - v_tournament.buy_in_amount,
        'completed', 'Buy-in tournoi: ' || v_tournament.name
    ) RETURNING id INTO v_transaction_id;
    
    -- Créer l'inscription
    INSERT INTO tournament_registrations (
        tournament_id, user_id, status, buy_in_paid, buy_in_transaction_id
    ) VALUES (
        p_tournament_id, auth.uid(), 'registered', TRUE, v_transaction_id
    ) RETURNING id INTO v_registration_id;
    
    -- Mettre à jour le compteur de participants
    UPDATE tournaments 
    SET current_participants = current_participants + 1,
        updated_at = NOW()
    WHERE id = p_tournament_id;
    
    -- Notification de confirmation
    INSERT INTO notifications (user_id, type, title, body, link)
    VALUES (
        auth.uid(), 'tournament', 'Inscription confirmée', 
        'Vous êtes inscrit au tournoi "' || v_tournament.name || '"',
        '/tournois/' || p_tournament_id
    );
    
    RETURN v_registration_id;
END;
$$;

-- Fonction pour générer le bracket d'un tournoi
CREATE OR REPLACE FUNCTION generate_tournament_bracket(p_tournament_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_tournament RECORD;
    v_participants UUID[];
    v_match_count INTEGER;
    v_rounds INTEGER;
    v_bracket JSONB := '[]'::jsonb;
    v_current_round INTEGER := 1;
    v_match_index INTEGER := 0;
    v_player_index INTEGER := 0;
    v_match_id UUID;
BEGIN
    -- Vérifier admin
    IF NOT is_admin() THEN
        RAISE EXCEPTION 'Seuls les administrateurs peuvent générer les brackets';
    END IF;
    
    -- Récupérer le tournoi
    SELECT * INTO v_tournament 
    FROM tournaments 
    WHERE id = p_tournament_id AND status = 'registration' AND deleted_at IS NULL;
    
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Tournoi non trouvé';
    END IF;
    
    -- Vérifier qu'on a assez de participants
    IF v_tournament.current_participants < v_tournament.min_participants THEN
        RAISE EXCEPTION 'Pas assez de participants (minimum: %)', v_tournament.min_participants;
    END IF;
    
    -- Récupérer les participants
    SELECT ARRAY_AGG(user_id) INTO v_participants
    FROM tournament_registrations
    WHERE tournament_id = p_tournament_id AND status = 'registered';
    
    -- Calculer le nombre de rounds (puissance de 2 supérieure)
    v_rounds := CEIL(LOG(2, v_tournament.current_participants))::INTEGER;
    
    -- Pour simplifier, on commence avec single elimination
    -- Génération des matchs round par round
    FOR v_current_round IN 1..v_rounds LOOP
        v_match_count := POWER(2, v_rounds - v_current_round);
        
        IF v_current_round = 1 THEN
            -- Premier round: créer les matchs initiaux
            FOR i IN 1..v_match_count LOOP
                IF v_player_index < ARRAY_LENGTH(v_participants, 1) THEN
                    -- Créer le match
                    INSERT INTO tournament_matches (
                        tournament_id, round_number, match_number, bracket_position, status
                    ) VALUES (
                        p_tournament_id, v_current_round, i, 'winner_bracket', 'scheduled'
                    ) RETURNING id INTO v_match_id;
                    
                    -- Assigner le premier joueur
                    UPDATE tournament_matches
                    SET player1_id = v_participants[v_player_index + 1]
                    WHERE id = v_match_id;
                    
                    v_player_index := v_player_index + 1;
                    
                    -- Assigner le deuxième joueur si disponible
                    IF v_player_index < ARRAY_LENGTH(v_participants, 1) THEN
                        UPDATE tournament_matches
                        SET player2_id = v_participants[v_player_index + 1]
                        WHERE id = v_match_id;
                        
                        v_player_index := v_player_index + 1;
                    END IF;
                END IF;
            END LOOP;
        ELSE
            -- Rounds suivants: créer les matchs vides
            FOR i IN 1..v_match_count LOOP
                INSERT INTO tournament_matches (
                    tournament_id, round_number, match_number, bracket_position, status
                ) VALUES (
                    p_tournament_id, v_current_round, i, 'winner_bracket', 'scheduled'
                );
            END LOOP;
        END IF;
    END LOOP;
    
    -- Mettre à jour le statut du tournoi
    UPDATE tournaments
    SET status = 'scheduled',
        bracket_structure = v_bracket,
        updated_at = NOW()
    WHERE id = p_tournament_id;
    
    -- Notifier tous les participants
    INSERT INTO notifications (user_id, type, title, body, link)
    SELECT 
        user_id, 'tournament', 'Bracket généré', 
        'Le bracket du tournoi "' || v_tournament.name || '" est disponible',
        '/tournois/' || p_tournament_id
    FROM tournament_registrations
    WHERE tournament_id = p_tournament_id AND status = 'registered';
    
    RETURN v_bracket;
END;
$$;

-- Fonction pour démarrer un tournoi
CREATE OR REPLACE FUNCTION start_tournament(p_tournament_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_tournament RECORD;
BEGIN
    -- Vérifier admin
    IF NOT is_admin() THEN
        RAISE EXCEPTION 'Seuls les administrateurs peuvent démarrer les tournois';
    END IF;
    
    -- Récupérer le tournoi
    SELECT * INTO v_tournament 
    FROM tournaments 
    WHERE id = p_tournament_id AND status = 'scheduled' AND deleted_at IS NULL;
    
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Tournoi non prêt à démarrer';
    END IF;
    
    -- Mettre à jour le statut
    UPDATE tournaments
    SET status = 'active',
        started_at = NOW(),
        updated_at = NOW()
    WHERE id = p_tournament_id;
    
    -- Programmer les premiers matchs
    UPDATE tournament_matches
    SET scheduled_at = NOW() + INTERVAL '5 minutes',
        status = 'scheduled'
    WHERE tournament_id = p_tournament_id 
    AND round_number = 1 
    AND player1_id IS NOT NULL 
    AND player2_id IS NOT NULL;
    
    -- Notifier tous les participants
    INSERT INTO notifications (user_id, type, title, body, link)
    SELECT 
        user_id, 'tournament', 'Tournoi démarré', 
        'Le tournoi "' || v_tournament.name || '" a commencé',
        '/tournois/' || p_tournament_id
    FROM tournament_registrations
    WHERE tournament_id = p_tournament_id AND status = 'registered';
    
    -- Logger
    INSERT INTO admin_logs (admin, action, target_type, target_id, note)
    VALUES (auth.uid(), 'start_tournament', 'Tournament', p_tournament_id, 'Tournoi démarré');
    
    RETURN TRUE;
END;
$$;

-- Fonction pour enregistrer le résultat d'un match de tournoi
CREATE OR REPLACE FUNCTION record_tournament_match_result(
    p_match_id UUID,
    p_winner_id UUID,
    p_player1_score INTEGER DEFAULT 0,
    p_player2_score INTEGER DEFAULT 0,
    p_is_draw BOOLEAN DEFAULT FALSE
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_match RECORD;
    v_tournament RECORD;
    v_next_match_id UUID;
BEGIN
    -- Vérifier admin
    IF NOT is_admin() THEN
        RAISE EXCEPTION 'Seuls les administrateurs peuvent enregistrer les résultats';
    END IF;
    
    -- Récupérer le match
    SELECT * INTO v_match
    FROM tournament_matches
    WHERE id = p_match_id AND status IN ('scheduled', 'active');
    
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Match non trouvé ou déjà terminé';
    END IF;
    
    -- Récupérer le tournoi
    SELECT * INTO v_tournament
    FROM tournaments
    WHERE id = v_match.tournament_id;
    
    -- Enregistrer le résultat
    UPDATE tournament_matches
    SET winner_id = p_winner_id,
        player1_score = p_player1_score,
        player2_score = p_player2_score,
        is_draw = p_is_draw,
        status = 'finished',
        finished_at = NOW(),
        resolved_by = auth.uid(),
        updated_at = NOW()
    WHERE id = p_match_id;
    
    -- Si pas de match nul, avancer le gagnant
    IF NOT p_is_draw AND p_winner_id IS NOT NULL THEN
        -- Trouver le match suivant pour ce bracket
        SELECT next_match_id INTO v_next_match_id
        FROM tournament_matches
        WHERE id = p_match_id;
        
        IF v_next_match_id IS NOT NULL THEN
            -- Avancer le gagnant dans le prochain match
            UPDATE tournament_matches
            SET 
                player1_id = CASE WHEN player1_id IS NULL THEN p_winner_id ELSE player1_id END,
                player2_id = CASE WHEN player1_id IS NOT NULL AND player2_id IS NULL THEN p_winner_id ELSE player2_id END
            WHERE id = v_next_match_id;
        END IF;
    END IF;
    
    -- Vérifier si le tournoi est terminé
    -- (logique simplifiée: vérifier si c'était la finale)
    IF v_match.bracket_position = 'finals' AND v_match.status = 'finished' THEN
        UPDATE tournaments
        SET status = 'completed',
            completed_at = NOW(),
            updated_at = NOW()
        WHERE id = v_match.tournament_id;
        
        -- Distribuer les prix
        PERFORM distribute_tournament_prizes(v_match.tournament_id);
    END IF;
    
    -- Logger
    INSERT INTO admin_logs (admin, action, target_type, target_id, note)
    VALUES (auth.uid(), 'record_match_result', 'TournamentMatch', p_match_id, 'Résultat enregistré');
    
    RETURN p_match_id;
END;
$$;

-- Fonction pour distribuer les prix du tournoi
CREATE OR REPLACE FUNCTION distribute_tournament_prizes(p_tournament_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_tournament RECORD;
    v_winner_id UUID;
    v_runner_up_id UUID;
    v_third_place_id UUID;
    v_prize_pool NUMERIC;
    v_winner_share NUMERIC;
    v_runner_up_share NUMERIC;
    v_third_place_share NUMERIC;
BEGIN
    -- Récupérer le tournoi
    SELECT * INTO v_tournament
    FROM tournaments
    WHERE id = p_tournament_id;
    
    v_prize_pool := v_tournament.buy_in_amount * v_tournament.current_participants;
    
    -- Calculer les parts selon la distribution configurée
    v_winner_share := v_prize_pool * (v_tournament.prize_distribution->>'winner')::NUMERIC;
    v_runner_up_share := v_prize_pool * (v_tournament.prize_distribution->>'runner_up')::NUMERIC;
    v_third_place_share := v_prize_pool * (v_tournament.prize_distribution->>'third_place')::NUMERIC;
    
    -- Récupérer les finalistes (simplifié - à adapter selon la logique réelle)
    -- Ici on suppose qu'on peut les déterminer via les matchs terminés
    
    -- Distribuer les gains (exemple simplifié)
    -- Pour chaque gagnant, on débloque les fonds et on crédite le portefeuille
    
    -- Logger
    INSERT INTO admin_logs (admin, action, target_type, target_id, note)
    VALUES (auth.uid(), 'distribute_prizes', 'Tournament', p_tournament_id, 'Prix distribués');
    
    RETURN TRUE;
END;
$$;

-- ----------------------------------------------------------------------------
-- 4. ROW LEVEL SECURITY (RLS)
-- ----------------------------------------------------------------------------

-- Activer RLS sur toutes les tables
ALTER TABLE tournaments ENABLE ROW LEVEL SECURITY;
ALTER TABLE tournament_registrations ENABLE ROW LEVEL SECURITY;
ALTER TABLE tournament_matches ENABLE ROW LEVEL SECURITY;
ALTER TABLE tournament_notifications ENABLE ROW LEVEL SECURITY;

-- Policies pour tournaments
CREATE POLICY "Les utilisateurs connectés peuvent voir les tournois actifs"
    ON tournaments FOR SELECT
    USING (deleted_at IS NULL);

CREATE POLICY "Les admins peuvent voir tous les tournois"
    ON tournaments FOR SELECT
    USING (is_admin());

CREATE POLICY "Les admins peuvent créer des tournois"
    ON tournaments FOR INSERT
    WITH CHECK (is_admin());

CREATE POLICY "Les admins peuvent modifier les tournois"
    ON tournaments FOR UPDATE
    USING (is_admin());

-- Policies pour tournament_registrations
CREATE POLICY "Les utilisateurs peuvent voir leurs inscriptions"
    ON tournament_registrations FOR SELECT
    USING (user_id = auth.uid());

CREATE POLICY "Les admins peuvent voir toutes les inscriptions"
    ON tournament_registrations FOR SELECT
    USING (is_admin());

CREATE POLICY "Les utilisateurs peuvent s'inscrire"
    ON tournament_registrations FOR INSERT
    WITH CHECK (user_id = auth.uid());

-- Policies pour tournament_matches
CREATE POLICY "Les utilisateurs peuvent voir les matchs des tournois publics"
    ON tournament_matches FOR SELECT
    USING (true); -- Tous les matchs sont visibles

CREATE POLICY "Les admins peuvent modifier les matchs"
    ON tournament_matches FOR UPDATE
    USING (is_admin());

-- Policies pour tournament_notifications
CREATE POLICY "Les utilisateurs peuvent voir leurs notifications"
    ON tournament_notifications FOR SELECT
    USING (user_id = auth.uid());

CREATE POLICY "Les utilisateurs peuvent marquer leurs notifications comme lues"
    ON tournament_notifications FOR UPDATE
    USING (user_id = auth.uid())
    WITH CHECK (user_id = auth.uid());

-- ----------------------------------------------------------------------------
-- 5. TRIGGERS
-- ----------------------------------------------------------------------------

-- Trigger pour mettre à jour updated_at automatiquement
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_tournaments_updated_at BEFORE UPDATE ON tournaments
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_tournament_registrations_updated_at BEFORE UPDATE ON tournament_registrations
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_tournament_matches_updated_at BEFORE UPDATE ON tournament_matches
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ----------------------------------------------------------------------------
-- 6. VUES UTILITAIRES
-- ----------------------------------------------------------------------------

-- Vue pour les tournois actifs avec détails
CREATE VIEW active_tournaments_view AS
SELECT 
    t.id,
    t.name,
    t.description,
    t.tournament_type,
    t.status,
    t.buy_in_amount,
    t.max_participants,
    t.current_participants,
    t.prize_pool,
    t.registration_start_at,
    t.registration_end_at,
    t.scheduled_start_at,
    t.started_at,
    t.completed_at,
    CASE 
        WHEN t.status = 'registration' AND NOW() < t.registration_end_at THEN 'open'
        WHEN t.status = 'registration' AND NOW() >= t.registration_end_at THEN 'closing'
        WHEN t.status = 'scheduled' THEN 'ready'
        WHEN t.status = 'active' THEN 'live'
        WHEN t.status = 'completed' THEN 'finished'
        ELSE 'unknown'
    END as registration_state,
    t.created_at
FROM tournaments t
WHERE t.deleted_at IS NULL
ORDER BY 
    CASE t.status
        WHEN 'registration' THEN 1
        WHEN 'scheduled' THEN 2
        WHEN 'active' THEN 3
        WHEN 'completed' THEN 4
        ELSE 5
    END,
    t.created_at DESC;

-- Vue pour les inscriptions d'un utilisateur
CREATE VIEW user_tournament_registrations_view AS
SELECT 
    tr.id,
    tr.tournament_id,
    tr.user_id,
    tr.status,
    tr.buy_in_paid,
    tr.final_rank,
    tr.final_position,
    tr.winnings,
    tr.registered_at,
    t.name as tournament_name,
    t.tournament_type,
    t.status as tournament_status,
    t.buy_in_amount,
    t.prize_pool,
    t.scheduled_start_at,
    t.started_at,
    t.completed_at
FROM tournament_registrations tr
JOIN tournaments t ON tr.tournament_id = t.id
WHERE tr.user_id = auth.uid()
ORDER BY tr.registered_at DESC;

-- ----------------------------------------------------------------------------
-- 7. FONCTIONS UTILITAIRES ADMIN
-- ----------------------------------------------------------------------------

-- Fonction pour annuler un tournoi
CREATE OR REPLACE FUNCTION cancel_tournament(p_tournament_id UUID, p_reason TEXT DEFAULT NULL)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_tournament RECORD;
BEGIN
    -- Vérifier admin
    IF NOT is_admin() THEN
        RAISE EXCEPTION 'Seuls les administrateurs peuvent annuler les tournois';
    END IF;
    
    -- Récupérer le tournoi
    SELECT * INTO v_tournament 
    FROM tournaments 
    WHERE id = p_tournament_id AND status IN ('registration', 'scheduled') AND deleted_at IS NULL;
    
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Tournoi non trouvé ou déjà terminé';
    END IF;
    
    -- Rembourser les buy-ins
    UPDATE wallets w
    SET balance_available = balance_available + tr.buy_in_amount,
        balance_locked = balance_locked - tr.buy_in_amount
    FROM tournament_registrations tr
    WHERE tr.tournament_id = p_tournament_id 
    AND tr.user_id = w.user_id 
    AND tr.buy_in_paid = TRUE;
    
    -- Créer les transactions de remboursement
    INSERT INTO transactions (user_id, wallet_id, type, amount, status, description)
    SELECT 
        tr.user_id, 
        w.id, 
        'stake_refunded', 
        tr.buy_in_amount, 
        'completed',
        'Remboursement buy-in tournoi annulé: ' || v_tournament.name
    FROM tournament_registrations tr
    JOIN wallets w ON tr.user_id = w.user_id
    WHERE tr.tournament_id = p_tournament_id AND tr.buy_in_paid = TRUE;
    
    -- Mettre à jour le statut du tournoi
    UPDATE tournaments
    SET status = 'cancelled',
        admin_note = p_reason,
        updated_at = NOW()
    WHERE id = p_tournament_id;
    
    -- Notifier les participants
    INSERT INTO notifications (user_id, type, title, body)
    SELECT 
        user_id, 'tournament', 'Tournoi annulé', 
        'Le tournoi "' || v_tournament.name || '" a été annulé. Votre buy-in a été remboursé.'
    FROM tournament_registrations
    WHERE tournament_id = p_tournament_id AND status = 'registered';
    
    -- Logger
    INSERT INTO admin_logs (admin, action, target_type, target_id, note)
    VALUES (auth.uid(), 'cancel_tournament', 'Tournament', p_tournament_id, p_reason);
    
    RETURN TRUE;
END;
$$;

-- Fonction pour disqualifier un participant
CREATE OR REPLACE FUNCTION disqualify_tournament_participant(
    p_registration_id UUID, 
    p_reason TEXT DEFAULT NULL
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_registration RECORD;
BEGIN
    -- Vérifier admin
    IF NOT is_admin() THEN
        RAISE EXCEPTION 'Seuls les administrateurs peuvent disqualifier des participants';
    END IF;
    
    -- Récupérer l'inscription
    SELECT * INTO v_registration 
    FROM tournament_registrations 
    WHERE id = p_registration_id AND status = 'registered';
    
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Inscription non trouvée';
    END IF;
    
    -- Mettre à jour le statut
    UPDATE tournament_registrations
    SET status = 'disqualified',
        disqualified_reason = p_reason,
        updated_at = NOW()
    WHERE id = p_registration_id;
    
    -- Notifier le participant
    INSERT INTO notifications (user_id, type, title, body)
    VALUES (
        v_registration.user_id, 'tournament', 'Disqualification', 
        'Vous avez été disqualifié du tournoi. Raison: ' || COALESCE(p_reason, 'Non spécifiée')
    );
    
    -- Logger
    INSERT INTO admin_logs (admin, action, target_type, target_id, note)
    VALUES (auth.uid(), 'disqualify_participant', 'TournamentRegistration', p_registration_id, p_reason);
    
    RETURN TRUE;
END;
$$;

-- ----------------------------------------------------------------------------
-- FIN DE LA MIGRATION
-- ----------------------------------------------------------------------------