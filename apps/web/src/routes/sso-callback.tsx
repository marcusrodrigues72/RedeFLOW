import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Box, CircularProgress, Typography, Alert, Button } from "@mui/material";
import { useEffect, useState } from "react";
import { useAuthStore } from "@/stores/auth.store";
import type { UsuarioPublico } from "shared";

export const Route = createFileRoute("/sso-callback")({
  component: SSOCallbackPage,
});

function SSOCallbackPage() {
  const navigate   = useNavigate();
  const login      = useAuthStore((s) => s.login);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    const params       = new URLSearchParams(window.location.search);
    const error        = params.get("error");
    const accessToken  = params.get("access_token");
    const refreshToken = params.get("refresh_token");
    const userB64      = params.get("user");

    if (error) {
      setErro(error);
      return;
    }

    if (!accessToken || !refreshToken || !userB64) {
      setErro("Resposta inválida do servidor de autenticação.");
      return;
    }

    try {
      const user = JSON.parse(atob(userB64)) as UsuarioPublico;
      login(user, accessToken, refreshToken);
      // Limpa tokens da URL antes de navegar
      window.history.replaceState({}, "", "/sso-callback");
      navigate({ to: "/" });
    } catch {
      setErro("Erro ao processar dados da sessão. Tente novamente.");
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (erro) {
    return (
      <Box sx={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", p: 3 }}>
        <Box sx={{ maxWidth: 420, textAlign: "center" }}>
          <Alert severity="error" sx={{ mb: 2, textAlign: "left" }}>{erro}</Alert>
          <Button variant="contained" onClick={() => navigate({ to: "/login" })}>
            Voltar ao login
          </Button>
        </Box>
      </Box>
    );
  }

  return (
    <Box sx={{ minHeight: "100vh", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 2 }}>
      <CircularProgress size={36} />
      <Typography variant="body2" color="text.secondary">Autenticando com Microsoft…</Typography>
    </Box>
  );
}
