import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { EmptyState, PageTitle, StatusChip } from "@/components/skill2cash/ui-bits";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useMe } from "@/hooks/use-s2c";
import { supabase } from "@/integrations/supabase/client";
import { fetchProfileMap } from "@/lib/profiles";
import {
  CHALLENGE_STATUS_LABELS,
  dateFr,
  errMessage,
  fcfa,
  relativeFr,
  type Challenge,
} from "@/lib/s2c";

export const Route = createFileRoute("/_authenticated/defis")({
  head: () => ({
    meta: [
      { title: "Défis — SKILL2CASH" },
      {
        name: "description",
        content: "Gère tes défis eFootball reçus et envoyés : accepte, refuse ou contre-propose.",
      },
      { property: "og:title", content: "Défis — SKILL2CASH" },
      { property: "og:description", content: "Accepte, refuse ou contre-propose un défi." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: ChallengesPage,
});

function ChallengesPage() {
  const { user } = useMe();
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [counter, setCounter] = useState<Record<string, string>>({});

  const challenges = useQuery({
    queryKey: ["challenges", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("challenges")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(80);
      if (error) throw error;
      const rows = (data ?? []) as Challenge[];
      const profiles = await fetchProfileMap(rows.flatMap((c) => [c.challenger_id, c.challenged_id]));
      return { rows, profiles };
    },
  });

  useEffect(() => {
    if (!user) return;
    const channel = supabase
      .channel("challenges-stream")
      .on("postgres_changes", { event: "*", schema: "public", table: "challenges" }, () => {
        void qc.invalidateQueries({ queryKey: ["challenges"] });
      })
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [user?.id, qc, user]);

  const respond = useMutation({
    mutationFn: async (vars: { id: string; action: string; amount?: number }) => {
      const { data, error } = await supabase.rpc("respond_challenge", {
        p_challenge: vars.id,
        p_action: vars.action,
        ...(vars.amount !== undefined ? { p_counter_amount: vars.amount } : {}),
      });
      if (error) throw error;
      return data as string | null;
    },
    onSuccess: (duelId, vars) => {
      void qc.invalidateQueries();
      if (vars.action === "accept" && duelId) {
        toast.success("Duel lancé ! Mises bloquées.");
        void navigate({ to: "/duels/$id", params: { id: duelId } });
      } else {
        toast.success("Défi mis à jour.");
      }
    },
    onError: (e) => toast.error(errMessage(e)),
  });

  const rows = challenges.data?.rows ?? [];
  const profiles = challenges.data?.profiles ?? {};
  const received = rows.filter((c) => c.challenged_id === user?.id);
  const sent = rows.filter((c) => c.challenger_id === user?.id);

  function Card({ c }: { c: Challenge }) {
    const mine = c.challenger_id === user?.id;
    const other = profiles[mine ? c.challenged_id : c.challenger_id];
    const live = c.status === "pending" || c.status === "counter_offer";
    // Sur une contre-offre, c'est au créateur du défi de répondre.
    const myTurn =
      live && ((c.status === "pending" && !mine) || (c.status === "counter_offer" && mine));

    return (
      <div className="panel p-4 clip-corner">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="font-display text-lg font-bold text-primary">
              {fcfa(c.accepted_amount ?? c.amount)}
            </p>
            <p className="text-sm text-foreground">
              {mine ? "Contre" : "De"} {other?.username ?? "joueur"}
              {other?.efootball_username ? ` (${other.efootball_username})` : ""}
            </p>
            <p className="text-xs text-muted-foreground">
              {dateFr(c.created_at)} · expire {relativeFr(c.expires_at)}
            </p>
          </div>
          <StatusChip status={c.status} label={CHALLENGE_STATUS_LABELS[c.status]} />
        </div>

        {myTurn && (
          <div className="mt-4 flex flex-wrap items-center gap-2">
            <Button
              size="sm"
              disabled={respond.isPending}
              onClick={() => respond.mutate({ id: c.id, action: "accept" })}
            >
              Accepter
            </Button>
            <Button
              size="sm"
              variant="outline"
              disabled={respond.isPending}
              onClick={() => respond.mutate({ id: c.id, action: "decline" })}
            >
              Refuser
            </Button>
            <Input
              className="h-9 w-32"
              type="number"
              placeholder="Contre-offre"
              value={counter[c.id] ?? ""}
              onChange={(e) => setCounter((s) => ({ ...s, [c.id]: e.target.value }))}
            />
            <Button
              size="sm"
              variant="secondary"
              disabled={respond.isPending || !Number(counter[c.id])}
              onClick={() =>
                respond.mutate({
                  id: c.id,
                  action: "counter",
                  amount: Number(counter[c.id]),
                })
              }
            >
              Contre-proposer
            </Button>
          </div>
        )}

        {live && mine && (
          <Button
            className="mt-4"
            size="sm"
            variant="ghost"
            disabled={respond.isPending}
            onClick={() => respond.mutate({ id: c.id, action: "cancel" })}
          >
            Annuler mon défi
          </Button>
        )}
      </div>
    );
  }

  return (
    <div>
      <PageTitle title="Défis" subtitle="Accepte, refuse ou négocie l'enjeu de tes duels." />
      <Tabs defaultValue="received">
        <TabsList>
          <TabsTrigger value="received">Reçus ({received.length})</TabsTrigger>
          <TabsTrigger value="sent">Envoyés ({sent.length})</TabsTrigger>
        </TabsList>
        <TabsContent value="received" className="mt-4 space-y-3">
          {received.length ? (
            received.map((c) => <Card key={c.id} c={c} />)
          ) : (
            <EmptyState text="Aucun défi reçu pour l'instant." />
          )}
        </TabsContent>
        <TabsContent value="sent" className="mt-4 space-y-3">
          {sent.length ? (
            sent.map((c) => <Card key={c.id} c={c} />)
          ) : (
            <EmptyState text="Tu n'as envoyé aucun défi." />
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}