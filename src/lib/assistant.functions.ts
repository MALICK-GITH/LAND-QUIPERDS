import { createServerFn } from "@tanstack/react-start";

type ChatMessage = { role: "user" | "assistant"; content: string };

const SYSTEM_PROMPT = `Tu es l'assistant officiel de SKILL2CASH, plateforme de duels eFootball 1v1 en argent réel (FCFA).
Réponds TOUJOURS en français, de façon courte, concrète et amicale.
Règles de la plateforme que tu dois connaître :
- Les joueurs se défient en 1v1, chacun mise le même montant. Le pot est de 2x la mise.
- Commission plateforme : 9% pour les petites mises, 8% en moyenne, 5% pour les grosses mises. En cas de match nul, la commission est partagée et le reste remboursé.
- Après la partie, chaque joueur vote Gagné / Nul / Perdu. Si les votes concordent, le règlement est automatique et instantané.
- Si les votes sont incohérents, un litige est ouvert et un administrateur tranche sous 24 h.
- Dépôts et retraits se font par Wave ou MTN Money, avec validation manuelle par un administrateur. Retrait minimum 1 000 FCFA.
- Ne promets jamais de gains, ne donne aucun conseil de paris irresponsable, rappelle de jouer avec modération.
Si la question sort du cadre de SKILL2CASH ou d'eFootball, dis-le poliment.`;

export const askAssistant = createServerFn({ method: "POST" })
  .inputValidator((data: { messages: ChatMessage[] }) => {
    if (!data || !Array.isArray(data.messages)) throw new Error("Requête invalide");
    const messages = data.messages
      .filter((m) => (m.role === "user" || m.role === "assistant") && typeof m.content === "string")
      .slice(-12)
      .map((m) => ({ role: m.role, content: m.content.slice(0, 2000) }));
    if (!messages.length) throw new Error("Message vide");
    return { messages };
  })
  .handler(async ({ data }) => {
    const apiKey = process.env["LOVABLE_API_KEY"];
    if (!apiKey) return { reply: "L'assistant est momentanément indisponible." };

    const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [{ role: "system", content: SYSTEM_PROMPT }, ...data.messages],
      }),
    });

    if (!res.ok) {
      console.error("[assistant] gateway error", res.status, await res.text());
      if (res.status === 429)
        return { reply: "Trop de questions d'un coup. Réessaie dans quelques secondes." };
      return { reply: "L'assistant n'a pas pu répondre. Réessaie dans un instant." };
    }

    const json = (await res.json()) as {
      choices?: { message?: { content?: string } }[];
    };
    return {
      reply: json.choices?.[0]?.message?.content ?? "Je n'ai pas de réponse pour l'instant.",
    };
  });