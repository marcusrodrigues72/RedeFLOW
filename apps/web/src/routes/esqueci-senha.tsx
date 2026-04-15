import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import {
  Box, Card, CardContent, TextField, Button, Typography,
  Alert, CircularProgress,
} from "@mui/material";
import LockResetOutlinedIcon from "@mui/icons-material/LockResetOutlined";
import ArrowBackIcon          from "@mui/icons-material/ArrowBack";
import CheckCircleOutlineIcon from "@mui/icons-material/CheckCircleOutline";
import { api } from "@/lib/api";

export const Route = createFileRoute("/esqueci-senha")({
  component: EsqueciSenhaPage,
});

function EsqueciSenhaPage() {
  const [email,     setEmail]     = useState("");
  const [emailErr,  setEmailErr]  = useState("");
  const [loading,   setLoading]   = useState(false);
  const [error,     setError]     = useState("");
  const [enviado,   setEnviado]   = useState(false);

  const validate = () => {
    if (!email) { setEmailErr("E-mail obrigatório."); return false; }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { setEmailErr("E-mail inválido."); return false; }
    setEmailErr("");
    return true;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (!validate()) return;
    setLoading(true);
    try {
      await api.post("/auth/esqueci-senha", { email });
      setEnviado(true);
    } catch {
      setError("Erro ao conectar ao servidor. Tente novamente.");
    } finally {
      setLoading(false);
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
      <Card sx={{ width: "100%", maxWidth: 400 }}>
        <CardContent sx={{ p: 4 }}>
          {/* Header */}
          <Box sx={{ display: "flex", alignItems: "center", gap: 1.5, mb: 3 }}>
            <Box sx={{
              width: 40, height: 40, borderRadius: 2,
              bgcolor: enviado ? "#10b981" : "primary.main",
              display: "flex", alignItems: "center", justifyContent: "center",
              transition: "background 0.3s",
            }}>
              {enviado
                ? <CheckCircleOutlineIcon sx={{ color: "white", fontSize: 20 }} />
                : <LockResetOutlinedIcon  sx={{ color: "white", fontSize: 20 }} />
              }
            </Box>
            <Box>
              <Typography variant="h5">Recuperar senha</Typography>
              <Typography variant="caption" color="text.secondary">REDEFLOW · iRede EAD</Typography>
            </Box>
          </Box>

          {enviado ? (
            /* Estado: e-mail enviado */
            <Box>
              <Alert severity="success" sx={{ mb: 2, borderRadius: 2 }}>
                Instruções enviadas! Verifique sua caixa de entrada.
              </Alert>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
                Se o endereço <strong>{email}</strong> estiver cadastrado no sistema,
                você receberá um e-mail com o link para criar uma nova senha.
                O link é válido por <strong>1 hora</strong>.
              </Typography>
              <Typography variant="body2" color="text.disabled" sx={{ mb: 3, fontSize: "0.8rem" }}>
                Não recebeu? Verifique a pasta de spam ou solicite novamente.
              </Typography>
              <Button
                fullWidth variant="outlined"
                onClick={() => { setEnviado(false); setEmail(""); }}
                sx={{ mb: 1.5, fontWeight: 600 }}
              >
                Enviar novamente
              </Button>
            </Box>
          ) : (
            /* Formulário */
            <Box component="form" onSubmit={handleSubmit} noValidate>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 2.5 }}>
                Informe o e-mail cadastrado na sua conta. Enviaremos um link para criar uma nova senha.
              </Typography>

              {error && (
                <Alert severity="error" sx={{ mb: 2, borderRadius: 2 }}>{error}</Alert>
              )}

              <TextField
                fullWidth label="E-mail" type="email" autoComplete="email" autoFocus
                sx={{ mb: 3 }}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                error={!!emailErr}
                helperText={emailErr}
              />

              <Button
                type="submit" variant="contained" fullWidth
                disabled={loading}
                sx={{ fontWeight: 700, py: 1.25, mb: 2 }}
                startIcon={loading ? <CircularProgress size={16} color="inherit" /> : undefined}
              >
                {loading ? "Enviando…" : "Enviar link de recuperação"}
              </Button>
            </Box>
          )}

          <Box sx={{ textAlign: "center" }}>
            <Button
              component={Link} to="/login"
              size="small" startIcon={<ArrowBackIcon sx={{ fontSize: 14 }} />}
              sx={{ color: "text.secondary", fontSize: "0.8rem" }}
            >
              Voltar ao login
            </Button>
          </Box>
        </CardContent>
      </Card>
    </Box>
  );
}
