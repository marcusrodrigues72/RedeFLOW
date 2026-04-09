// Layout route sem segmento de URL — protege todas as rotas filhas
// Qualquer rota dentro de _authed/ exige autenticação.
import { createFileRoute, redirect, Outlet } from "@tanstack/react-router";
import { useEffect } from "react";
import { useAuthStore } from "@/stores/auth.store";
import AppLayout from "@/components/layout/AppLayout";
import { api } from "@/lib/api";
import type { UsuarioPublico } from "shared";

export const Route = createFileRoute("/_authed")({
  beforeLoad: () => {
    const { isAuthenticated } = useAuthStore.getState();
    if (!isAuthenticated) {
      throw redirect({ to: "/login" });
    }
  },
  component: AuthedLayout,
});

function AuthedLayout() {
  const setUser = useAuthStore((s) => s.setUser);

  // Atualiza o perfil do usuário a partir do banco ao entrar no sistema.
  // Garante que alterações de papel (ex: COLABORADOR → ADMIN) reflitam sem necessidade de novo login.
  useEffect(() => {
    api.get<UsuarioPublico>("/auth/me").then((r) => setUser(r.data)).catch(() => {});
  }, [setUser]);

  return (
    <AppLayout>
      <Outlet />
    </AppLayout>
  );
}
