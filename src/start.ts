import { createStart, createCsrfMiddleware, createMiddleware } from "@tanstack/react-start";

import { renderErrorPage } from "./lib/error-page";
import { attachSupabaseAuth } from "@/integrations/supabase/auth-attacher";

const errorMiddleware = createMiddleware().server(async ({ next }) => {
  try {
    return await next();
  } catch (error) {
    if (error != null && typeof error === "object" && "statusCode" in error) {
      throw error;
    }
    console.error(error);
    return new Response(renderErrorPage(), {
      status: 500,
      headers: { "content-type": "text/html; charset=utf-8" },
    });
  }
});

// Protection CSRF des server functions (appels cross-site).
// Portabilité auto-hébergement : mettre DISABLE_CSRF=true dans l'environnement
// pour la désactiver complètement (ex. front et API sur deux domaines distincts).
const csrfDisabled = String(process.env["DISABLE_CSRF"] ?? "").toLowerCase() === "true";

const csrfMiddleware = createCsrfMiddleware({
  filter: (ctx) => ctx.handlerType === "serverFn",
});

export const startInstance = createStart(() => ({
  functionMiddleware: [attachSupabaseAuth],
  requestMiddleware: csrfDisabled
    ? [errorMiddleware]
    : [errorMiddleware, csrfMiddleware],
}));
