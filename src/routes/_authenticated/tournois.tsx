import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { Trophy, Users, Clock, Calendar, Zap, Plus } from "lucide-react";
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
  dateFr,
  errMessage,
  fcfa,
  relativeFr,
} from "@/lib/s2c";

export const Route = createFileRoute("/_authenticated/tournois")({
  head: () => ({
    meta: [
      { title: "Tournois — SKILL2CASH" },
      {
        name: "description",
        content: "Participe aux tournois eFootball avec buy-in et prize pool. Élimination simple, double ou round robin.",
      },
      { property: "og:title", content: "Tournois — SKILL2CASH" },
      { property: "og:description", content: "Tournois compétitifs avec enjeux réels." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: TournamentsPage,
});

function TournamentsPage() {
  const { user, isAdmin } = useMe();
  const qc = useQueryClient();
  const [filter, setFilter] = useState<'all' | 'registration' | 'active' | 'completed'>('all');

  const tournaments = useQuery({
    queryKey: ["tournaments", filter],
    queryFn: async () => {
      let query = supabase
        .from("tournaments")
        .select("*")
        .eq("deleted_at", null)
        .order("created_at", { ascending: false });

      if (filter !== 'all') {
        query = query.eq("status", filter);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data ?? [];
    },
  });

  const myRegistrations = useQuery({
    queryKey: ["my-tournament-registrations", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("tournament_registrations")
        .select("*")
        .eq("user_id", user!.id)
        .eq("status", "registered");
      if (error) throw error;
      return data ?? [];
    },
  });

  const register = useMutation({
    mutationFn: async (tournamentId: string) => {
      const { data, error } = await supabase.rpc("register_for_tournament", {
        p_tournament_id: tournamentId,
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

  const isRegistered = (tournamentId: string) => {
    return myRegistrations.data?.some(r => r.tournament_id === tournamentId && r.status === 'registered');
  };

  const canRegister = (tournament: Tournament) => {
    if (!user) return false;
    if (isRegistered(tournament.id)) return false;
    if (tournament.status !== 'registration') return false;
    if (tournament.current_participants >= tournament.max_participants) return false;
    const now = new Date();
    const start = new Date(tournament.registration_start_at);
    const end = new Date(tournament.registration_end_at);
    return now >= start && now <= end;
  };

  const getRegistrationState = (tournament: Tournament) => {
    if (tournament.status !== 'registration') return null;
    const now = new Date();
    const start = new Date(tournament.registration_start_at);
    const end = new Date(tournament.registration_end_at);
    if (now < start) return 'upcoming';
    if (now > end) return 'closed';
    return 'open';
  };

  return (
    <div>
      <PageTitle
        title="Tournois"
        subtitle="Compétitions à élimination avec buy-in et prize pool."
        action={
          isAdmin && (
            <Button asChild>
              <Link to="/admin/tournois">
                <Plus className="size-4" /> Créer un tournoi
              </Link>
            </Button>
          )
        }
      />

      <div className="mb-6 flex flex-wrap gap-2">
        <Button
          variant={filter === 'all' ? 'default' : 'outline'}
          size="sm"
          onClick={() => setFilter('all')}
        >
          Tous
        </Button>
        <Button
          variant={filter === 'registration' ? 'default' : 'outline'}
          size="sm"
          onClick={() => setFilter('registration')}
        >
          Inscriptions ouvertes
        </Button>
        <Button
          variant={filter === 'active' ? 'default' : 'outline'}
          size="sm"
          onClick={() => setFilter('active')}
        >
          En cours
        </Button>
        <Button
          variant={filter === 'completed' ? 'default' : 'outline'}
          size="sm"
          onClick={() => setFilter('completed')}
        >
          Terminés
        </Button>
      </div>

      {tournaments.data?.length === 0 ? (
        <EmptyState text="Aucun tournoi disponible pour le moment." />
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {tournaments.data?.map((tournament) => {
            const registrationState = getRegistrationState(tournament);
            const registered = isRegistered(tournament.id);
            const canReg = canRegister(tournament);

            return (
              <div key={tournament.id} className="panel p-5 clip-corner">
                <div className="mb-3 flex items-start justify-between gap-2">
                  <div className="flex-1">
                    <h3 className="font-display text-lg font-bold text-primary">
                      {tournament.name}
                    </h3>
                    <p className="text-xs text-muted-foreground">
                      {TOURNAMENT_TYPE_LABELS[tournament.tournament_type]}
                    </p>
                  </div>
                  <StatusChip status={tournament.status} label={TOURNAMENT_STATUS_LABELS[tournament.status]} />
                </div>

                {tournament.description && (
                  <p className="mb-3 text-sm text-muted-foreground line-clamp-2">
                    {tournament.description}
                  </p>
                )}

                <div className="mb-3 grid grid-cols-2 gap-2 text-xs">
                  <div className="flex items-center gap-1.5">
                    <Users className="size-3.5 text-muted-foreground" />
                    <span>
                      {tournament.current_participants}/{tournament.max_participants}
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <Trophy className="size-3.5 text-accent" />
                    <span className="font-semibold text-accent">{fcfa(tournament.prize_pool)}</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <Zap className="size-3.5 text-muted-foreground" />
                    <span>Buy-in: {fcfa(tournament.buy_in_amount)}</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <Clock className="size-3.5 text-muted-foreground" />
                    <span>{relativeFr(tournament.registration_end_at)}</span>
                  </div>
                </div>

                <div className="flex items-center gap-2 border-t border-border/50 pt-3">
                  <Button asChild className="flex-1" size="sm">
                    <Link to={`/tournois/${tournament.id}`}>
                      Voir détails
                    </Link>
                  </Button>
                  {canReg && (
                    <Button
                      size="sm"
                      disabled={register.isPending}
                      onClick={() => register.mutate(tournament.id)}
                    >
                      S'inscrire
                    </Button>
                  )}
                  {registered && (
                    <Button size="sm" variant="secondary" disabled>
                      Inscrit ✓
                    </Button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}