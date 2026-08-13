# PROMPT MAÎTRE — Recréer SKILL2CASH (plateforme de duels eFootball 1v1 en argent réel)

> Copie-colle ce prompt tel quel à une autre IA de développement (Lovable, Cursor, Claude Code…).
> Tout doit être livré **en français** (interface, messages d'erreur, notifications, emails).

## 1. Mission

Construis **SKILL2CASH**, une plateforme web où des joueurs d'eFootball s'affrontent en 1v1 avec une
mise d'argent réel en **FCFA (XOF)**. Le gagnant empoche le pot moins la commission de la plateforme.
Slogan : « NO SKILL. NO CASH. »

Stack imposée : **TanStack Start v1 (React 19) + Vite 7 + Tailwind v4 + PostgreSQL (Supabase/Lovable
Cloud) avec RLS + Realtime Postgres**. Toute la logique d'argent vit dans des **fonctions SQL
SECURITY DEFINER** appelées en RPC — jamais dans le client. Pas d'Express, MongoDB, Socket.io ni Redis.

## 2. Design system

Cyberpunk : fond quasi noir, néon cyan (primaire), vert acide (accent), magenta (alerte). Polices
`Orbitron` (titres) et `Rajdhani` (corps). Tokens couleur sémantiques en oklch dans `src/styles.css`
(jamais de `text-white`/`bg-[#...]` dans les composants). Utilitaires : `panel`, `clip-corner`
(angles coupés), `text-glow`, `grid-lines`, animation `scanline`.

## 3. Modèle de données (schéma `public`, RLS activée + GRANT sur chaque table)

Enums : `app_role(player,admin)`, `user_level(Amateur,Pro,Elite)`, `user_status(active,suspended,banned)`,
`challenge_status(pending,counter_offer,accepted,declined,cancelled,expired)`,
`duel_status(active,waiting_votes,finished,dispute,cancelled)`, `duel_vote(win,draw,lose)`,
`payment_method(Wave,MTN)`, `request_status(pending,approved,rejected)`,
`tx_type(deposit,withdrawal,stake_locked,stake_refunded,win,loss,commission,adjustment)`,
`tx_status`, `commission_type(small,medium,high,tournament)`.

Tables :
- `profiles` (id → auth.users, username unique, efootball_username, first_name, last_name, country
  défaut « Cote d'Ivoire », level, status, rank, badge, wins/losses/draws, current_streak,
  total_earnings, reputation 100, reports_count, is_banned, deleted_at, timestamps).
- `user_roles` (user_id, role) — **jamais** de rôle sur `profiles`. Fonction `has_role(uuid, app_role)`
  SECURITY DEFINER + `is_admin()` pour les policies (évite la récursion RLS).
- `wallets` (user_id, balance_available, balance_locked, total_deposited/withdrawn/won/lost).
- `transactions` (type, amount, balance_before/after, description, related_duel/deposit/withdrawal).
- `deposits` (amount, method, sender_name, sender_phone, reference unique, screenshot, status,
  fraud_score, fraud_flags[], admin_note, reviewed_by/at).
- `withdrawals` (amount, method, phone_number, net_amount, status, fraud_score, fraud_flags[], review).
- `challenges` (challenger_id, challenged_id, amount, accepted_amount, status, expires_at, duel_id).
- `duels` (player1_id, player2_id, amount, commission_rate, commission_amount, status, challenge_id,
  player1_vote/player2_vote + horodatages, winner_id, loser_id, is_draw, dispute_reason,
  manual_review_requested_at/due_at, resolved_by, admin_note, finished_at).
- `duel_messages` (duel_id, sender_id, body) — chat de la salle de duel.
- `conversations` (user_low < user_high, unique, last_message_at, last_message_preview) et
  `direct_messages` (conversation_id, sender_id, body, read_at) — messagerie privée style Facebook.
- `commission_settings`, `admin_logs`, `username_change_requests`, `notifications`
  (user_id nullable + `is_admin_notice`, type, title, body, link, is_read).

Policies : chacun ne voit que ses données (`auth.uid()`), les admins voient tout via `is_admin()`,
`profiles` est lisible par tous les connectés, les tables d'argent sont **en écriture interdite** au
client (seuls les RPC écrivent). Realtime activé sur `duel_messages`, `duels`, `challenges`,
`notifications`, `conversations`, `direct_messages`.

## 4. Règles métier (à implémenter en SQL, transactions + `FOR UPDATE`)

- **Commission dynamique** `get_commission_rate(montant)` : 9 % petites mises, 8 % moyennes, 5 %
  grosses mises (paramétrable dans `commission_settings`, défaut 8 %).
- **Défi** `create_challenge(adversaire, montant, minutes)` : refuse l'auto-défi, le compte banni,
  le solde insuffisant ; expire automatiquement. `respond_challenge(defi, action, contre_montant)`
  gère `accept | decline | counter | cancel`.
- **Acceptation** : crée le duel `active`, déplace la mise des deux joueurs de `balance_available`
  vers `balance_locked`, écrit deux transactions `stake_locked`, notifie les deux joueurs.
- **Vote de consensus** `submit_duel_vote(duel, win|draw|lose)` : un seul vote par joueur.
  - win/lose cohérent → règlement immédiat : gagnant reçoit `2×mise − commission`, stats et
    portefeuilles mis à jour, **la salle se ferme automatiquement** (`finished`).
  - nul/nul → chaque joueur récupère `mise − commission/2`.
  - votes incohérents → statut `dispute`, délai d'arbitrage 24 h, notification aux admins.
- **Litige** `open_duel_dispute(duel, motif)` par un joueur.
- **File automatique** `process_settlement_queue()` (cron toutes les 10 min via `pg_cron`) :
  expire les défis, applique le forfait après 24 h sans vote adverse, annule et remboursement
  intégral des litiges non arbitrés dans le délai — avec notification explicative aux deux joueurs
  et entrée dans `admin_logs`.
- **Dépôts manuels** : le joueur envoie l'argent (Wave / MTN) au numéro officiel de la plateforme
  **+225 01 00 15 05 93**, puis déclare le dépôt avec référence via `create_deposit(...)` (référence
  unique, scoring de fraude). Un admin valide → crédit du portefeuille.
- **Retraits** `create_withdrawal(...)` : minimum 1 000 FCFA, une seule demande en attente, fonds
  immédiatement verrouillés ; refus = restitution automatique.
- **Salle de duel fermée après les deux votes** : côté SQL la policy d'insertion de `duel_messages`
  n'autorise l'écriture que si `status ∈ (active, waiting_votes, dispute)` ; côté UI, chat en lecture
  seule et votes masqués dès `finished`/`cancelled`.
- **Messagerie privée** : `start_conversation(autre)`, `send_direct_message(conversation, texte)`
  (notifie le destinataire), `mark_conversation_read(conversation)`. Accessible seulement aux deux
  participants.
- **Admins** : `list_admins()` expose la liste des administrateurs (pseudo, niveau, badge, pays) aux
  membres connectés. Les comptes `onexdelux@gmail.com` et `jeaneric9610@gmail.com` reçoivent le rôle
  `admin` et le badge `FONDATEUR` automatiquement à l'inscription (trigger `handle_new_user`, qui crée
  aussi le profil, le portefeuille et le rôle `player`).
- **Outils admin** (tous SECURITY DEFINER + `_require_admin()` + journalisation) :
  `admin_review_deposit`, `admin_review_withdrawal`, `admin_resolve_dispute(winner|draw|cancel|
  cancel_no_refund)`, `admin_ban_user`, `admin_adjust_balance`, `admin_review_username_change`.

## 5. Pages (toutes en français, SEO propre : titre unique < 60 car., description < 160 car., og/twitter)

Publiques : `/` landing (hero cyberpunk, 4 étapes Recharge → Défie → Vote → Encaisse, garanties de
sécurité) ; `/auth` connexion + inscription (email/mot de passe **et** Google OAuth) avec pseudo
eFootball, pays, niveau.

Protégées (layout `_authenticated` avec garde d'auth, en-tête affichant le solde en direct et un
centre de notifications temps réel) :
`/tableau-de-bord` (solde, fonds bloqués, bilan V/N/D, duels en cours, défis, dernières opérations,
historique des notifications) · `/joueurs` (recherche, stats, boutons « Défier » et « Message ») ·
`/defis` (reçus/envoyés : accepter, refuser, contre-offre, annuler) · `/duels` (en cours /
historique) · `/duels/$id` salle de duel (chat temps réel, vote Gagné/Nul/Perdu, litige, fermeture
auto) · `/messages` messagerie style Facebook (liste des conversations avec aperçu et badge non lus,
fil de discussion en bulles, recherche de joueur, temps réel) · `/portefeuille` (dépôt avec numéro
officiel, retrait, historiques) · `/classement` (top 100 par gains) · `/profil` (stats, réputation,
demande de changement de pseudo) · `/assistant` (chat IA en français sur les règles de la plateforme)
· `/admin` (dépôts, retraits, litiges, pseudos, comptes, **liste des administrateurs**).

## 6. Qualité exigée

Interface responsive mobile-first ; erreurs Postgres traduites en messages clairs (`errMessage`) ;
`sonner` pour les toasts ; TanStack Query pour tout le chargement de données ; abonnements Realtime
nettoyés dans les `useEffect` ; aucun secret côté client ; jamais de rôle stocké côté client ;
montants toujours formatés `x xxx FCFA`.
