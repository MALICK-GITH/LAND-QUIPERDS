import { createFileRoute, Outlet, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";

import { AppShell } from "@/components/skill2cash/app-shell";
import { useSession } from "@/hooks/use-s2c";

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  component: AuthenticatedLayout,
});

function AuthenticatedLayout() {
  const navigate = useNavigate();
  const { user, loading } = useSession();

  useEffect(() => {
    if (loading) return;
    if (!user) {
      void navigate({ to: "/auth", replace: true });
    }
  }, [loading, navigate, user]);

  if (loading) {
    return <div className="min-h-screen bg-background" />;
  }

  if (!user) {
    return <div className="min-h-screen bg-background" />;
  }

  return (
    <AppShell>
      <Outlet />
    </AppShell>
  );
}
