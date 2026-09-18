import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { Trophy, Users, Clock, Calendar, Zap, ArrowRight, ChevronRight } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { EmptyState, PageTitle, StatCard, StatusChip } from "@/components/skill2cash/ui-bits";
import { Button } from "@/components/ui/button";
import { useMe } from "@/hooks/use-s2c";
import { supabase } from "@/integrations/supabase/client";
import { fetchProfileMap } from "@/lib/profiles";
import {
  TOURNAMENT_STATUS_LABELS,
  TOURNAMENT_TYPE_LABELS,
  TOURNAMENT_MATCH_STATUS_LABELS,
  dateFr,
  errMessage,
  fcfa,
  relativeFr,
} from "@/lib/s2c";

export const Route = createFileRoute("/_authenticated/tournois/$id")({
  head: () => ({
    meta: [
      { title: "Détails du tournoi — SKILL2CASH" },
      {
        name: "description",
        content: "Détails du tournoi, bracket, participants et résultats.",
      },
      { property: "og:title", content: "Détails du tournoi — SKILL2CASH" },
      { property: "og:description", content: "Bracket et progression du tournoi." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: TournamentDetailPage,
});

function TournamentDetailPage() {
  const { id } = Route.useParams();
  const { user, isAdmin } = useMe();
  const qc = useQueryClient();
  const [activeTab, setActiveTab] = useState<'overview' | 'bracket' | 'participants'>('overview');

  const tournament = useQuery({
    queryKey: ["tournament", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("tournaments")
        .select("*")
        .eq("id", id)
        .eq("deleted_at", null)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const registrations = useQuery({
    queryKey: ["tournament-registrations", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("tournament_registrations")
        .select("*, profiles(*)")
        .eq("tournament_id", id)
        .order("registered_at", { ascending: true });
      if (error) throw error;
      return data || [];
    },
    enabled: !!tournament.data,
  });

  const matches = useQuery({
    queryKey: ["tournament-matches", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("tournament_matches")
        .select("*")
        .eq("tournament_id", id)
        .order("round_number", { ascending: true })
        .order("match_number", { ascending: true });
      if (error) throw error;
      return data ?? [];
    },
    enabled: !!tournament.data,
  });

  const myRegistration = useQuery({
    queryKey: ["my-tournament-registration", id, user?.id],
    enabled: !!user && !!tournament.data,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("tournament_registrations")
        .select("*")
        .eq("tournament_id", id)
        .eq("user_id", user!.id)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const register = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.rpc("register_for_tournament", {
        p_tournament_id: id,
      });
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      toast.success("Inscription confirmée ! Buy-in débité.");
      void qc.invalidateQueries();
    },
    onError: (e) => toast.error(errMessage(e)),
  });

  if (tournament.isLoading) return <EmptyState text="Chargement du tournoi…" />;
  if (!tournament.data) return <EmptyState text="Tournoi introuvable." />;

  const t = tournament.data;
  const registered = myRegistration.data?.status === 'registered';
  const canRegister = t.status === 'registration' && !registered && t.current_participants < t.max_participants;

  const registrationState = () => {
    if (t.status !== 'registration') return null;
    const now = new Date();
    const start = new Date(t.registration_start_at);
    const end = new Date(t.registration_end_at);
    if (now < start) return { state: 'upcoming', label: 'Inscriptions bientôt ouvertes' };
    if (now > end) return { state: 'closed', label: 'Inscriptions terminées' };
    return { state: 'open', label: 'Inscriptions ouvertes' };
  };

  const regState = registrationState();

  // Organiser les matchs par rounds pour le bracket
  const matchesByRound = matches.data?.reduce((acc, match) => {
    if (!acc[match.round_number]) {
      acc[match.round_number] = [];
    }
    acc[match.round_number].push(match);
    return acc;
  }, {} as Record<number, any[]>) || {};

  const profileMap = registrations.data?.reduce((acc, reg: any) => {
    if (reg.profiles) {
      acc[reg.user_id] = reg.profiles;
    }
    return acc;
  }, {} as Record<string, any>) || {};

  return (
    <div>
      <PageTitle
        title={t.name}
        subtitle={t.description || "Tournoi compétitif eFootball"}
        action={
          canRegister && (
            <Button onClick={() => register.mutate()} disabled={register.isPending}>
              S'inscrire ({fcfa(t.buy_in_amount)})
            </Button>
          )
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Prize pool" value={fcfa(t.prize_pool)} tone="accent" />
        <StatCard
          label="Participants"
          value={`${t.current_participants}/${t.max_participants}`}
          hint={regState?.label}
        />
        <StatCard label="Buy-in" value={fcfa(t.buy_in_amount)} />
        <StatCard
          label="Statut"
          value={TOURNAMENT_STATUS_LABELS[t.status]}
          hint={TOURNAMENT_TYPE_LABELS[t.tournament_type]}
        />
      </div>

      {t.rules && (
        <div className="mt-6 panel p-4 clip-corner">
          <h3 className="font-display text-sm font-bold tracking-widest uppercase mb-2">Règles</h3>
          <p className="text-sm text-muted-foreground whitespace-pre-line">{t.rules}</p>
        </div>
      )}

      <div className="mt-6">
        <div className="flex gap-2 border-b border-border/60">
          <button
            onClick={() => setActiveTab('overview')}
            className={`px-4 py-2 font-display text-xs font-bold tracking-wider uppercase transition-colors ${
              activeTab === 'overview'
                ? 'border-b-2 border-primary text-primary'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            Aperçu
          </button>
          <button
            onClick={() => setActiveTab('bracket')}
            className={`px-4 py-2 font-display text-xs font-bold tracking-wider uppercase transition-colors ${
              activeTab === 'bracket'
                ? 'border-b-2 border-primary text-primary'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            Bracket
          </button>
          <button
            onClick={() => setActiveTab('participants')}
            className={`px-4 py-2 font-display text-xs font-bold tracking-wider uppercase transition-colors ${
              activeTab === 'participants'
                ? 'border-b-2 border-primary text-primary'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            Participants ({registrations.data?.length || 0})
          </button>
        </div>

        {activeTab === 'overview' && (
          <div className="mt-4 space-y-4">
            <div className="panel p-4 clip-corner">
              <h3 className="font-display text-sm font-bold tracking-widest uppercase mb-3">Informations</h3>
              <div className="grid gap-2 text-sm">
                <div className="flex items-center gap-2">
                  <Calendar className="size-4 text-muted-foreground" />
                  <span>Inscriptions: {dateFr(t.registration_start_at)} - {dateFr(t.registration_end_at)}</span>
                </div>
                {t.scheduled_start_at && (
                  <div className="flex items-center gap-2">
                    <Clock className="size-4 text-muted-foreground" />
                    <span>Début programmé: {dateFr(t.scheduled_start_at)}</span>
                  </div>
                )}
                {t.started_at && (
                  <div className="flex items-center gap-2">
                    <Zap className="size-4 text-accent" />
                    <span>Démarré: {dateFr(t.started_at)}</span>
                  </div>
                )}
                {t.completed_at && (
                  <div className="flex items-center gap-2">
                    <Trophy className="size-4 text-accent" />
                    <span>Terminé: {dateFr(t.completed_at)}</span>
                  </div>
                )}
              </div>
            </div>

            {registered && myRegistration.data && (
              <div className="panel p-4 clip-corner border-primary/40 bg-primary/10">
                <h3 className="font-display text-sm font-bold tracking-widest uppercase mb-2 text-primary">
                  Mon inscription
                </h3>
                <div className="text-sm">
                  <p>Buy-in payé: {myRegistration.data.buy_in_paid ? '✓' : '✗'}</p>
                  {myRegistration.data.final_rank && (
                    <p className="mt-1">
                      Classement final: <span className="font-bold text-accent">
                        {myRegistration.data.final_rank}
                      </span>
                    </p>
                  )}
                  {myRegistration.data.winnings > 0 && (
                    <p className="mt-1">
                      Gains: <span className="font-bold text-accent">{fcfa(myRegistration.data.winnings)}</span>
                    </p>
                  )}
                </div>
              </div>
            )}
          </div>
        )}

        {activeTab === 'bracket' && (
          <div className="mt-4">
            {Object.keys(matchesByRound).length === 0 ? (
              <EmptyState text="Le bracket n'a pas encore été généré." />
            ) : (
              <div className="overflow-x-auto">
                <div className="flex gap-4 min-w-max">
                  {Object.entries(matchesByRound)
                    .sort(([a], [b]) => parseInt(a) - parseInt(b))
                    .map(([round, roundMatches]) => (
                      <div key={round} className="flex flex-col gap-2">
                        <h4 className="font-display text-xs font-bold tracking-wider uppercase text-center mb-2">
                          Round {round}
                        </h4>
                        {roundMatches.map((match) => {
                          const player1 = profileMap[match.player1_id || ''];
                          const player2 = profileMap[match.player2_id || ''];
                          
                          return (
                            <div
                              key={match.id}
                              className="panel p-3 clip-corner min-w-[200px]"
                            >
                              <div className="flex items-center justify-between mb-2">
                                <StatusChip 
                                  status={match.status} 
                                  label={TOURNAMENT_MATCH_STATUS_LABELS[match.status]} 
                                  size="sm"
                                />
                                <span className="text-xs text-muted-foreground">Match #{match.match_number}</span>
                              </div>
                              
                              <div className="space-y-2 text-sm">
                                <div className={`flex items-center justify-between p-2 rounded ${
                                  match.winner_id === match.player1_id ? 'bg-accent/20 border border-accent/40' : 'bg-muted/20'
                                }`}>
                                  <div className="flex items-center gap-2">
                                    <div className="size-6 rounded-full bg-primary/20 flex items-center justify-center text-xs font-bold">
                                      {player1?.username?.[0] || '?'}
                                    </div>
                                    <span className="font-medium">{player1?.username || 'En attente'}</span>
                                  </div>
                                  <span className="font-display font-bold">{match.player1_score}</span>
                                </div>
                                
                                <div className={`flex items-center justify-between p-2 rounded ${
                                  match.winner_id === match.player2_id ? 'bg-accent/20 border border-accent/40' : 'bg-muted/20'
                                }`}>
                                  <div className="flex items-center gap-2">
                                    <div className="size-6 rounded-full bg-primary/20 flex items-center justify-center text-xs font-bold">
                                      {player2?.username?.[0] || '?'}
                                    </div>
                                    <span className="font-medium">{player2?.username || 'En attente'}</span>
                                  </div>
                                  <span className="font-display font-bold">{match.player2_score}</span>
                                </div>
                              </div>

                              {match.status === 'finished' && match.winner_id && (
                                <div className="mt-2 text-center text-xs text-accent font-semibold">
                                  🏆 {profileMap[match.winner_id]?.username || 'Vainqueur'}
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    ))}
                </div>
              </div>
            )}
          </div>
        )}

        {activeTab === 'participants' && (
          <div className="mt-4">
            {registrations.data?.length === 0 ? (
              <EmptyState text="Aucun participant pour le moment." />
            ) : (
              <div className="panel divide-y divide-border/50 clip-corner">
                {registrations.data?.map((reg: any) => {
                  const profile = reg.profiles;
                  return (
                    <div key={reg.id} className="flex items-center justify-between px-4 py-3">
                      <div className="flex items-center gap-3">
                        <div className="size-8 rounded-full bg-primary/20 flex items-center justify-center text-sm font-bold">
                          {profile?.username?.[0] || '?'}
                        </div>
                        <div>
                          <p className="font-semibold">{profile?.username || 'Joueur'}</p>
                          <p className="text-xs text-muted-foreground">
                            {profile?.efootball_username || ''} · {profile?.level || ''}
                          </p>
                        </div>
                      </div>
                      <div className="text-right">
                        <StatusChip status={reg.status} label={
                          reg.status === 'registered' ? 'Inscrit' :
                          reg.status === 'withdrawn' ? 'Retiré' :
                          reg.status === 'disqualified' ? 'Disqualifié' : reg.status
                        } size="sm" />
                        {reg.final_rank && (
                          <p className="mt-1 text-xs font-semibold text-accent">{reg.final_rank}</p>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}