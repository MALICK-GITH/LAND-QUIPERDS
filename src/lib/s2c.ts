import type { Database } from "@/integrations/supabase/types";

export type Profile = Database["public"]["Tables"]["profiles"]["Row"];
export type Wallet = Database["public"]["Tables"]["wallets"]["Row"];
export type Transaction = Database["public"]["Tables"]["transactions"]["Row"];
export type Deposit = Database["public"]["Tables"]["deposits"]["Row"];
export type Withdrawal = Database["public"]["Tables"]["withdrawals"]["Row"];
export type Challenge = Database["public"]["Tables"]["challenges"]["Row"];
export type Duel = Database["public"]["Tables"]["duels"]["Row"];
export type DuelMessage = Database["public"]["Tables"]["duel_messages"]["Row"];
export type DirectMessage = Database["public"]["Tables"]["direct_messages"]["Row"];
export type Notification = Database["public"]["Tables"]["notifications"]["Row"];
export type CommissionSetting = Database["public"]["Tables"]["commission_settings"]["Row"];
export type UsernameChangeRequest =
  Database["public"]["Tables"]["username_change_requests"]["Row"];

// Types tournoi (temporaires, seront remplacés par les types Supabase après migration)
export type TournamentType = 'single_elimination' | 'double_elimination' | 'round_robin';
export type TournamentStatus = 'registration' | 'scheduled' | 'active' | 'completed' | 'cancelled';
export type TournamentMatchStatus = 'scheduled' | 'active' | 'finished' | 'cancelled';
export type TournamentRank = 'winner' | 'runner_up' | 'third_place' | 'fourth_place' | 'participant';

export type Tournament = {
  id: string;
  name: string;
  description: string | null;
  tournament_type: TournamentType;
  status: TournamentStatus;
  buy_in_amount: number;
  max_participants: number;
  commission_rate: number;
  prize_pool: number;
  prize_distribution: Record<string, number>;
  current_participants: number;
  min_participants: number;
  registration_start_at: string;
  registration_end_at: string;
  scheduled_start_at: string | null;
  started_at: string | null;
  completed_at: string | null;
  created_by: string | null;
  admin_note: string | null;
  rules: string | null;
  bracket_structure: Record<string, unknown>;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
};

export type TournamentRegistration = {
  id: string;
  tournament_id: string;
  user_id: string;
  status: 'registered' | 'withdrawn' | 'disqualified';
  buy_in_paid: boolean;
  buy_in_transaction_id: string | null;
  final_rank: TournamentRank | null;
  final_position: number | null;
  winnings: number;
  disqualified_reason: string | null;
  admin_note: string | null;
  registered_at: string;
  updated_at: string;
};

export type TournamentMatch = {
  id: string;
  tournament_id: string;
  player1_id: string | null;
  player2_id: string | null;
  winner_id: string | null;
  round_number: number;
  match_number: number;
  bracket_position: string | null;
  next_match_id: string | null;
  loser_next_match_id: string | null;
  status: TournamentMatchStatus;
  player1_score: number;
  player2_score: number;
  is_draw: boolean;
  duel_id: string | null;
  scheduled_at: string | null;
  started_at: string | null;
  finished_at: string | null;
  admin_note: string | null;
  resolved_by: string | null;
  created_at: string;
  updated_at: string;
};

/** Formate un montant en FCFA (XOF). */
export function fcfa(value: number | string | null | undefined): string {
  const n = Number(value ?? 0);
  return `${n.toLocaleString("fr-FR", { maximumFractionDigits: 0 })} FCFA`;
}

export function dateFr(value: string | null | undefined): string {
  if (!value) return "—";
  return new Date(value).toLocaleString("fr-FR", {
    day: "2-digit",
    month: "2-digit",
    year: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function relativeFr(value: string | null | undefined): string {
  if (!value) return "—";
  const diff = new Date(value).getTime() - Date.now();
  const mins = Math.round(diff / 60000);
  if (Math.abs(mins) < 1) return "à l'instant";
  if (mins > 0) {
    if (mins < 60) return `dans ${mins} min`;
    return `dans ${Math.round(mins / 60)} h`;
  }
  const past = -mins;
  if (past < 60) return `il y a ${past} min`;
  if (past < 1440) return `il y a ${Math.round(past / 60)} h`;
  return `il y a ${Math.round(past / 1440)} j`;
}

export const TX_LABELS: Record<string, string> = {
  deposit: "Dépôt",
  withdrawal: "Retrait",
  stake_locked: "Mise bloquée",
  stake_refunded: "Remboursement",
  win: "Gain",
  loss: "Perte",
  commission: "Commission",
  adjustment: "Ajustement",
};

export const DUEL_STATUS_LABELS: Record<string, string> = {
  active: "En cours",
  waiting_votes: "Attente des votes",
  finished: "Terminé",
  dispute: "Litige",
  cancelled: "Annulé",
};

export const CHALLENGE_STATUS_LABELS: Record<string, string> = {
  pending: "En attente",
  counter_offer: "Contre-offre",
  accepted: "Accepté",
  declined: "Refusé",
  cancelled: "Annulé",
  expired: "Expiré",
};

export const VOTE_LABELS: Record<string, string> = {
  win: "Gagné",
  draw: "Nul",
  lose: "Perdu",
};

export const REQUEST_STATUS_LABELS: Record<string, string> = {
  pending: "En attente",
  approved: "Validé",
  rejected: "Refusé",
};

// Labels pour les tournois
export const TOURNAMENT_TYPE_LABELS: Record<string, string> = {
  single_elimination: 'Élimination simple',
  double_elimination: 'Élimination double',
  round_robin: 'Round Robin',
};

export const TOURNAMENT_STATUS_LABELS: Record<string, string> = {
  registration: 'Inscriptions ouvertes',
  scheduled: 'Programmé',
  active: 'En cours',
  completed: 'Terminé',
  cancelled: 'Annulé',
};

export const TOURNAMENT_MATCH_STATUS_LABELS: Record<string, string> = {
  scheduled: 'Programmé',
  active: 'En cours',
  finished: 'Terminé',
  cancelled: 'Annulé',
};

export const TOURNAMENT_RANK_LABELS: Record<string, string> = {
  winner: 'Vainqueur',
  runner_up: 'Finaliste',
  third_place: '3ème place',
  fourth_place: '4ème place',
  participant: 'Participant',
};

/** Traduit les erreurs Postgres/RPC en message lisible. */
export function errMessage(error: unknown): string {
  if (!error) return "Une erreur est survenue.";
  const anyErr = error as { message?: string; hint?: string };
  const msg = anyErr.message ?? String(error);
  if (msg.includes("duplicate key") && msg.includes("username")) return "Ce pseudo est déjà pris.";
  if (msg.includes("duplicate key") && msg.includes("efootball"))
    return "Ce pseudo eFootball est déjà utilisé.";
  if (msg.includes("Invalid login credentials")) return "Email ou mot de passe incorrect.";
  if (msg.includes("User already registered")) return "Un compte existe déjà avec cet email.";
  if (msg.includes("Email not confirmed")) return "Confirmez votre email avant de vous connecter.";
  return msg;
}