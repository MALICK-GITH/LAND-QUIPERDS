# 🏆 Système de Tournois - SKILL2CASH

Documentation complète du système de tournois à élimination pour la plateforme SKILL2CASH.

## 📋 Vue d'ensemble

Le système de tournois permet d'organiser des compétitions d'eFootball avec :
- **Buy-in** obligatoire (mise d'entrée)
- **Prize pool** distribué aux gagnants
- **Structure à élimination** (simple, double, ou round robin)
- **Brackets visuels** pour suivre la progression
- **Gestion admin complète** pour la supervision

## 🗄️ Architecture de Données

### Tables Principales

#### `tournaments`
Table principale des tournois avec toutes les configurations :
- `id`: UUID unique
- `name`: Nom du tournoi
- `description`: Description détaillée
- `tournament_type`: Type (single_elimination, double_elimination, round_robin)
- `status`: État (registration, scheduled, active, completed, cancelled)
- `buy_in_amount`: Montant du buy-in en FCFA
- `max_participants`: Nombre maximum de participants
- `commission_rate`: Taux de commission (0.12 = 12%)
- `prize_pool`: Prize pool calculé automatiquement
- `prize_distribution`: Distribution des prix (JSON)
- `current_participants`: Nombre actuel de participants
- `min_participants`: Minimum de participants requis
- `registration_start_at`: Début des inscriptions
- `registration_end_at`: Fin des inscriptions
- `scheduled_start_at`: Début programmé du tournoi
- `started_at`: Heure réelle de début
- `completed_at`: Heure de fin
- `created_by`: ID de l'admin créateur
- `admin_note`: Notes admin
- `rules`: Règles spécifiques
- `bracket_structure`: Structure du bracket (JSON)
- `created_at`, `updated_at`, `deleted_at`: Timestamps

#### `tournament_registrations`
Inscriptions des joueurs aux tournois :
- `id`: UUID unique
- `tournament_id`: Référence au tournoi
- `user_id`: ID du joueur
- `status`: État (registered, withdrawn, disqualified)
- `buy_in_paid`: Si le buy-in a été payé
- `buy_in_transaction_id`: Référence à la transaction
- `final_rank`: Rang final (winner, runner_up, etc.)
- `final_position`: Position numérique
- `winnings`: Gains du joueur
- `disqualified_reason`: Raison de disqualification
- `admin_note`: Notes admin
- `registered_at`: Date d'inscription
- `updated_at`: Dernière mise à jour

#### `tournament_matches`
Matchs individuels du tournoi :
- `id`: UUID unique
- `tournament_id`: Référence au tournoi
- `player1_id`: Premier joueur
- `player2_id`: Deuxième joueur
- `winner_id`: Vainqueur du match
- `round_number`: Numéro du round
- `match_number`: Numéro du match dans le round
- `bracket_position`: Position dans le bracket
- `next_match_id`: Match suivant pour le gagnant
- `loser_next_match_id`: Match suivant pour le perdant (double elimination)
- `status`: État (scheduled, active, finished, cancelled)
- `player1_score`: Score du joueur 1
- `player2_score`: Score du joueur 2
- `is_draw`: Si match nul
- `duel_id`: Référence au duel standard (optionnel)
- `scheduled_at`: Heure programmée
- `started_at`: Heure de début
- `finished_at`: Heure de fin
- `admin_note`: Notes admin
- `resolved_by`: Admin qui a enregistré le résultat
- `created_at`, `updated_at`: Timestamps

#### `tournament_notifications`
Notifications spécifiques aux tournois :
- `id`: UUID unique
- `tournament_id`: Référence au tournoi
- `user_id`: Destinataire (null pour tous)
- `notification_type`: Type de notification
- `title`: Titre
- `body`: Corps du message
- `link`: Lien vers la page concernée
- `is_read`: Si lu
- `created_at`: Date de création

### Enums

#### `tournament_type`
- `single_elimination`: Élimination simple
- `double_elimination`: Élimination double
- `round_robin`: Round robin (tous contre tous)

#### `tournament_status`
- `registration`: Inscriptions ouvertes
- `scheduled`: Programmé, bracket généré
- `active`: En cours
- `completed`: Terminé
- `cancelled`: Annulé

#### `tournament_match_status`
- `scheduled`: Programmé
- `active`: En cours
- `finished`: Terminé
- `cancelled`: Annulé

#### `tournament_rank`
- `winner`: Vainqueur
- `runner_up`: Finaliste
- `third_place`: 3ème place
- `fourth_place`: 4ème place
- `participant`: Participant

## 🔧 Fonctions SQL SECURITY DEFINER

### `create_tournament()`
Crée un nouveau tournoi (admin uniquement).

**Paramètres :**
- `p_name`: Nom du tournoi
- `p_description`: Description (optionnel)
- `p_tournament_type`: Type de tournoi
- `p_buy_in_amount`: Montant du buy-in
- `p_max_participants`: Max participants
- `p_commission_rate`: Taux de commission
- `p_min_participants`: Min participants
- `p_registration_start_at`: Début inscriptions
- `p_registration_end_at`: Fin inscriptions
- `p_scheduled_start_at`: Début programmé (optionnel)
- `p_rules`: Règles (optionnel)
- `p_prize_distribution`: Distribution des prix (JSON)

**Retourne :** UUID du tournoi créé

**Validations :**
- Buy-in minimum 500 FCFA
- Min participants 4
- Dates d'inscription cohérentes
- Vérification admin

### `register_for_tournament()`
Inscrit un joueur à un tournoi.

**Paramètres :**
- `p_tournament_id`: ID du tournoi

**Retourne :** UUID de l'inscription

**Validations :**
- Tournoi en inscription
- Dates d'inscription valides
- Tournoi non complet
- Pas déjà inscrit
- Solde suffisant
- Bloque le buy-in automatiquement

### `generate_tournament_bracket()`
Génère le bracket du tournoi (admin uniquement).

**Paramètres :**
- `p_tournament_id`: ID du tournoi

**Retourne :** Structure du bracket (JSON)

**Validations :**
- Admin uniquement
- Tournoi en inscription
- Participants suffisants (min)
- Crée les matchs round par round
- Change le statut à 'scheduled'

### `start_tournament()`
Démarre un tournoi (admin uniquement).

**Paramètres :**
- `p_tournament_id`: ID du tournoi

**Retourne :** Boolean

**Actions :**
- Change statut à 'active'
- Programme les premiers matchs
- Notifie tous les participants

### `record_tournament_match_result()`
Enregistre le résultat d'un match (admin uniquement).

**Paramètres :**
- `p_match_id`: ID du match
- `p_winner_id`: ID du vainqueur
- `p_player1_score`: Score joueur 1
- `p_player2_score`: Score joueur 2
- `p_is_draw`: Si match nul

**Retourne :** UUID du match

**Actions :**
- Enregistre le résultat
- Avance le gagnant au match suivant
- Vérifie si le tournoi est terminé
- Déclenche la distribution des prix si finale

### `distribute_tournament_prizes()`
Distribue les prix du tournoi.

**Paramètres :**
- `p_tournament_id`: ID du tournoi

**Retourne :** Boolean

**Actions :**
- Calcule les parts selon la distribution
- Crédite les portefeuilles des gagnants
- Crée les transactions correspondantes

### `cancel_tournament()`
Annule un tournoi (admin uniquement).

**Paramètres :**
- `p_tournament_id`: ID du tournoi
- `p_reason`: Raison (optionnel)

**Retourne :** Boolean

**Actions :**
- Rembourse tous les buy-ins
- Change le statut à 'cancelled'
- Notifie les participants

### `disqualify_tournament_participant()`
Disqualifie un participant (admin uniquement).

**Paramètres :**
- `p_registration_id`: ID de l'inscription
- `p_reason`: Raison (optionnel)

**Retourne :** Boolean

**Actions :**
- Change le statut à 'disqualified'
- Notifie le participant
- Logger l'action

## 🎨 Interface Utilisateur

### Pages Principales

#### `/tournois`
Liste de tous les tournois avec filtres :
- **Filtres :** Tous, Inscriptions ouvertes, En cours, Terminés
- **Cartes tournoi :** Nom, type, statut, participants, prize pool
- **Actions :** Voir détails, S'inscrire (si éligible)

#### `/tournois/$id`
Détails d'un tournoi spécifique :
- **Onglets :** Aperçu, Bracket, Participants
- **Aperçu :** Informations, dates, mon inscription
- **Bracket :** Visualisation des matchs par round
- **Participants :** Liste des inscrits avec statuts

#### `/admin/tournois`
Dashboard admin pour la gestion :
- **Création :** Formulaire complet de création
- **Liste :** Tous les tournois avec actions rapides
- **Actions :** Générer bracket, Démarrer, Annuler
- **Statistiques :** Tournois total, inscriptions ouvertes, en cours, terminés

### Composants

#### TournamentCard
Composant de carte pour afficher un tournoi dans les listes :
- Informations principales
- Statut visuel
- Actions contextuelles

#### BracketView
Composant de visualisation du bracket :
- Organisation par rounds
- Matchs avec scores
- Progression des gagnants
- Mise en évidence des vainqueurs

#### TournamentForm
Formulaire de création/édition de tournoi :
- Validation des champs
- Types de tournoi
- Configuration des prix
- Gestion des dates

## 🔒 Sécurité

### Row Level Security (RLS)

#### Policies `tournaments`
- **SELECT :** Tous les utilisateurs connectés voient les tournois actifs
- **SELECT :** Les admins voient tous les tournois
- **INSERT :** Admins uniquement
- **UPDATE :** Admins uniquement

#### Policies `tournament_registrations`
- **SELECT :** Les utilisateurs voient leurs inscriptions
- **SELECT :** Les admins voient toutes les inscriptions
- **INSERT :** Les utilisateurs peuvent s'inscrire
- **UPDATE :** Admins uniquement (pour disqualification)

#### Policies `tournament_matches`
- **SELECT :** Tous les utilisateurs (matchs publics)
- **UPDATE :** Admins uniquement

#### Policies `tournament_notifications`
- **SELECT :** Les utilisateurs voient leurs notifications
- **UPDATE :** Les utilisateurs peuvent marquer comme lues

### Fonctions de Sécurité

#### `is_admin()`
Vérifie si l'utilisateur actuel a le rôle admin.

#### `_require_admin()`
Fonction utilitaire qui lève une exception si l'utilisateur n'est pas admin.

## 💰 Flux Financier

### Inscription
1. Joueur s'inscrit via `register_for_tournament()`
2. Vérification du solde disponible
3. Blocage du buy-in (balance_available → balance_locked)
4. Création de transaction `stake_locked`
5. Mise à jour du compteur de participants

### Annulation
1. Admin annule via `cancel_tournament()`
2. Remboursement automatique des buy-ins
3. Création de transactions `stake_refunded`
4. Notification des participants

### Distribution des Prix
1. Tournoi terminé (finale jouée)
2. Calcul des parts selon `prize_distribution`
3. Créditation des portefeuilles des gagnants
4. Création de transactions `win`
5. Mise à jour des statistiques des joueurs

## 🎯 Types de Tournois

### Single Elimination
- **Structure :** Arbre à élimination simple
- **Progression :** Le gagnant avance au round suivant
- **Matchs :** n-1 matchs pour n participants
- **Avantages :** Simple, rapide
- **Inconvénients :** Une seule défaite élimine

### Double Elimination
- **Structure :** Winner bracket + Loser bracket
- **Progression :** Deux chances (winner + loser)
- **Matchs :** 2n-1 à 2n-2 matchs
- **Avantages :** Plus juste, deuxième chance
- **Inconvénients :** Plus complexe, plus long

### Round Robin
- **Structure :** Tous contre tous
- **Progression :** Classement basé sur les résultats
- **Matchs :** n(n-1)/2 matchs
- **Avantages :** Plus de matchs pour tous
- **Inconvénients :** Très long pour beaucoup de participants

## 📊 Distribution des Prix

### Configuration par Défaut
```json
{
  "winner": 0.7,      // 70% pour le vainqueur
  "runner_up": 0.2,  // 20% pour le finaliste
  "third_place": 0.1  // 10% pour la 3ème place
}
```

### Calcul
- **Prize pool :** buy_in × nombre_participants
- **Part vainqueur :** prize_pool × winner_share
- **Part finaliste :** prize_pool × runner_up_share
- **Part 3ème :** prize_pool × third_place_share
- **Commission :** prize_pool × commission_rate

## 🔔 Notifications

### Types de Notifications
- `registration_open` : Inscriptions ouvertes
- `registration_closing` : Inscriptions bientôt terminées
- `tournament_starting` : Tournoi va commencer
- `match_scheduled` : Match programmé
- `match_ready` : Match prêt à commencer
- `tournament_completed` : Tournoi terminé
- `prize_awarded` : Prix distribués
- `disqualified` : Disqualification

### Cibles
- **Utilisateurs :** Notifications personnalisées
- **Admins :** Notifications pour les actions critiques
- **Broadcast :** Notifications pour tous les participants

## 🚀 Déploiement

### Migration SQL
```bash
# Appliquer la migration
supabase db push

# Ou manuellement
psql "$DATABASE_URL" -f supabase/migrations/20240918_tournaments.sql
```

### Types TypeScript
Après la migration, régénérer les types Supabase :
```bash
supabase gen types typescript --project-id YOUR_PROJECT_ID > src/integrations/supabase/types.ts
```

### Configuration
Assurez-vous que les variables d'environnement sont configurées :
- `SUPABASE_URL`
- `SUPABASE_PUBLISHABLE_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`

## 📈 Monitoring

### Métriques à Surveiller
- **Nombre de tournois créés**
- **Taux de participation**
- **Temps moyen de tournoi**
- **Revenue par tournoi**
- **Satisfaction des participants**

### Logs Admin
Toutes les actions admin sont loggées dans `admin_logs` :
- Création de tournoi
- Génération de bracket
- Démarrage/annulation
- Enregistrement des résultats
- Disqualifications

## 🎮 Guide d'Utilisation

### Pour les Joueurs

1. **S'inscrire à un tournoi**
   - Naviguer vers `/tournois`
   - Choisir un tournoi avec inscriptions ouvertes
   - Vérifier le buy-in et le prize pool
   - Cliquer sur "S'inscrire"
   - Le buy-in est débité automatiquement

2. **Suivre son tournoi**
   - Naviguer vers `/tournois/[id]`
   - Voir l'onglet "Bracket" pour la progression
   - Consulter l'onglet "Participants"
   - Voir ses propres statistiques

3. **Participer aux matchs**
   - Attendre la programmation des matchs
   - Les matchs peuvent être joués via le système de duels standard
   - Les résultats sont enregistrés par les admins

### Pour les Admins

1. **Créer un tournoi**
   - Naviguer vers `/admin/tournois`
   - Cliquer sur "Créer un tournoi"
   - Remplir le formulaire :
     - Nom et description
     - Type de tournoi
     - Buy-in et participants
     - Dates d'inscription
     - Règles spécifiques
   - Cliquer sur "Créer"

2. **Générer le bracket**
   - Attendre le minimum de participants
   - Cliquer sur "Générer le bracket"
   - Le système crée automatiquement les matchs
   - Le statut passe à "Programmé"

3. **Démarrer le tournoi**
   - Cliquer sur "Démarrer le tournoi"
   - Les premiers matchs sont programmés
   - Les participants sont notifiés

4. **Enregistrer les résultats**
   - Naviguer vers la gestion du tournoi
   - Pour chaque match terminé :
     - Sélectionner le vainqueur
     - Entrer les scores
     - Confirmer
   - Le système avance automatiquement les gagnants

5. **Gérer les problèmes**
   - Disqualifier un participant si nécessaire
   - Annuler le tournoi en cas de problème majeur
   - Ajouter des notes admin pour la traçabilité

## 🔧 Développement

### Architecture Frontend

#### Composants React
- **TanStack Query** pour la gestion d'état
- **TanStack Router** pour la navigation
- **React Hook Form** pour les formulaires
- **Radix UI** pour les composants UI
- **TailwindCSS** pour le styling

#### Hooks Personnalisés
```typescript
// Hook pour les tournois
const tournaments = useQuery({
  queryKey: ["tournaments", filter],
  queryFn: async () => {
    const { data } = await supabase.from("tournaments").select("*");
    return data;
  },
});

// Hook pour l'inscription
const register = useMutation({
  mutationFn: async (tournamentId) => {
    const { data } = await supabase.rpc("register_for_tournament", {
      p_tournament_id: tournamentId,
    });
    return data;
  },
});
```

### Real-time
Les mises à jour en temps réel sont gérées via Supabase Realtime :
- Changements de statut de tournoi
- Nouvelles inscriptions
- Résultats de matchs
- Notifications

## 🐛 Dépannage

### Problèmes Communs

#### "Tournoi non disponible à l'inscription"
- Vérifier que le statut est 'registration'
- Vérifier les dates d'inscription
- Vérifier que le tournoi n'est pas complet

#### "Solde insuffisant"
- Vérifier le balance_available du portefeuille
- Vérifier le montant du buy-in
- Le joueur doit recharger son portefeuille

#### "Pas assez de participants"
- Le minimum de participants n'est pas atteint
- Attendre plus d'inscriptions
- Ajuster le min_participants si nécessaire

#### "Bracket non généré"
- Vérifier que le statut est 'registration'
- Vérifier le nombre de participants
- Seuls les admins peuvent générer les brackets

### Logs et Debugging

#### Logs SQL
```sql
-- Voir les logs admin
SELECT * FROM admin_logs 
WHERE target_type = 'Tournament' 
ORDER BY created_at DESC;

-- Voir les transactions de tournoi
SELECT * FROM transactions 
WHERE description LIKE '%tournoi%';
```

#### Logs Frontend
```typescript
// Activer le logging TanStack Query
const queryClient = new QueryClient({
  logger: {
    log: (message) => console.log(message),
    warn: (message) => console.warn(message),
    error: (message) => console.error(message),
  },
});
```

## 🎯 Roadmap

### Fonctionnalités Futures

1. **Double Elimination Complète**
   - Implémentation complète du loser bracket
   - Gestion des matchs de consolation
   - Grande finale entre winner et loser bracket

2. **Round Robin**
   - Phase de groupes
   - Tableaux de classement
   - qualification en élimination

3. **Matchs en Direct**
   - Streaming des matchs
   - Commentary en temps réel
   - Statistiques live

4. **Système de Points**
   - Points au classement général
   - Saisons et divisions
   - Promotion/relégation

5. **Tournois Automatiques**
   - Tournois hebdomadaires
   - Tournois thématiques
   - Événements spéciaux

## 📞 Support

Pour toute question ou problème concernant le système de tournois :
- Consulter cette documentation
- Vérifier les logs admin
- Contacter l'équipe technique
- Signaler les bugs via le système de tickets

---

**Version :** 1.0  
**Dernière mise à jour :** 18/09/2026  
**Auteur :** SKILL2CASH Development Team