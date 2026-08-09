// @ts-nocheck - Server-side only file using Node.js crypto module
import { createHash, timingSafeEqual } from "node:crypto";

/** Appelle l'API Telegram Bot avec le token stocké côté serveur. */
export async function tgCall<T = unknown>(
  method: string,
  body: Record<string, unknown>,
): Promise<T | null> {
  const token = process.env["TELEGRAM_BOT_TOKEN"];
  if (!token) throw new Error("TELEGRAM_BOT_TOKEN manquant");
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
  const base = process.env["APP_BASE_URL"] ?? "";
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