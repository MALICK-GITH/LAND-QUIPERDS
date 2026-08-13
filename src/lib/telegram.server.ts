import { createHash, timingSafeEqual } from "node:crypto";

let webhookBootstrapPromise: Promise<void> | null = null;

function appBaseUrl(): string {
  return (
    process.env["APP_BASE_URL"] ??
    process.env["RENDER_EXTERNAL_URL"] ??
    (process.env["VERCEL_URL"] ? `https://${process.env["VERCEL_URL"]}` : "")
  ).replace(/\/+$/, "");
}

async function bootstrapTelegramWebhook(): Promise<void> {
  const token = process.env["TELEGRAM_BOT_TOKEN"];
  if (!token) throw new Error("TELEGRAM_BOT_TOKEN manquant");

  const base = appBaseUrl();
  if (!base) {
    console.warn("[Telegram] APP_BASE_URL manquant: webhook non configuré automatiquement.");
    return;
  }

  const url = `${base}/api/public/telegram/webhook`;
  const secret = telegramWebhookSecret();

  const res = await fetch(`https://api.telegram.org/bot${token}/setWebhook`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      url,
      secret_token: secret,
      drop_pending_updates: false,
      allowed_updates: ["message"],
    }),
  });

  const json = (await res.json()) as { ok: boolean; description?: string };
  if (!res.ok || !json.ok) {
    throw new Error(`Telegram setWebhook a échoué: ${json.description ?? "erreur inconnue"}`);
  }
}

export function ensureTelegramWebhook(): Promise<void> {
  if (!webhookBootstrapPromise) {
    webhookBootstrapPromise = bootstrapTelegramWebhook().catch((error) => {
      webhookBootstrapPromise = null;
      throw error;
    });
  }
  return webhookBootstrapPromise;
}

/** Appelle l'API Telegram Bot avec le token stocké côté serveur. */
export async function tgCall<T = unknown>(
  method: string,
  body: Record<string, unknown>,
): Promise<T | null> {
  const token = process.env["TELEGRAM_BOT_TOKEN"];
  if (!token) throw new Error("TELEGRAM_BOT_TOKEN manquant");
  await ensureTelegramWebhook();
  const res = await fetch(`https://api.telegram.org/bot${token}/${method}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const json = (await res.json()) as { ok: boolean; result?: T; description?: string };
  if (!res.ok || !json.ok) {
    console.error(`Telegram ${method} a échoué [${res.status}]: ${json.description ?? ""}`);
    return null;
  }
  return json.result ?? null;
}

export async function tgSend(chatId: number | string, text: string, link?: string | null) {
  const base = appBaseUrl();
  const markup =
    link && base
      ? { inline_keyboard: [[{ text: "Ouvrir SKILL2CASH", url: `${base}${link}` }]] }
      : undefined;
  return tgCall("sendMessage", {
    chat_id: chatId,
    text,
    parse_mode: "HTML",
    disable_web_page_preview: true,
    ...(markup ? { reply_markup: markup } : {}),
  });
}

/** Secret d'en-tête du webhook, dérivé du token du bot. */
export function telegramWebhookSecret(): string {
  const token = process.env["TELEGRAM_BOT_TOKEN"] ?? "";
  return createHash("sha256").update(`telegram-webhook:${token}`).digest("base64url");
}

export function safeEqual(a: string, b: string): boolean {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  return left.length === right.length && timingSafeEqual(left, right);
}

export function fcfaTg(n: number | null | undefined): string {
  return `${new Intl.NumberFormat("fr-FR").format(Math.round(Number(n ?? 0)))} FCFA`;
}
