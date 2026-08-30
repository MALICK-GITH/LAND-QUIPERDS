import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { MessageCircle, Search, Target } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { EmptyState, PageTitle, StatusChip } from "@/components/skill2cash/ui-bits";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { UserPresenceBadge } from "@/components/user-presence-badge";
import { useMe } from "@/hooks/use-s2c";
import { supabase } from "@/integrations/supabase/client";
import { errMessage, fcfa, type Profile } from "@/lib/s2c";

export const Route = createFileRoute("/_authenticated/joueurs")({
  head: () => ({
    meta: [
      { title: "Joueurs — SKILL2CASH" },
      {
        name: "description",
        content: "Parcours les joueurs eFootball disponibles et envoie un défi en FCFA.",
      },
      { property: "og:title", content: "Joueurs — SKILL2CASH" },
      { property: "og:description", content: "Recherche d'adversaires et envoi de défis." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: PlayersPage,
});

function PlayersPage() {
  const { user, wallet } = useMe();
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [target, setTarget] = useState<Profile | null>(null);
  const [amount, setAmount] = useState("1000");
  const [minutes, setMinutes] = useState("30");

  const players = useQuery({
    queryKey: ["players", search],
    queryFn: async () => {
      let q = supabase
        .from("profiles")
        .select("*")
        .eq("is_banned", false)
        .order("total_earnings", { ascending: false })
        .limit(60);
      if (search.trim()) q = q.ilike("username", `%${search.trim()}%`);
      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []) as Profile[];
    },
  });

  const challenge = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.rpc("create_challenge", {
        p_challenged: target!.id,
        p_amount: Number(amount),
        p_minutes: Number(minutes),
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Défi envoyé !");
      setTarget(null);
      void qc.invalidateQueries({ queryKey: ["challenges"] });
    },
    onError: (e) => toast.error(errMessage(e)),
  });

  const list = (players.data ?? []).filter((p) => p.id !== user?.id);

  return (
    <div>
      <PageTitle title="Joueurs" subtitle="Trouve un adversaire et lance ton défi." />

      <div className="relative mb-6 max-w-md">
        <Search className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Rechercher un pseudo…"
          className="pl-9"
          maxLength={40}
        />
      </div>

      {list.length ? (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {list.map((p) => {
            const played = p.wins + p.losses + p.draws;
            return (
              <div key={p.id} className="panel p-4 clip-corner">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <p className="font-display text-base font-bold text-primary">{p.username}</p>
                      <UserPresenceBadge
                        is_online={p.is_online}
                        last_seen_at={p.last_seen_at}
                        last_activity_at={p.last_activity_at}
                      />
                    </div>
                    <p className="font-mono text-[10px] tracking-widest text-muted-foreground uppercase">
                      {p.efootball_username} · {p.country}
                    </p>
                  </div>
                  <StatusChip status="active" label={p.level} />
                </div>
                <div className="mt-3 grid grid-cols-3 gap-2 text-center">
                  <div>
                    <p className="font-display text-sm font-bold text-accent">{p.wins}</p>
                    <p className="text-[10px] text-muted-foreground">Victoires</p>
                  </div>
                  <div>
                    <p className="font-display text-sm font-bold">{p.draws}</p>
                    <p className="text-[10px] text-muted-foreground">Nuls</p>
                  </div>
                  <div>
                    <p className="font-display text-sm font-bold text-destructive">{p.losses}</p>
                    <p className="text-[10px] text-muted-foreground">Défaites</p>
                  </div>
                </div>
                <p className="mt-3 text-xs text-muted-foreground">
                  {played ? `${Math.round((p.wins / played) * 100)}% de réussite` : "Aucun duel joué"}{" "}
                  · Gains {fcfa(p.total_earnings)}
                </p>
                <div className="mt-3 grid grid-cols-2 gap-2">
                  <Button size="sm" onClick={() => setTarget(p)}>
                    <Target className="size-4" /> Défier
                  </Button>
                  <Button size="sm" variant="outline" asChild>
                    <Link to="/messages" search={{ u: p.id, c: undefined }}>
                      <MessageCircle className="size-4" /> Message
                    </Link>
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <EmptyState text={players.isLoading ? "Chargement…" : "Aucun joueur trouvé."} />
      )}

      <Dialog open={!!target} onOpenChange={(o) => !o && setTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Défier {target?.username}</DialogTitle>
            <DialogDescription>
              Solde disponible : {fcfa(wallet?.balance_available)}. La mise est bloquée dès que
              l'adversaire accepte.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="amount">Enjeu (FCFA)</Label>
              <Input
                id="amount"
                type="number"
                min={100}
                step={100}
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
              />
            </div>
            <div>
              <Label htmlFor="minutes">Expiration (minutes)</Label>
              <Input
                id="minutes"
                type="number"
                min={5}
                max={180}
                value={minutes}
                onChange={(e) => setMinutes(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setTarget(null)}>
              Annuler
            </Button>
            <Button
              disabled={challenge.isPending || Number(amount) <= 0}
              onClick={() => challenge.mutate()}
            >
              Envoyer le défi
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}