import { createServerFn } from "@tanstack/react-start";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

type ChatMessage = { role: "user" | "assistant"; content: string };
type AssistantRole = "admin" | "player";

type AssistantContext = {
  role: AssistantRole;
  username: string;
  profileSummary: string;
  walletSummary: string;
  operationalSummary: string;
};

const BASE_SYSTEM_PROMPT = `Tu es l'assistant officiel de SKILL2CASH, plateforme de duels eFootball 1v1 en argent réel (FCFA).
Réponds TOUJOURS en français, de façon courte, concrète et utile.
Tu dois être précis, pragmatique et ne jamais inventer de données.
Tu ne divulges jamais de clés, secrets, tokens, identifiants techniques, ni de données non autorisées.
Si la question sort du cadre de SKILL2CASH ou d'eFootball, dis-le poliment.`;

const PLAYER_SYSTEM_PROMPT = `Mode joueur:
- Réponds uniquement avec les informations autorisées pour le compte connecté.
- Tu peux expliquer les règles, les défis, les duels, les votes, le portefeuille, Telegram et l'historique du joueur.
- Ne révèle jamais les données sensibles d'autres joueurs, ni les files de validation admin, ni les logs internes.
- Si une question demande une donnée réservée à l'administration, indique que seul un admin peut la consulter.`;

const ADMIN_SYSTEM_PROMPT = `Mode administrateur:
- Réponds comme un assistant d'exploitation interne.
- Tu peux parler des queues de validation, des litiges, des dépôts, des retraits, des comptes et des indicateurs opérationnels.
- Tu restes prudent avec les données sensibles: ne divulgue jamais de secrets techniques, de clés, ni de contenu inutilement exhaustif.
- Si une action nécessite une confirmation ou une validation humaine, rappelle-le clairement.`;

function buildSystemPrompt(role: AssistantRole, context: AssistantContext) {
  return [
    BASE_SYSTEM_PROMPT,
    role === "admin" ? ADMIN_SYSTEM_PROMPT : PLAYER_SYSTEM_PROMPT,
    "",
    `Contexte autorisé du compte connecté:`,
    `- utilisateur: ${context.username}`,
    `- profil: ${context.profileSummary}`,
    `- portefeuille: ${context.walletSummary}`,
    `- contexte opérationnel: ${context.operationalSummary}`,
  ].join("\n");
}

async function loadAssistantContext(userId: string): Promise<AssistantContext> {
  const [
    rolesRes,
    profileRes,
    walletRes,
    pendingDepositsRes,
    pendingWithdrawalsRes,
    disputesRes,
    usernameRequestsRes,
    ownChallengesRes,
    ownDuelsRes,
  ] = await Promise.all([
    supabaseAdmin.from("user_roles").select("role").eq("user_id", userId),
    supabaseAdmin
      .from("profiles")
      .select(
        "username, efootball_username, country, level, status, is_banned, wins, losses, draws, current_streak, total_earnings, reputation, telegram_chat_id, telegram_username",
      )
      .eq("id", userId)
      .maybeSingle(),
    supabaseAdmin
      .from("wallets")
      .select(
        "balance_available, balance_locked, total_deposited, total_withdrawn, total_won, total_lost",
      )
      .eq("user_id", userId)
      .maybeSingle(),
    supabaseAdmin
      .from("deposits")
      .select("id", { count: "exact", head: true })
      .eq("status", "pending"),
    supabaseAdmin
      .from("withdrawals")
      .select("id", { count: "exact", head: true })
      .eq("status", "pending"),
    supabaseAdmin
      .from("duels")
      .select("id", { count: "exact", head: true })
      .eq("status", "dispute"),
    supabaseAdmin
      .from("username_change_requests")
      .select("id", { count: "exact", head: true })
      .eq("status", "pending"),
    supabaseAdmin
      .from("challenges")
      .select("id, amount, status, created_at, challenger_id, challenged_id")
      .or(`challenger_id.eq.${userId},challenged_id.eq.${userId}`)
      .in("status", ["pending", "counter_offer", "accepted"])
      .order("created_at", { ascending: false })
      .limit(5),
    supabaseAdmin
      .from("duels")
      .select("id, amount, status, created_at, winner_id, loser_id, is_draw")
      .or(`player1_id.eq.${userId},player2_id.eq.${userId}`)
      .order("created_at", { ascending: false })
      .limit(5),
  ]);

  const role = (rolesRes.data ?? []).some((row) => row.role === "admin") ? "admin" : "player";
  const profile = profileRes.data;
  const wallet = walletRes.data;

  const profileSummary = profile
    ? [
        `${profile.username} (${profile.efootball_username})`,
        `${profile.level} · ${profile.country}`,
        `statut ${profile.status}${profile.is_banned ? " · banni" : ""}`,
        `${profile.wins}V / ${profile.draws}N / ${profile.losses}D`,
        `série ${profile.current_streak}`,
        `réputation ${profile.reputation}/100`,
        `gains ${profile.total_earnings} FCFA`,
        profile.telegram_chat_id ? "Telegram lié" : "Telegram non lié",
      ].join(" · ")
    : "profil introuvable";

  const walletSummary = wallet
    ? [
        `disponible ${wallet.balance_available} FCFA`,
        `bloqué ${wallet.balance_locked} FCFA`,
        `déposé ${wallet.total_deposited} FCFA`,
        `retiré ${wallet.total_withdrawn} FCFA`,
        `gagné ${wallet.total_won} FCFA`,
        `perdu ${wallet.total_lost} FCFA`,
      ].join(" · ")
    : "portefeuille introuvable";

  const operationalSummary =
    role === "admin"
      ? [
          `dépôts en attente ${pendingDepositsRes.count ?? 0}`,
          `retraits en attente ${pendingWithdrawalsRes.count ?? 0}`,
          `litiges ouverts ${disputesRes.count ?? 0}`,
          `changements de pseudo en attente ${usernameRequestsRes.count ?? 0}`,
          `défis actifs ${ownChallengesRes.data?.length ?? 0}`,
          `duels récents ${ownDuelsRes.data?.length ?? 0}`,
        ].join(" · ")
      : [
          `défis actifs ${ownChallengesRes.data?.length ?? 0}`,
          `duels récents ${ownDuelsRes.data?.length ?? 0}`,
          `litiges persos ${ownDuelsRes.data?.filter((d) => d.status === "dispute").length ?? 0}`,
          `dépôt/retrait visibles uniquement pour le compte connecté`,
        ].join(" · ");

  return {
    role,
    username: profile?.username ?? "joueur",
    profileSummary,
    walletSummary,
    operationalSummary,
  };
}

export const askAssistant = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data: { messages: ChatMessage[] }) => {
    if (!data || !Array.isArray(data.messages)) throw new Error("Requête invalide");
    const messages = data.messages
      .filter((m) => (m.role === "user" || m.role === "assistant") && typeof m.content === "string")
      .slice(-12)
      .map((m) => ({ role: m.role, content: m.content.slice(0, 2000) }));
    if (!messages.length) throw new Error("Message vide");
    return { messages };
  })
  .handler(async ({ data, context }) => {
    const apiKey = process.env["LOVABLE_API_KEY"];
    if (!apiKey) return { reply: "L'assistant est momentanément indisponible." };

    const assistantContext = await loadAssistantContext(context.userId);
    const systemPrompt = buildSystemPrompt(assistantContext.role, assistantContext);
    const modelCandidates = [
      process.env["ASSISTANT_MODEL"] ?? "deepseek-r1",
      "google/gemini-2.5-flash",
    ];

    for (const model of modelCandidates) {
      const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model,
          messages: [{ role: "system", content: systemPrompt }, ...data.messages],
          temperature: 0.2,
        }),
      });

      if (!res.ok) {
        console.error("[assistant] gateway error", model, res.status, await res.text());
        continue;
      }

      const json = (await res.json()) as {
        choices?: { message?: { content?: string } }[];
      };
      return {
        reply: json.choices?.[0]?.message?.content ?? "Je n'ai pas de réponse pour l'instant.",
        role: assistantContext.role,
      };
    }

    return {
      reply: "L'assistant n'a pas pu répondre. Réessaie dans un instant.",
      role: assistantContext.role,
    };
  });
