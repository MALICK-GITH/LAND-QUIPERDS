import { createFileRoute } from "@tanstack/react-router";

import { fcfaTg, safeEqual, telegramWebhookSecret, tgSend } from "@/lib/telegram.server";

const AIDE = [
  "<b>SKILL2CASH — robot officiel</b>",
  "",
  "/lier CODE — connecter ton compte du site",
  "/solde — voir ton portefeuille",
  "/duels — tes duels en cours",
  "/defis — tes défis en attente",
  "/retraits — tes demandes de retrait",
  "/depots — tes dépôts récents",
  "/classement — voir le classement général",
  "/stats — tes statistiques personnelles",
  "/delier — déconnecter ce Telegram",
  "/aide — afficher ce menu",
].join("\n");

export const Route = createFileRoute("/api/public/telegram/webhook")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const provided = request.headers.get("x-telegram-bot-api-secret-token") ?? "";
        if (!safeEqual(provided, telegramWebhookSecret())) {
          return new Response("Unauthorized", { status: 401 });
        }

        const update = (await request.json()) as {
          message?: {
            chat?: { id?: number };
            text?: string;
            from?: { username?: string; first_name?: string };
          };
        };
        const msg = update.message;
        const chatId = msg?.chat?.id;
        const text = (msg?.text ?? "").trim();
        if (typeof chatId !== "number") return Response.json({ ok: true, ignored: true });
        const cid: number = chatId;

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

        const [rawCmd, ...rest] = text.split(/\s+/);
        const cmd = (rawCmd ?? "").toLowerCase().replace(/@.*$/, "");
        const arg = (rest[0] ?? "").toUpperCase();

        async function linkedUser(): Promise<{ id: string; username: string } | null> {
          const { data } = await supabaseAdmin
            .from("profiles")
            .select("id, username")
            .eq("telegram_chat_id", cid)
            .maybeSingle();
          return (data as { id: string; username: string } | null) ?? null;
        }

        if (cmd === "/start" && !arg) {
          await tgSend(
            cid,
            [
              `Bienvenue ${msg?.from?.first_name ?? ""} 👋`,
              "",
              "Pour connecter ton compte : va sur SKILL2CASH → <b>Profil</b> → <b>Robot Telegram</b>, génère ton code puis envoie-le ici avec :",
              "<code>/lier TONCODE</code>",
              "",
              AIDE,
            ].join("\n"),
          );
          return Response.json({ ok: true });
        }

        if (cmd === "/aide" || cmd === "/help") {
          await tgSend(cid, AIDE);
          return Response.json({ ok: true });
        }

        if (cmd === "/lier" || cmd === "/start") {
          if (!arg) {
            await tgSend(cid, "Envoie <code>/lier TONCODE</code> avec le code affiché sur ton profil.");
            return Response.json({ ok: true });
          }
          const { data: code } = await supabaseAdmin
            .from("telegram_link_codes")
            .select("code, user_id, expires_at, used_at")
            .eq("code", arg)
            .maybeSingle();

          const row = code as
            | { code: string; user_id: string; expires_at: string; used_at: string | null }
            | null;
          if (!row || row.used_at || new Date(row.expires_at) < new Date()) {
            await tgSend(cid, "❌ Code invalide ou expiré. Génère un nouveau code sur ton profil.");
            return Response.json({ ok: true });
          }

          // Un Telegram = un compte : on détache l'éventuel ancien compte.
          await supabaseAdmin
            .from("profiles")
            .update({ telegram_chat_id: null, telegram_username: null, telegram_linked_at: null })
            .eq("telegram_chat_id", cid);

          const { error } = await supabaseAdmin
            .from("profiles")
            .update({
              telegram_chat_id: cid,
              telegram_username: msg?.from?.username ?? null,
              telegram_linked_at: new Date().toISOString(),
            })
            .eq("id", row.user_id);
          if (error) {
            await tgSend(cid, "❌ Liaison impossible pour le moment. Réessaie dans un instant.");
            return Response.json({ ok: true });
          }

          await supabaseAdmin
            .from("telegram_link_codes")
            .update({ used_at: new Date().toISOString() })
            .eq("code", row.code);

          const { data: prof } = await supabaseAdmin
            .from("profiles")
            .select("username")
            .eq("id", row.user_id)
            .maybeSingle();

          await tgSend(
            cid,
            `✅ Compte connecté : <b>${(prof as { username?: string } | null)?.username ?? "joueur"}</b>\n\nTu recevras ici tes défis, votes, résultats, litiges et mouvements de portefeuille.`,
            "/tableau-de-bord",
          );
          return Response.json({ ok: true });
        }

        const me = await linkedUser();
        if (!me) {
          await tgSend(cid, "Ton Telegram n'est pas encore lié. Envoie <code>/lier TONCODE</code>.");
          return Response.json({ ok: true });
        }

        if (cmd === "/delier") {
          await supabaseAdmin
            .from("profiles")
            .update({ telegram_chat_id: null, telegram_username: null, telegram_linked_at: null })
            .eq("id", me.id);
          await tgSend(cid, "🔌 Telegram déconnecté de ton compte SKILL2CASH.");
          return Response.json({ ok: true });
        }

        if (cmd === "/solde") {
          const { data: w } = await supabaseAdmin
            .from("wallets")
            .select("balance_available, balance_locked")
            .eq("user_id", me.id)
            .maybeSingle();
          const wallet = w as { balance_available: number; balance_locked: number } | null;
          await tgSend(
            cid,
            [
              `<b>Portefeuille de ${me.username}</b>`,
              `Disponible : ${fcfaTg(wallet?.balance_available)}`,
              `Bloqué : ${fcfaTg(wallet?.balance_locked)}`,
            ].join("\n"),
            "/portefeuille",
          );
          return Response.json({ ok: true });
        }

        if (cmd === "/duels") {
          const { data } = await supabaseAdmin
            .from("duels")
            .select("id, amount, status")
            .or(`player1_id.eq.${me.id},player2_id.eq.${me.id}`)
            .in("status", ["active", "dispute"])
            .order("created_at", { ascending: false })
            .limit(10);
          const rows = (data ?? []) as { id: string; amount: number; status: string }[];
          await tgSend(
            cid,
            rows.length
              ? [
                  "<b>Duels en cours</b>",
                  ...rows.map((d) => `• ${fcfaTg(d.amount)} — ${d.status}`),
                ].join("\n")
              : "Aucun duel en cours.",
            "/duels",
          );
          return Response.json({ ok: true });
        }

        if (cmd === "/defis") {
          const { data } = await supabaseAdmin
            .from("challenges")
            .select("id, amount, status")
            .or(`challenger_id.eq.${me.id},opponent_id.eq.${me.id}`)
            .eq("status", "pending")
            .order("created_at", { ascending: false })
            .limit(10);
          const rows = (data ?? []) as { id: string; amount: number }[];
          await tgSend(
            cid,
            rows.length
              ? ["<b>Défis en attente</b>", ...rows.map((c) => `• ${fcfaTg(c.amount)}`)].join("\n")
              : "Aucun défi en attente.",
            "/defis",
          );
          return Response.json({ ok: true });
        }

        if (cmd === "/retraits") {
          const { data } = await supabaseAdmin
            .from("withdrawals")
            .select("id, amount, status, created_at")
            .eq("user_id", me.id)
            .order("created_at", { ascending: false })
            .limit(5);
          const rows = (data ?? []) as { id: string; amount: number; status: string; created_at: string }[];
          await tgSend(
            cid,
            rows.length
              ? [
                  "<b>Derniers retraits</b>",
                  ...rows.map((r) => `• ${fcfaTg(r.amount)} — ${r.status}`),
                ].join("\n")
              : "Aucun retrait.",
            "/portefeuille",
          );
          return Response.json({ ok: true });
        }

        if (cmd === "/depots") {
          const { data } = await supabaseAdmin
            .from("deposits")
            .select("id, amount, status, created_at")
            .eq("user_id", me.id)
            .order("created_at", { ascending: false })
            .limit(5);
          const rows = (data ?? []) as { id: string; amount: number; status: string; created_at: string }[];
          await tgSend(
            cid,
            rows.length
              ? [
                  "<b>Derniers dépôts</b>",
                  ...rows.map((d) => `• ${fcfaTg(d.amount)} — ${d.status}`),
                ].join("\n")
              : "Aucun dépôt.",
            "/portefeuille",
          );
          return Response.json({ ok: true });
        }

        if (cmd === "/classement") {
          const { data } = await supabaseAdmin
            .from("profiles")
            .select("username, level, badge")
            .order("created_at", { ascending: false })
            .limit(10);
          const rows = (data ?? []) as { username: string; level: string; badge: string | null }[];
          await tgSend(
            cid,
            rows.length
              ? [
                  "<b>Classement général</b>",
                  ...rows.map((r, i) => `${i + 1}. ${r.username} (${r.level}${r.badge ? ` - ${r.badge}` : ''})`),
                ].join("\n")
              : "Aucun joueur.",
            "/classement",
          );
          return Response.json({ ok: true });
        }

        if (cmd === "/stats") {
          const { data: duels } = await supabaseAdmin
            .from("duels")
            .select("id, winner_id, player1_id, player2_id")
            .or(`player1_id.eq.${me.id},player2_id.eq.${me.id}`);
          const duelRows = (duels ?? []) as { winner_id: string | null; player1_id: string; player2_id: string }[];
          
          const wins = duelRows.filter(d => d.winner_id === me.id).length;
          const total = duelRows.length;
          const winRate = total > 0 ? Math.round((wins / total) * 100) : 0;

          await tgSend(
            cid,
            [
              `<b>Statistiques de ${me.username}</b>`,
              `Duels joués : ${total}`,
              `Victoires : ${wins}`,
              `Taux de victoire : ${winRate}%`,
            ].join("\n"),
            "/tableau-de-bord",
          );
          return Response.json({ ok: true });
        }

        await tgSend(cid, AIDE);
        return Response.json({ ok: true });
      },
    },
  },
});