import { useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import {
  Box, Card, CardContent, TextField, Button, Typography,
  Alert, CircularProgress, InputAdornment, IconButton,
} from "@mui/material";
import LockResetOutlinedIcon  from "@mui/icons-material/LockResetOutlined";
import CheckCircleOutlineIcon from "@mui/icons-material/CheckCircleOutline";
import VisibilityIcon         from "@mui/icons-material/Visibility";
import VisibilityOffIcon      from "@mui/icons-material/VisibilityOff";
import ArrowBackIcon          from "@mui/icons-material/ArrowBack";
import { api } from "@/lib/api";

export const Route = createFileRoute("/redefinir-senha")({
  validateSearch: (s: Record<string, unknown>) => ({ token: String(s["token"] ?? "") }),
  component: RedefinirSenhaPage,
});

function RedefinirSenhaPage() {
  const { token }  = Route.useSearch();
  const navigate   = useNavigate();

  const [senha,        setSenha]        = useState("");
  const [confirma,     setConfirma]     = useState("");
  const [showSenha,    setShowSenha]    = useState(false);
  const [showConfirma, setShowConfirma] = useState(false);
  const [erros,        setErros]        = useState<{ senha?: string; confirma?: string }>({});
  const [error,        setError]        = useState("");
  const [loading,      setLoading]      = useState(false);
  const [sucesso,      setSucesso]      = useState(false);

  const validate = () => {
    const e: typeof erros = {};
    if (senha.length < 8) e.senha = "A senha deve ter ao menos 8 caracteres.";
    if (confirma !== senha) e.confirma = "As senhas não coincidem.";
    setErros(e);
    return Object.keys(e).length === 0;
  };

  const handleSubmit = async (ev: React.FormEvent) => {
    ev.preventDefault();
    setError("");
    if (!validate()) return;
    setLoading(true);
    try {
      await api.post("/auth/redefinir-senha", { token, senha });
      setSucesso(true);
    } catch (err: any) {
      const msg = err?.response?.data?.message;
      setError(msg ?? "Erro ao redefinir a senha. Tente novamente.");
    } finally {
      setLoading(false);
    }
  };

  // Token ausente na URL
  if (!token) {
    return (
      <Box sx={{ minHeight: "100vh", bgcolor: "background.default", display: "flex", alignItems: "center", justifyContent: "center", p: 2 }}>
        <Card sx={{ width: "100%", maxWidth: 400 }}>
          <CardContent sx={{ p: 4, textAlign: "center" }}>
            <Alert severity="error" sx={{ mb: 3 }}>Link de recuperação inválido.</Alert>
            <Button component={Link} to="/esqueci-senha" variant="contained" sx={{ fontWeight: 700 }}>
              Solicitar novo link
            </Button>
          </CardContent>
        </Card>
      </Box>
    );
  }

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
      <Card sx={{ width: "100%", maxWidth: 400 }}>
        <CardContent sx={{ p: 4 }}>
          {/* Header */}
          <Box sx={{ display: "flex", alignItems: "center", gap: 1.5, mb: 3 }}>
            <Box sx={{
              width: 40, height: 40, borderRadius: 2,
              bgcolor: sucesso ? "#10b981" : "primary.main",
              display: "flex", alignItems: "center", justifyContent: "center",
              transition: "background 0.3s",
            }}>
              {sucesso
                ? <CheckCircleOutlineIcon sx={{ color: "white", fontSize: 20 }} />
                : <LockResetOutlinedIcon  sx={{ color: "white", fontSize: 20 }} />
              }
            </Box>
            <Box>
              <Typography variant="h5">Nova senha</Typography>
              <Typography variant="caption" color="text.secondary">REDEFLOW · iRede EAD</Typography>
            </Box>
          </Box>

          {sucesso ? (
            /* Sucesso */
            <Box>
              <Alert severity="success" sx={{ mb: 2.5, borderRadius: 2 }}>
                Senha redefinida com sucesso!
              </Alert>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
                Sua senha foi alterada. Você já pode fazer login com a nova senha.
              </Typography>
              <Button
                variant="contained" fullWidth
                onClick={() => navigate({ to: "/login" })}
                sx={{ fontWeight: 700, py: 1.25 }}
              >
                Ir para o login
              </Button>
            </Box>
          ) : (
            /* Formulário */
            <Box component="form" onSubmit={handleSubmit} noValidate>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 2.5 }}>
                Crie uma nova senha para sua conta. Use ao menos 8 caracteres.
              </Typography>

              {error && (
                <Alert severity="error" sx={{ mb: 2, borderRadius: 2 }}>
                  {error}{" "}
                  {error.includes("inválido") && (
                    <Link to="/esqueci-senha" style={{ color: "inherit", fontWeight: 700 }}>
                      Solicitar novo link
                    </Link>
                  )}
                </Alert>
              )}

              <TextField
                fullWidth label="Nova senha" autoFocus sx={{ mb: 2 }}
                type={showSenha ? "text" : "password"}
                value={senha}
                onChange={(e) => setSenha(e.target.value)}
                error={!!erros.senha}
                helperText={erros.senha}
                slotProps={{
                  input: {
                    endAdornment: (
                      <InputAdornment position="end">
                        <IconButton size="small" onClick={() => setShowSenha((v) => !v)} edge="end">
                          {showSenha ? <VisibilityOffIcon /> : <VisibilityIcon />}
                        </IconButton>
                      </InputAdornment>
                    ),
                  },
                }}
              />

              <TextField
                fullWidth label="Confirmar nova senha" sx={{ mb: 3 }}
                type={showConfirma ? "text" : "password"}
                value={confirma}
                onChange={(e) => setConfirma(e.target.value)}
                error={!!erros.confirma}
                helperText={erros.confirma}
                slotProps={{
                  input: {
                    endAdornment: (
                      <InputAdornment position="end">
                        <IconButton size="small" onClick={() => setShowConfirma((v) => !v)} edge="end">
                          {showConfirma ? <VisibilityOffIcon /> : <VisibilityIcon />}
                        </IconButton>
                      </InputAdornment>
                    ),
                  },
                }}
              />

              <Button
                type="submit" variant="contained" fullWidth
                disabled={loading}
                sx={{ fontWeight: 700, py: 1.25, mb: 2 }}
                startIcon={loading ? <CircularProgress size={16} color="inherit" /> : undefined}
              >
                {loading ? "Salvando…" : "Salvar nova senha"}
              </Button>
            </Box>
          )}

          {!sucesso && (
            <Box sx={{ textAlign: "center" }}>
              <Button
                component={Link} to="/login"
                size="small" startIcon={<ArrowBackIcon sx={{ fontSize: 14 }} />}
                sx={{ color: "text.secondary", fontSize: "0.8rem" }}
              >
                Voltar ao login
              </Button>
            </Box>
          )}
        </CardContent>
      </Card>
    </Box>
  );
}
