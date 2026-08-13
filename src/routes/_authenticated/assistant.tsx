import { useMutation } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { Send, Sparkles } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";

import { PageTitle } from "@/components/skill2cash/ui-bits";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { askAssistant } from "@/lib/assistant.functions";
import { errMessage } from "@/lib/s2c";

type ChatMessage = { role: "user" | "assistant"; content: string };

const SUGGESTIONS = [
  "Comment fonctionne le vote de résultat ?",
  "Quelle est la commission sur un duel de 10 000 FCFA ?",
  "Combien de temps prend un retrait ?",
  "Que faire si mon adversaire triche ?",
];

export const Route = createFileRoute("/_authenticated/assistant")({
  head: () => ({
    meta: [
      { title: "Assistant — SKILL2CASH" },
      {
        name: "description",
        content: "Pose tes questions sur les duels, les commissions, les dépôts et les retraits.",
      },
      { property: "og:title", content: "Assistant — SKILL2CASH" },
      { property: "og:description", content: "Aide instantanée sur les règles de la plateforme." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: AssistantPage,
});

function AssistantPage() {
  const ask = useServerFn(askAssistant);
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      role: "assistant",
      content:
        "Salut ! Je suis l'assistant SKILL2CASH. Pose-moi une question sur les duels, les commissions, les dépôts ou les retraits.",
    },
  ]);
  const [input, setInput] = useState("");
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ block: "end" });
  }, [messages.length]);

  const send = useMutation({
    mutationFn: async (text: string) => {
      const next: ChatMessage[] = [...messages, { role: "user", content: text }];
      setMessages(next);
      setInput("");
      const res = await ask({ data: { messages: next } });
      return res.reply;
    },
    onSuccess: (reply) => setMessages((m) => [...m, { role: "assistant", content: reply }]),
    onError: (e) => toast.error(errMessage(e)),
  });

  return (
    <div>
      <PageTitle
        title="Assistant"
        subtitle="Une question sur les règles, les mises ou les paiements ? Demande."
      />

      <div className="panel flex h-[560px] flex-col clip-corner">
        <div className="flex-1 space-y-3 overflow-y-auto p-5">
          {messages.map((m, i) => (
            <div key={i} className={m.role === "user" ? "text-right" : "text-left"}>
              <span
                className={
                  m.role === "user"
                    ? "inline-block max-w-[85%] border border-primary/40 bg-primary/10 px-3 py-2 text-left text-sm whitespace-pre-wrap"
                    : "inline-block max-w-[85%] border border-border bg-muted/20 px-3 py-2 text-left text-sm whitespace-pre-wrap"
                }
              >
                {m.content}
              </span>
            </div>
          ))}
          {send.isPending && (
            <p className="flex items-center gap-2 text-xs text-muted-foreground">
              <Sparkles className="size-3 animate-pulse" /> L'assistant réfléchit…
            </p>
          )}
          <div ref={bottomRef} />
        </div>

        <div className="flex flex-wrap gap-2 border-t border-border/50 px-4 pt-3">
          {SUGGESTIONS.map((s) => (
            <button
              key={s}
              type="button"
              disabled={send.isPending}
              onClick={() => send.mutate(s)}
              className="border border-border px-2 py-1 text-xs text-muted-foreground transition-colors hover:border-primary/60 hover:text-primary"
            >
              {s}
            </button>
          ))}
        </div>

        <form
          className="flex gap-2 p-4"
          onSubmit={(e) => {
            e.preventDefault();
            const text = input.trim();
            if (text) send.mutate(text);
          }}
        >
          <Input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            maxLength={2000}
            placeholder="Écris ta question…"
          />
          <Button type="submit" size="icon" disabled={send.isPending || !input.trim()}>
            <Send className="size-4" />
          </Button>
        </form>
      </div>
    </div>
  );
}