import { createFileRoute, redirect, useNavigate } from "@tanstack/react-router";
import {
  Box, Card, CardContent, TextField, Button, Typography,
  Alert, CircularProgress, InputAdornment, IconButton,
} from "@mui/material";
import VisibilityIcon from "@mui/icons-material/Visibility";
import VisibilityOffIcon from "@mui/icons-material/VisibilityOff";
import LockOutlinedIcon from "@mui/icons-material/LockOutlined";
import { useState } from "react";
import { useAuthStore } from "@/stores/auth.store";
import { api } from "@/lib/api";
import type { AuthResponse } from "shared";

export const Route = createFileRoute("/login")({
  beforeLoad: () => {
    if (useAuthStore.getState().isAuthenticated) {
      throw redirect({ to: "/" });
    }
  },
  component: LoginPage,
});

function LoginPage() {
  const navigate = useNavigate();
  const login = useAuthStore((s) => s.login);

  const [email, setEmail]             = useState("");
  const [senha, setSenha]             = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [emailError, setEmailError]   = useState("");
  const [senhaError, setSenhaError]   = useState("");
  const [serverError, setServerError] = useState("");
  const [isLoading, setIsLoading]     = useState(false);

  const validate = () => {
    let ok = true;
    if (!email) { setEmailError("E-mail obrigatório."); ok = false; }
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { setEmailError("E-mail inválido."); ok = false; }
    else setEmailError("");

    if (!senha || senha.length < 8) { setSenhaError("Senha deve ter ao menos 8 caracteres."); ok = false; }
    else setSenhaError("");
    return ok;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setServerError("");
    if (!validate()) return;

    setIsLoading(true);
    try {
      const { data } = await api.post<AuthResponse>("/auth/login", { email, senha });
      login(data.user, data.accessToken, data.refreshToken);
      await navigate({ to: "/" });
    } catch (err: unknown) {
      const msg = err instanceof Error
        ? (err as any)?.response?.data?.message
        : undefined;
      setServerError(msg ?? "Erro ao conectar ao servidor.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Box
      sx={{
        minHeight: "100vh",
        bgcolor: "background.default",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        p: 2,
      }}
    >
      {/* Painel editorial — visível em telas largas */}
      <Box sx={{ display: { xs: "none", md: "flex" }, flexDirection: "column", width: 400, pr: 8 }}>
        <Box
          component="img"
          src="/redeflow_logo.png"
          alt="RedeFLOW"
          sx={{ width: 220, height: "auto", mb: 2.5, borderRadius: 2 }}
        />
        <Typography variant="body1" color="text.secondary" sx={{ lineHeight: 1.8 }}>
          Gestão da produção de conteúdo educacional do iRede.
          Pipeline, Matrizes Instrucional e de Conteúdo em um só lugar.
        </Typography>
      </Box>

      {/* Card de login */}
      <Card sx={{ width: "100%", maxWidth: 400 }}>
        <CardContent sx={{ p: 4 }}>
          {/* Header */}
          <Box sx={{ display: "flex", alignItems: "center", gap: 1.5, mb: 3 }}>
            <Box sx={{ width: 40, height: 40, borderRadius: 2, bgcolor: "primary.main", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <LockOutlinedIcon sx={{ color: "white", fontSize: 20 }} />
            </Box>
            <Box>
              <Typography variant="h5">Entrar</Typography>
              <Typography variant="caption" color="text.secondary">REDEFLOW · IRED EAD</Typography>
            </Box>
          </Box>

          {serverError && (
            <Alert severity="error" sx={{ mb: 2, borderRadius: 2 }}>{serverError}</Alert>
          )}

          <Box component="form" onSubmit={handleSubmit} noValidate>
            <TextField
              fullWidth label="E-mail" type="email" autoComplete="email" autoFocus
              sx={{ mb: 2 }}
              value={email} onChange={(e) => setEmail(e.target.value)}
              error={!!emailError} helperText={emailError}
            />

            {/* MUI v6: slotProps.input em vez de InputProps */}
            <TextField
              fullWidth label="Senha" type={showPassword ? "text" : "password"}
              autoComplete="current-password" sx={{ mb: 3 }}
              value={senha} onChange={(e) => setSenha(e.target.value)}
              error={!!senhaError} helperText={senhaError}
              slotProps={{
                input: {
                  endAdornment: (
                    <InputAdornment position="end">
                      <IconButton
                        onClick={() => setShowPassword((v) => !v)}
                        edge="end" size="small"
                        aria-label={showPassword ? "Ocultar senha" : "Mostrar senha"}
                      >
                        {showPassword ? <VisibilityOffIcon /> : <VisibilityIcon />}
                      </IconButton>
                    </InputAdornment>
                  ),
                },
              }}
            />

            <Button
              type="submit" fullWidth variant="contained" size="large"
              disabled={isLoading} sx={{ height: 48 }}
            >
              {isLoading ? <CircularProgress size={22} sx={{ color: "white" }} /> : "Entrar"}
            </Button>
          </Box>
        </CardContent>
      </Card>
    </Box>
  );
}
