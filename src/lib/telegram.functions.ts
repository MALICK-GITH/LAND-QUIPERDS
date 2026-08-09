import { createServerFn } from "@tanstack/react-start";

import { getBotUsername } from "./telegram-bot.server";

/** Renvoie le pseudo public du robot Telegram (pour construire le lien d'ouverture). */
export const getTelegramBot = createServerFn({ method: "GET" }).handler(async () => {
  return getBotUsername();
});