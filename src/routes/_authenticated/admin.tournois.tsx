import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";

import { EmptyState, PageTitle, StatCard, StatusChip } from "@/components/skill2cash/ui-bits";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useMe } from "@/hooks/use-s2c";
import { supabase } from "@/integrations/supabase/client";
import {
  TOURNAMENT_STATUS_LABELS,
  TOURNAMENT_TYPE_LABELS,
  dateFr,
  errMessage,
  fcfa,
} from "@/lib/s2c";

export const Route = createFileRoute("/_authenticated/admin/tournois")({
  head: () => ({
    meta: [
      { title: "Administration Tournois — SKILL2CASH" },
      {
        name: "description",
        content: "Gestion des tournois: création, brackets, résultats et participants.",
      },
      { property: "og:title", content: "Administration Tournois — SKILL2CASH" },
      { property: "og:description", content: "Gestion complète des tournois." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: AdminTournamentsPage,
});

function AdminTournamentsPage() {
  const { isAdmin, loading } = useMe();
  const qc = useQueryClient();
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [notes, setNotes] = useState<Record<string, string>>({});

  const [createForm, setCreateForm] = useState({
    name: "",
    description: "",
    tournament_type: "single_elimination" as "single_elimination" | "double_elimination" | "round_robin",
    buy_in_amount: "1000",
    max_participants: "8",
    commission_rate: "0.12",
    min_participants: "4",
    registration_start_at: "",
    registration_end_at: "",
    scheduled_start_at: "",
    rules: "",
  });

  const tournaments = useQuery({
    queryKey: ["admin-tournaments"],
    enabled: isAdmin,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("tournaments")
        .select("*")
        .eq("deleted_at", null)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  const createTournament = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.rpc("create_tournament", {
        p_name: createForm.name.trim(),
        p_description: createForm.description.trim() || null,
        p_tournament_type: createForm.tournament_type,
        p_buy_in_amount: Number(createForm.buy_in_amount),
        p_max_participants: Number(createForm.max_participants),
        p_commission_rate: Number(createForm.commission_rate),
        p_min_participants: Number(createForm.min_participants),
        p_registration_start_at: createForm.registration_start_at || new Date().toISOString(),
        p_registration_end_at: createForm.registration_end_at,
        p_scheduled_start_at: createForm.scheduled_start_at || null,
        p_rules: createForm.rules.trim() || null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Tournoi créé avec succès !");
      setShowCreateForm(false);
      setCreateForm({
        name: "",
        description: "",
        tournament_type: "single_elimination",
        buy_in_amount: "1000",
        max_participants: "8",
        commission_rate: "0.12",
        min_participants: "4",
        registration_start_at: "",
        registration_end_at: "",
        scheduled_start_at: "",
        rules: "",
      });
      void qc.invalidateQueries();
    },
    onError: (e) => toast.error(errMessage(e)),
  });

  const generateBracket = useMutation({
    mutationFn: async (tournamentId: string) => {
      const { error } = await supabase.rpc("generate_tournament_bracket", {
        p_tournament_id: tournamentId,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Bracket généré avec succès !");
      void qc.invalidateQueries();
    },
    onError: (e) => toast.error(errMessage(e)),
  });

  const startTournament = useMutation({
    mutationFn: async (tournamentId: string) => {
      const { error } = await supabase.rpc("start_tournament", {
        p_tournament_id: tournamentId,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Tournoi démarré !");
      void qc.invalidateQueries();
    },
    onError: (e) => toast.error(errMessage(e)),
  });

  const cancelTournament = useMutation({
    mutationFn: async (tournamentId: string) => {
      const { error } = await supabase.rpc("cancel_tournament", {
        p_tournament_id: tournamentId,
        p_reason: notes[tournamentId] || null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Tournoi annulé. Les buy-ins ont été remboursés.");
      void qc.invalidateQueries();
    },
    onError: (e) => toast.error(errMessage(e)),
  });

  if (loading) return <EmptyState text="Chargement…" />;
  if (!isAdmin)
    return (
      <div>
        <PageTitle title="Administration Tournois" subtitle="Accès réservé." />
        <EmptyState text="Cette section est réservée aux administrateurs." />
      </div>
    );

  return (
    <div>
      <PageTitle
        title="Administration Tournois"
        subtitle="Création, gestion et supervision des tournois."
        action={
          <Button onClick={() => setShowCreateForm(!showCreateForm)}>
            {showCreateForm ? "Annuler" : "Créer un tournoi"}
          </Button>
        }
      />

      {showCreateForm && (
        <div className="panel p-5 clip-corner mb-6">
          <h3 className="font-display text-sm font-bold tracking-widest uppercase mb-4">
            Créer un nouveau tournoi
          </h3>
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <Label>Nom du tournoi</Label>
              <Input
                value={createForm.name}
                onChange={(e) => setCreateForm({ ...createForm, name: e.target.value })}
                placeholder="Ex: Tournoi Elite #1"
              />
            </div>
            <div>
              <Label>Type de tournoi</Label>
              <Select
                value={createForm.tournament_type}
                onValueChange={(v) => setCreateForm({ ...createForm, tournament_type: v as any })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="single_elimination">Élimination simple</SelectItem>
                  <SelectItem value="double_elimination">Élimination double</SelectItem>
                  <SelectItem value="round_robin">Round Robin</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Buy-in (FCFA)</Label>
              <Input
                type="number"
                min="500"
                step="500"
                value={createForm.buy_in_amount}
                onChange={(e) => setCreateForm({ ...createForm, buy_in_amount: e.target.value })}
              />
            </div>
            <div>
              <Label>Participants max</Label>
              <Input
                type="number"
                min="4"
                step="2"
                value={createForm.max_participants}
                onChange={(e) => setCreateForm({ ...createForm, max_participants: e.target.value })}
              />
            </div>
            <div>
              <Label>Participants min</Label>
              <Input
                type="number"
                min="2"
                value={createForm.min_participants}
                onChange={(e) => setCreateForm({ ...createForm, min_participants: e.target.value })}
              />
            </div>
            <div>
              <Label>Commission (0-1)</Label>
              <Input
                type="number"
                min="0"
                max="1"
                step="0.01"
                value={createForm.commission_rate}
                onChange={(e) => setCreateForm({ ...createForm, commission_rate: e.target.value })}
              />
            </div>
            <div>
              <Label>Début inscriptions</Label>
              <Input
                type="datetime-local"
                value={createForm.registration_start_at}
                onChange={(e) => setCreateForm({ ...createForm, registration_start_at: e.target.value })}
              />
            </div>
            <div>
              <Label>Fin inscriptions</Label>
              <Input
                type="datetime-local"
                value={createForm.registration_end_at}
                onChange={(e) => setCreateForm({ ...createForm, registration_end_at: e.target.value })}
              />
            </div>
            <div>
              <Label>Début programmé (optionnel)</Label>
              <Input
                type="datetime-local"
                value={createForm.scheduled_start_at}
                onChange={(e) => setCreateForm({ ...createForm, scheduled_start_at: e.target.value })}
              />
            </div>
            <div className="md:col-span-2">
              <Label>Description</Label>
              <Textarea
                value={createForm.description}
                onChange={(e) => setCreateForm({ ...createForm, description: e.target.value })}
                placeholder="Description du tournoi..."
                rows={2}
              />
            </div>
            <div className="md:col-span-2">
              <Label>Règles</Label>
              <Textarea
                value={createForm.rules}
                onChange={(e) => setCreateForm({ ...createForm, rules: e.target.value })}
                placeholder="Règles spécifiques du tournoi..."
                rows={3}
              />
            </div>
          </div>
          <div className="mt-4 flex gap-2">
            <Button
              onClick={() => createTournament.mutate()}
              disabled={createTournament.isPending || !createForm.name.trim()}
            >
              Créer le tournoi
            </Button>
            <Button variant="outline" onClick={() => setShowCreateForm(false)}>
              Annuler
            </Button>
          </div>
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Tournois total" value={tournaments.data?.length || 0} />
        <StatCard
          label="Inscriptions ouvertes"
          value={tournaments.data?.filter(t => t.status === 'registration').length || 0}
          tone="accent"
        />
        <StatCard
          label="En cours"
          value={tournaments.data?.filter(t => t.status === 'active').length || 0}
          tone="neon"
        />
        <StatCard
          label="Terminés"
          value={tournaments.data?.filter(t => t.status === 'completed').length || 0}
        />
      </div>

      <div className="mt-6">
        {tournaments.data?.length === 0 ? (
          <EmptyState text="Aucun tournoi créé." />
        ) : (
          <div className="space-y-3">
            {tournaments.data?.map((tournament) => (
              <div key={tournament.id} className="panel p-4 clip-corner">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="font-display text-lg font-bold text-primary">
                      {tournament.name}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {TOURNAMENT_TYPE_LABELS[tournament.tournament_type]} · {tournament.current_participants}/{tournament.max_participants} participants
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Prize pool: {fcfa(tournament.prize_pool)} · Buy-in: {fcfa(tournament.buy_in_amount)}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {dateFr(tournament.created_at)}
                    </p>
                  </div>
                  <StatusChip status={tournament.status} label={TOURNAMENT_STATUS_LABELS[tournament.status]} />
                </div>

                <div className="mt-3 flex flex-wrap items-center gap-2">
                  {tournament.status === 'registration' && (
                    <>
                      <Button
                        size="sm"
                        disabled={generateBracket.isPending}
                        onClick={() => generateBracket.mutate(tournament.id)}
                      >
                        Générer le bracket
                      </Button>
                      <Button
                        size="sm"
                        variant="destructive"
                        disabled={cancelTournament.isPending}
                        onClick={() => cancelTournament.mutate(tournament.id)}
                      >
                        Annuler
                      </Button>
                    </>
                  )}
                  {tournament.status === 'scheduled' && (
                    <Button
                      size="sm"
                      disabled={startTournament.isPending}
                      onClick={() => startTournament.mutate(tournament.id)}
                    >
                      Démarrer le tournoi
                    </Button>
                  )}
                  <Button asChild size="sm" variant="outline">
                    <Link to={`/tournois/${tournament.id}`}>
                      Voir détails
                    </Link>
                  </Button>
                  <Button asChild size="sm" variant="ghost">
                    <Link to={`/admin/tournois/${tournament.id}`}>
                      Gérer
                    </Link>
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}