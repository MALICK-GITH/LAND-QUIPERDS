import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/auth/callback")({
  component: AuthCallback,
});

function AuthCallback() {
  const navigate = useNavigate();

  useEffect(() => {
    const handleAuthCallback = async () => {
      const { data, error } = await supabase.auth.getSession();
      
      if (error) {
        console.error("Erreur callback OAuth:", error);
        navigate({ to: "/auth", replace: true });
        return;
      }

      if (data.session) {
        navigate({ to: "/tableau-de-bord", replace: true });
      } else {
        // Si pas de session, essayer de récupérer depuis l'URL
        const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(
          window.location.hash
        );
        
        if (exchangeError) {
          console.error("Erreur exchange code:", exchangeError);
          navigate({ to: "/auth", replace: true });
          return;
        }
        
        navigate({ to: "/tableau-de-bord", replace: true });
      }
    };

    handleAuthCallback();
  }, [navigate]);

  return (
    <div className="flex min-h-screen items-center justify-center">
      <div className="text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
        <p className="mt-4 text-muted-foreground">Chargement...</p>
      </div>
    </div>
  );
}
