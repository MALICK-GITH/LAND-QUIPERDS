import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { ArrowLeft, ImagePlus, MessageCircle, Search, Send, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";

import { EmptyState, PageTitle } from "@/components/skill2cash/ui-bits";
import { attachmentPath, ChatAttachment, validateChatImage } from "@/components/skill2cash/chat-attachment";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useMe } from "@/hooks/use-s2c";
import { supabase } from "@/integrations/supabase/client";
import { fetchProfileMap } from "@/lib/profiles";
import { errMessage, relativeFr, type DirectMessage, type Profile } from "@/lib/s2c";
import { cn } from "@/lib/utils";

type Conversation = {
  id: string;
  user_low: string;
  user_high: string;
  last_message_at: string;
  last_message_preview: string | null;
};

export const Route = createFileRoute("/_authenticated/messages")({
  validateSearch: (search: Record<string, unknown>) => ({
    c: typeof search['c'] === "string" ? (search['c'] as string) : undefined,
    u: typeof search['u'] === "string" ? (search['u'] as string) : undefined,
  }),
  head: () => ({
    meta: [
      { title: "Messagerie — SKILL2CASH" },
      {
        name: "description",
        content: "Discute en privé avec les autres joueurs SKILL2CASH avant et après tes duels.",
      },
      { property: "og:title", content: "Messagerie — SKILL2CASH" },
      { property: "og:description", content: "Messages privés entre joueurs, en temps réel." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: MessagesPage,
});

function MessagesPage() {
  const { c: activeId, u: targetUser } = Route.useSearch();
  const navigate = useNavigate();
  const { user } = useMe();
  const qc = useQueryClient();
  const [body, setBody] = useState("");
  const [search, setSearch] = useState("");
  const [attachment, setAttachment] = useState<File | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  // Ouverture directe d'une conversation depuis la fiche d'un joueur.
  useEffect(() => {
    if (!targetUser || !user) return;
    void (async () => {
      const { data, error } = await supabase.rpc("start_conversation", { p_other: targetUser });
      if (error) {
        toast.error(errMessage(error));
        return;
      }
      await qc.invalidateQueries({ queryKey: ["conversations"] });
      void navigate({ to: "/messages", search: { c: data as string, u: undefined }, replace: true });
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [targetUser, user?.id]);

  const conversations = useQuery({
    queryKey: ["conversations", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("conversations")
        .select("*")
        .order("last_message_at", { ascending: false })
        .limit(100);
      if (error) throw error;
      const rows = (data ?? []) as Conversation[];
      const profiles = await fetchProfileMap(rows.flatMap((r) => [r.user_low, r.user_high]));

      const unreadRes = await supabase
        .from("direct_messages")
        .select("conversation_id, sender_id, read_at")
        .is("read_at", null)
        .limit(500);
      const unread: Record<string, number> = {};
      for (const m of unreadRes.data ?? []) {
        if (m.sender_id === user!.id) continue;
        unread[m.conversation_id] = (unread[m.conversation_id] ?? 0) + 1;
      }
      return { rows, profiles, unread };
    },
  });

  const thread = useQuery({
    queryKey: ["dm-thread", activeId],
    enabled: !!activeId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("direct_messages")
        .select("*")
        .eq("conversation_id", activeId!)
        .order("created_at", { ascending: true })
        .limit(300);
      if (error) throw error;
      await supabase.rpc("mark_conversation_read", { p_conversation: activeId! });
      return (data ?? []) as DirectMessage[];
    },
  });

  useEffect(() => {
    if (!user) return;
    const channelName = `dm-stream-${user.id}-${crypto.randomUUID()}`;
    const channel = supabase
      .channel(channelName)
      .on("postgres_changes", { event: "*", schema: "public", table: "direct_messages" }, () => {
        void qc.invalidateQueries({ queryKey: ["dm-thread"] });
        void qc.invalidateQueries({ queryKey: ["conversations"] });
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "conversations" }, () => {
        void qc.invalidateQueries({ queryKey: ["conversations"] });
      })
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [user?.id, qc, user]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ block: "end" });
  }, [thread.data?.length, activeId]);

  const send = useMutation({
    mutationFn: async () => {
      const text = body.trim();
      if ((!text && !attachment) || !activeId || !user) return;
      let path: string | null = null;
      if (attachment) {
        const validationError = validateChatImage(attachment);
        if (validationError) throw new Error(validationError);
        path = attachmentPath(user.id, attachment);
        const { error: uploadError } = await supabase.storage.from("chat-evidence").upload(path, attachment, { contentType: attachment.type, upsert: false });
        if (uploadError) throw uploadError;
      }
      const { error } = await supabase.rpc("send_direct_message", {
        p_conversation: activeId,
        p_body: text.slice(0, 2000),
        ...(path ? { p_attachment_path: path } : {}),
        ...(attachment ? {
          p_attachment_name: attachment.name,
          p_attachment_type: attachment.type,
          p_attachment_size: attachment.size,
        } : {}),
      });
      if (error) {
        if (path) await supabase.storage.from("chat-evidence").remove([path]);
        throw error;
      }
    },
    onSuccess: () => {
      setBody("");
      setAttachment(null);
      void qc.invalidateQueries({ queryKey: ["dm-thread", activeId] });
      void qc.invalidateQueries({ queryKey: ["conversations"] });
    },
    onError: (e) => toast.error(errMessage(e)),
  });

  const players = useQuery({
    queryKey: ["dm-players", search],
    enabled: !!user && search.trim().length > 1,
    queryFn: async () => {
      const { data } = await supabase
        .from("profiles")
        .select("*")
        .or(`username.ilike.%${search.trim().replace(/,/g, "")}%,efootball_username.ilike.%${search.trim().replace(/,/g, "")}%`)
        .neq("id", user!.id)
        .limit(10);
      return (data ?? []) as Profile[];
    },
  });

  const rows = conversations.data?.rows ?? [];
  const profiles = conversations.data?.profiles ?? {};
  const unread = conversations.data?.unread ?? {};
  const active = rows.find((r) => r.id === activeId) ?? null;
  const other = (conv: Conversation) =>
    profiles[conv.user_low === user?.id ? conv.user_high : conv.user_low];

  function openConversation(id: string) {
    void navigate({ to: "/messages", search: { c: id, u: undefined } });
  }

  async function startWith(id: string) {
    const { data, error } = await supabase.rpc("start_conversation", { p_other: id });
    if (error) {
      toast.error(errMessage(error));
      return;
    }
    setSearch("");
    await qc.invalidateQueries({ queryKey: ["conversations"] });
    openConversation(data as string);
  }

  return (
    <div>
      <PageTitle
        title="Messagerie"
        subtitle="Discussions privées avec les autres joueurs, en temps réel."
      />

      <div className="grid gap-4 lg:grid-cols-[320px_1fr]">
        <aside className={cn("panel flex flex-col clip-corner", activeId && "hidden lg:flex")}>
          <div className="relative border-b border-border/50 p-3">
            <Search className="pointer-events-none absolute top-1/2 left-6 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Nouvelle discussion : pseudo…"
              className="pl-9"
              maxLength={40}
            />
          </div>

          {search.trim().length > 1 && (
            <div className="border-b border-border/50">
              {(players.data ?? []).length ? (
                (players.data ?? []).map((p) => (
                  <button
                    key={p.id}
                    onClick={() => void startWith(p.id)}
                    className="block w-full px-3 py-2 text-left text-sm hover:bg-primary/10"
                  >
                    <span className="font-semibold text-primary">{p.username}</span>
                    <span className="ml-2 text-xs text-muted-foreground">
                      {p.efootball_username}
                    </span>
                  </button>
                ))
              ) : (
                <p className="p-3 text-xs text-muted-foreground">Aucun joueur trouvé.</p>
              )}
            </div>
          )}

          <div className="max-h-[520px] flex-1 overflow-y-auto">
            {rows.length ? (
              rows.map((conv) => {
                const o = other(conv);
                const count = unread[conv.id] ?? 0;
                return (
                  <button
                    key={conv.id}
                    onClick={() => openConversation(conv.id)}
                    className={cn(
                      "flex w-full items-center gap-3 border-b border-border/40 px-3 py-3 text-left transition-colors hover:bg-primary/5",
                      conv.id === activeId && "bg-primary/10",
                    )}
                  >
                    <span className="flex size-9 shrink-0 items-center justify-center border border-primary/40 bg-primary/10 font-display text-sm font-bold text-primary">
                      {(o?.username ?? "?").slice(0, 2).toUpperCase()}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="flex items-center justify-between gap-2">
                        <span className="truncate font-display text-sm font-bold">
                          {o?.username ?? "joueur"}
                        </span>
                        <span className="font-mono text-[10px] text-muted-foreground">
                          {relativeFr(conv.last_message_at)}
                        </span>
                      </span>
                      <span className="block truncate text-xs text-muted-foreground">
                        {conv.last_message_preview ?? "Nouvelle discussion"}
                      </span>
                    </span>
                    {count > 0 && (
                      <span className="flex size-5 items-center justify-center rounded-full bg-destructive text-[10px] font-bold text-destructive-foreground">
                        {count > 9 ? "9+" : count}
                      </span>
                    )}
                  </button>
                );
              })
            ) : (
              <p className="p-6 text-center text-sm text-muted-foreground">
                Aucune discussion. Cherche un pseudo pour démarrer.
              </p>
            )}
          </div>
        </aside>

        <section className={cn("panel flex h-[560px] flex-col clip-corner", !activeId && "hidden lg:flex")}>
          {active ? (
            <>
              <div className="flex items-center gap-3 border-b border-border/50 p-3">
                <Button
                  variant="ghost"
                  size="icon"
                  className="lg:hidden"
                  onClick={() => void navigate({ to: "/messages", search: { c: undefined, u: undefined } })}
                >
                  <ArrowLeft className="size-4" />
                </Button>
                <div>
                  <p className="font-display text-sm font-bold text-primary">
                    {other(active)?.username ?? "joueur"}
                  </p>
                  <p className="font-mono text-[10px] tracking-widest text-muted-foreground uppercase">
                    {other(active)?.efootball_username ?? "—"}
                  </p>
                </div>
              </div>

              <div className="flex-1 space-y-2 overflow-y-auto p-4">
                {thread.data?.length ? (
                  thread.data.map((m) => {
                    const mine = m.sender_id === user?.id;
                    return (
                      <div key={m.id} className={mine ? "text-right" : "text-left"}>
                        <span
                          className={
                            mine
                              ? "inline-block max-w-[80%] rounded-2xl bg-primary/15 px-3 py-2 text-left text-sm text-foreground"
                              : "inline-block max-w-[80%] rounded-2xl bg-muted/30 px-3 py-2 text-left text-sm text-foreground"
                          }
                        >
                          {m.body && <span className="block">{m.body}</span>}
                          {m.attachment_path && <ChatAttachment path={m.attachment_path} name={m.attachment_name} />}
                        </span>
                        <p className="mt-0.5 font-mono text-[10px] text-muted-foreground">
                          {relativeFr(m.created_at)}
                        </p>
                      </div>
                    );
                  })
                ) : (
                  <p className="py-10 text-center text-sm text-muted-foreground">
                    Aucun message. Écris le premier !
                  </p>
                )}
                <div ref={bottomRef} />
              </div>

              <form
                className="border-t border-border/50 p-3"
                onSubmit={(e) => {
                  e.preventDefault();
                  send.mutate();
                }}
              >
                {attachment && (
                  <div className="mb-2 flex items-center justify-between gap-2 border border-border bg-muted/20 px-3 py-2 text-xs">
                    <span className="truncate">📷 {attachment.name}</span>
                    <Button type="button" size="icon" variant="ghost" onClick={() => setAttachment(null)} aria-label="Retirer la capture"><X className="size-4" /></Button>
                  </div>
                )}
                <div className="flex gap-2">
                  <Button type="button" size="icon" variant="outline" asChild>
                    <label aria-label="Joindre une capture" title="Joindre une capture">
                      <ImagePlus className="size-4" />
                      <input type="file" accept="image/jpeg,image/png,image/webp" className="sr-only" onChange={(e) => {
                        const file = e.target.files?.[0] ?? null;
                        if (file) { const error = validateChatImage(file); if (error) toast.error(error); else setAttachment(file); }
                        e.target.value = "";
                      }} />
                    </label>
                  </Button>
                  <Input value={body} onChange={(e) => setBody(e.target.value)} maxLength={2000} placeholder="Écrire un message…" />
                  <Button type="submit" size="icon" disabled={send.isPending || (!body.trim() && !attachment)}><Send className="size-4" /></Button>
                </div>
              </form>
            </>
          ) : (
            <div className="flex flex-1 items-center justify-center">
              <EmptyState text="Sélectionne une discussion ou cherche un joueur." />
            </div>
          )}
        </section>
      </div>

      <p className="mt-4 flex items-center gap-2 text-xs text-muted-foreground">
        <MessageCircle className="size-3.5" /> Les messages privés sont visibles uniquement par toi
        et ton interlocuteur.
      </p>
    </div>
  );
}
