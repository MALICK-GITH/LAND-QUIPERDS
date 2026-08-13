import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { AlertTriangle, ImagePlus, Send, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";

import { EmptyState, PageTitle, StatCard, StatusChip } from "@/components/skill2cash/ui-bits";
import { attachmentPath, ChatAttachment, validateChatImage } from "@/components/skill2cash/chat-attachment";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useMe } from "@/hooks/use-s2c";
import { supabase } from "@/integrations/supabase/client";
import { fetchProfileMap } from "@/lib/profiles";
import {
  DUEL_STATUS_LABELS,
  VOTE_LABELS,
  dateFr,
  errMessage,
  fcfa,
  type Duel,
  type DuelMessage,
} from "@/lib/s2c";

const VICTORY_RULES = [
  {
    title: "Victoire",
    body: "Tu as gagné si le score final te donne plus de buts que ton adversaire.",
  },
  {
    title: "Match nul",
    body: "Le duel est nul si les deux joueurs terminent avec le même score.",
  },
  {
    title: "Défaite",
    body: "Tu as perdu si ton adversaire marque plus de buts que toi.",
  },
  {
    title: "Connexion perdue",
    body: "Même sans réseau, ce bloc reste visible dans l'écran déjà ouvert. Le règlement du duel sera repris dès le retour de connexion.",
  },
] as const;

export const Route = createFileRoute("/_authenticated/duels/$id")({
  head: () => ({
    meta: [
      { title: "Chambre de duel — SKILL2CASH" },
      { name: "description", content: "Chambre de duel : chat, vote du résultat et règlement." },
      { property: "og:title", content: "Chambre de duel — SKILL2CASH" },
      { property: "og:description", content: "Chat, vote du résultat et règlement du duel." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: DuelRoom,
});

function DuelRoom() {
  const { id } = Route.useParams();
  const { user } = useMe();
  const qc = useQueryClient();
  const [body, setBody] = useState("");
  const [reason, setReason] = useState("");
  const [showDispute, setShowDispute] = useState(false);
  const [attachment, setAttachment] = useState<File | null>(null);
  const [asEvidence, setAsEvidence] = useState(false);
  const [isOnline, setIsOnline] = useState(
    typeof window === "undefined" ? true : window.navigator.onLine,
  );
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);
    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  const duel = useQuery({
    queryKey: ["duel", id],
    queryFn: async () => {
      const { data, error } = await supabase.from("duels").select("*").eq("id", id).maybeSingle();
      if (error) throw error;
      if (!data) return null;
      const row = data as Duel;
      const profiles = await fetchProfileMap([row.player1_id, row.player2_id]);
      return { row, profiles };
    },
  });

  const messages = useQuery({
    queryKey: ["duel-messages", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("duel_messages")
        .select("*")
        .eq("duel_id", id)
        .order("created_at", { ascending: true });
      if (error) throw error;
      return (data ?? []) as DuelMessage[];
    },
  });

  useEffect(() => {
    const channelName = `duel-room-${id}-${crypto.randomUUID()}`;
    const channel = supabase
      .channel(channelName)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "duel_messages", filter: `duel_id=eq.${id}` },
        () => void qc.invalidateQueries({ queryKey: ["duel-messages", id] }),
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "duels", filter: `id=eq.${id}` },
        () => {
          void qc.invalidateQueries({ queryKey: ["duel", id] });
          void qc.invalidateQueries({ queryKey: ["me"] });
        },
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [id, qc]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ block: "end" });
  }, [messages.data?.length]);

  const send = useMutation({
    mutationFn: async () => {
      const text = body.trim();
      if ((!text && !attachment) || !user) return;
      let path: string | null = null;
      if (attachment) {
        const validationError = validateChatImage(attachment);
        if (validationError) throw new Error(validationError);
        path = attachmentPath(user.id, attachment);
        const { error: uploadError } = await supabase.storage.from("chat-evidence").upload(path, attachment, { contentType: attachment.type, upsert: false });
        if (uploadError) throw uploadError;
      }
      const { error } = await supabase
        .from("duel_messages")
        .insert({ duel_id: id, sender_id: user.id, body: text.slice(0, 1000), attachment_path: path, attachment_name: attachment?.name ?? null, attachment_type: attachment?.type ?? null, attachment_size: attachment?.size ?? null, is_dispute_evidence: Boolean(path && asEvidence) });
      if (error) { if (path) await supabase.storage.from("chat-evidence").remove([path]); throw error; }
    },
    onSuccess: () => {
      setBody("");
      setAttachment(null);
      setAsEvidence(false);
      void qc.invalidateQueries({ queryKey: ["duel-messages", id] });
    },
    onError: (e) => toast.error(errMessage(e)),
  });

  const vote = useMutation({
    mutationFn: async (v: "win" | "draw" | "lose") => {
      const { data, error } = await supabase.rpc("submit_duel_vote", { p_duel: id, p_vote: v });
      if (error) throw error;
      return data as string;
    },
    onSuccess: (outcome) => {
      void qc.invalidateQueries();
      if (outcome === "waiting") toast.success("Vote enregistré. En attente de l'adversaire.");
      else if (outcome === "dispute")
        toast.error("Votes incohérents : un administrateur va arbitrer.");
      else toast.success("Duel réglé ! Portefeuille mis à jour.");
    },
    onError: (e) => toast.error(errMessage(e)),
  });

  const dispute = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.rpc("open_duel_dispute", {
        p_duel: id,
        p_reason: reason.trim().slice(0, 500),
      });
      if (error) throw error;
    },
    onSuccess: () => {
      setShowDispute(false);
      setReason("");
      toast.success("Litige ouvert. Un administrateur va trancher.");
      void qc.invalidateQueries({ queryKey: ["duel", id] });
    },
    onError: (e) => toast.error(errMessage(e)),
  });

  if (duel.isLoading)
    return (
      <div>
        <PageTitle
          title="Chambre de duel"
          subtitle={
            isOnline
              ? "Chargement du duel en cours."
              : "Mode hors ligne : les règles de victoire restent visibles."
          }
          action={<StatusChip status={isOnline ? "active" : "cancelled"} label={isOnline ? "Chargement" : "Hors ligne"} />}
        />
        <VictoryRulesCard isOnline={isOnline} />
        <EmptyState
          text={
            isOnline
              ? "Chargement du duel…"
              : "Connexion perdue. Les règles sont disponibles pendant la coupure réseau."
          }
        />
      </div>
    );
  if (!duel.data)
    return (
      <div>
        <PageTitle
          title="Chambre de duel"
          subtitle={
            isOnline
              ? "Connexion active, mais le duel n'a pas pu être chargé."
              : "Mode hors ligne : les règles de victoire restent visibles."
          }
          action={<StatusChip status={isOnline ? "active" : "cancelled"} label={isOnline ? "Erreur de chargement" : "Hors ligne"} />}
        />
        <VictoryRulesCard isOnline={isOnline} />
        <EmptyState
          text={
            isOnline
              ? "Duel introuvable ou inaccessible."
              : "Connexion perdue. Ouvre à nouveau le duel dès que le réseau revient."
          }
        />
      </div>
    );

  const d = duel.data.row;
  const profiles = duel.data.profiles;
  const isP1 = d.player1_id === user?.id;
  const me = profiles[user?.id ?? ""];
  const opponent = profiles[isP1 ? d.player2_id : d.player1_id];
  const myVote = isP1 ? d.player1_vote : d.player2_vote;
  const theirVote = isP1 ? d.player2_vote : d.player1_vote;
  const canVote = ["active", "waiting_votes"].includes(d.status) && !myVote;
  const roomClosed = ["finished", "cancelled"].includes(d.status);
  const pot = Number(d.amount) * 2;
  const payout = pot - Number(d.commission_amount);
  const result = !["finished"].includes(d.status)
    ? null
    : d.is_draw
      ? "Match nul — remboursement partiel"
      : d.winner_id === user?.id
        ? `Victoire — ${fcfa(payout)} encaissés`
        : "Défaite — mise perdue";

  return (
    <div>
      <PageTitle
        title={`${me?.username ?? "Toi"} vs ${opponent?.username ?? "adversaire"}`}
        subtitle={`Duel de ${fcfa(d.amount)} par joueur · ${dateFr(d.created_at)}`}
        action={
          <div className="flex flex-wrap items-center gap-2">
            {!isOnline && <StatusChip status="cancelled" label="Hors ligne" />}
            <StatusChip status={d.status} label={DUEL_STATUS_LABELS[d.status]} />
          </div>
        }
      />

      <VictoryRulesCard isOnline={isOnline} />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Pot total" value={fcfa(pot)} tone="neon" />
        <StatCard
          label="Commission"
          value={fcfa(d.commission_amount)}
          hint={`${Math.round(Number(d.commission_rate) * 100)}% du pot`}
        />
        <StatCard label="Gain du vainqueur" value={fcfa(payout)} tone="accent" />
        <StatCard
          label="Pseudo eFootball adverse"
          value={opponent?.efootball_username ?? "—"}
          hint="À rechercher dans le jeu"
        />
      </div>

      {result && (
        <div className="panel mt-6 p-4 text-center clip-corner">
          <p className="font-display text-lg font-bold text-primary">{result}</p>
          {d.admin_note && (
            <p className="mt-1 text-xs text-muted-foreground">Note admin : {d.admin_note}</p>
          )}
          <p className="mt-2 font-mono text-[10px] tracking-widest text-muted-foreground uppercase">
            Salle fermée automatiquement après les deux votes · {dateFr(d.finished_at)}
          </p>
        </div>
      )}

      {d.status === "cancelled" && !result && (
        <div className="panel mt-6 p-4 text-center clip-corner">
          <p className="font-display text-lg font-bold text-primary">Duel annulé</p>
          <p className="mt-2 font-mono text-[10px] tracking-widest text-muted-foreground uppercase">
            Salle fermée
          </p>
        </div>
      )}

      {d.status === "dispute" && (
        <div className="mt-6 border border-neon/50 bg-neon/10 p-4">
          <p className="flex items-center gap-2 font-display text-sm font-bold text-neon">
            <AlertTriangle className="size-4" /> Litige en cours
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            {d.dispute_reason ?? "Un administrateur examine ce duel."} Décision attendue avant{" "}
            {dateFr(d.manual_review_due_at)}.
          </p>
        </div>
      )}

      <div className="mt-8 grid gap-6 lg:grid-cols-2">
        <section>
          <h2 className="mb-3 font-display text-sm font-bold tracking-widest uppercase">
            Vote du résultat
          </h2>
          <div className="panel p-4 clip-corner">
            {roomClosed ? (
              <div className="space-y-2 text-sm">
                <p className="font-display font-bold text-primary">Votes clôturés</p>
                <p>
                  Ton vote :{" "}
                  <span className="font-bold">{myVote ? VOTE_LABELS[myVote] : "aucun"}</span> · Vote
                  adverse :{" "}
                  <span className="font-bold">{theirVote ? VOTE_LABELS[theirVote] : "aucun"}</span>
                </p>
                <p className="text-xs text-muted-foreground">
                  La salle s'est fermée automatiquement dès que les deux joueurs ont voté. Aucune
                  action n'est plus possible ici.
                </p>
              </div>
            ) : canVote ? (
              <>
                <p className="text-sm text-muted-foreground">
                  Déclare honnêtement ton résultat. Si les deux votes concordent, le règlement est
                  automatique et instantané.
                </p>
                <div className="mt-4 grid grid-cols-3 gap-2">
                  <Button disabled={vote.isPending} onClick={() => vote.mutate("win")}>
                    J'ai gagné
                  </Button>
                  <Button
                    variant="secondary"
                    disabled={vote.isPending}
                    onClick={() => vote.mutate("draw")}
                  >
                    Match nul
                  </Button>
                  <Button
                    variant="outline"
                    disabled={vote.isPending}
                    onClick={() => vote.mutate("lose")}
                  >
                    J'ai perdu
                  </Button>
                </div>
              </>
            ) : (
              <div className="space-y-2 text-sm">
                <p>
                  Ton vote :{" "}
                  <span className="font-bold text-primary">
                    {myVote ? VOTE_LABELS[myVote] : "aucun"}
                  </span>
                </p>
                <p>
                  Vote adverse :{" "}
                  <span className="font-bold text-primary">
                    {theirVote ? VOTE_LABELS[theirVote] : "en attente"}
                  </span>
                </p>
                {d.status === "waiting_votes" && (
                  <p className="text-xs text-muted-foreground">
                    Le duel se règlera dès que les deux votes seront cohérents.
                  </p>
                )}
              </div>
            )}

            {!roomClosed && ["active", "waiting_votes"].includes(d.status) && (
              <div className="mt-4 border-t border-border/50 pt-4">
                {showDispute ? (
                  <div className="space-y-2">
                    <Textarea
                      value={reason}
                      onChange={(e) => setReason(e.target.value)}
                      maxLength={500}
                      placeholder="Explique le problème (triche, abandon, refus de jouer…)"
                    />
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        variant="destructive"
                        disabled={dispute.isPending || reason.trim().length < 10}
                        onClick={() => dispute.mutate()}
                      >
                        Ouvrir le litige
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => setShowDispute(false)}>
                        Annuler
                      </Button>
                    </div>
                  </div>
                ) : (
                  <Button size="sm" variant="ghost" onClick={() => setShowDispute(true)}>
                    <AlertTriangle className="size-4" /> Signaler un problème
                  </Button>
                )}
              </div>
            )}
          </div>
        </section>

        <section>
          <h2 className="mb-3 font-display text-sm font-bold tracking-widest uppercase">
            Chat du duel
          </h2>
          <div className="panel flex h-[420px] flex-col clip-corner">
            <div className="flex-1 space-y-2 overflow-y-auto p-4">
              {messages.data?.length ? (
                messages.data.map((m) => {
                  const mine = m.sender_id === user?.id;
                  return (
                    <div key={m.id} className={mine ? "text-right" : "text-left"}>
                      <span
                        className={
                          mine
                            ? "inline-block max-w-[85%] border border-primary/40 bg-primary/10 px-3 py-2 text-left text-sm"
                            : "inline-block max-w-[85%] border border-border bg-muted/20 px-3 py-2 text-left text-sm"
                        }
                      >
                         {m.body && <span className="block">{m.body}</span>}
                         {m.attachment_path && <ChatAttachment path={m.attachment_path} name={m.attachment_name} evidence={m.is_dispute_evidence} />}
                      </span>
                      <p className="mt-0.5 font-mono text-[10px] text-muted-foreground">
                        {mine ? "Toi" : (opponent?.username ?? "adversaire")} · {dateFr(m.created_at)}
                      </p>
                    </div>
                  );
                })
              ) : (
                <p className="py-10 text-center text-sm text-muted-foreground">
                  Aucun message. Organise la partie avec ton adversaire.
                </p>
              )}
              <div ref={bottomRef} />
            </div>
            {roomClosed ? (
              <p className="border-t border-border/50 p-3 text-center text-xs text-muted-foreground">
                Salle fermée : le chat est en lecture seule.
              </p>
            ) : (
            <form
              className="border-t border-border/50 p-3"
              onSubmit={(e) => {
                e.preventDefault();
                send.mutate();
              }}
            >
              {attachment && (
                <div className="mb-2 flex flex-wrap items-center gap-2 border border-border bg-muted/20 px-3 py-2 text-xs">
                  <span className="min-w-0 flex-1 truncate">📷 {attachment.name}</span>
                  <label className="flex items-center gap-2 text-muted-foreground"><input type="checkbox" checked={asEvidence} onChange={(e) => setAsEvidence(e.target.checked)} /> Associer au litige</label>
                  <Button type="button" size="icon" variant="ghost" onClick={() => { setAttachment(null); setAsEvidence(false); }} aria-label="Retirer la capture"><X className="size-4" /></Button>
                </div>
              )}
              <div className="flex gap-2">
                <Button type="button" size="icon" variant="outline" asChild>
                  <label aria-label="Joindre une capture" title="Joindre une capture"><ImagePlus className="size-4" /><input type="file" accept="image/jpeg,image/png,image/webp" className="sr-only" onChange={(e) => { const file = e.target.files?.[0] ?? null; if (file) { const error = validateChatImage(file); if (error) toast.error(error); else setAttachment(file); } e.target.value = ""; }} /></label>
                </Button>
                <Input value={body} onChange={(e) => setBody(e.target.value)} maxLength={1000} placeholder="Écrire un message…" />
                <Button type="submit" size="icon" disabled={send.isPending || (!body.trim() && !attachment)}><Send className="size-4" /></Button>
              </div>
            </form>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}

function VictoryRulesCard({ isOnline }: { isOnline: boolean }) {
  return (
    <section className="panel mb-6 p-4 clip-corner">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="font-display text-sm font-bold tracking-widest uppercase">
            Règles de victoire
          </h2>
          <p className="mt-1 text-xs text-muted-foreground">
            Affichage persistant dans la session, même si la connexion tombe.
          </p>
        </div>
        <StatusChip status={isOnline ? "active" : "cancelled"} label={isOnline ? "En ligne" : "Hors ligne"} />
      </div>

      <div className="mt-4 grid gap-3 md:grid-cols-2">
        {VICTORY_RULES.map((rule) => (
          <div key={rule.title} className="border border-border/70 bg-muted/10 p-3">
            <p className="font-display text-sm font-bold text-primary">{rule.title}</p>
            <p className="mt-1 text-sm text-muted-foreground">{rule.body}</p>
          </div>
        ))}
      </div>
    </section>
  );
}
