// Layout route sem segmento de URL — protege todas as rotas filhas
// Qualquer rota dentro de _authed/ exige autenticação.
import { createFileRoute, redirect, Outlet } from "@tanstack/react-router";
import { useAuthStore } from "@/stores/auth.store";
import AppLayout from "@/components/layout/AppLayout";

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
  return (
    <AppLayout>
      <Outlet />
    </AppLayout>
  );
}
