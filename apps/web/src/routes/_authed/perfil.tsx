import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import {
  Box, Typography, Paper, TextField, Button, Divider,
  Switch, FormControlLabel, Alert, CircularProgress, Avatar,
} from "@mui/material";
import PersonOutlineIcon   from "@mui/icons-material/PersonOutline";
import LockOutlinedIcon    from "@mui/icons-material/LockOutlined";
import EmailOutlinedIcon   from "@mui/icons-material/EmailOutlined";
import PlayArrowOutlinedIcon from "@mui/icons-material/PlayArrowOutlined";
import { useAuthStore }       from "@/stores/auth.store";
import { useAtualizarPerfil } from "@/lib/api/cursos";
import { api } from "@/lib/api";

export const Route = createFileRoute("/_authed/perfil")({
  component: PerfilPage,
});

export default function PerfilPage() {
  const user    = useAuthStore((s) => s.user);
  const isAdmin = user?.papelGlobal === "ADMIN";
  const { mutate, isPending } = useAtualizarPerfil();
  const [cronMsg,     setCronMsg]     = useState<string | null>(null);
  const [cronPending, setCronPending] = useState(false);

  // Dados pessoais
  const [nome,  setNome]  = useState(user?.nome  ?? "");
  const [email, setEmail] = useState(user?.email ?? "");

  // Notificações
  const [notifEmail, setNotifEmail] = useState(user?.notifEmailAtivo ?? true);

  // Senha
  const [senhaAtual,  setSenhaAtual]  = useState("");
  const [novaSenha,   setNovaSenha]   = useState("");
  const [confirma,    setConfirma]    = useState("");

  const [erroSenha,   setErroSenha]   = useState<string | null>(null);
  const [successMsg,  setSuccessMsg]  = useState<string | null>(null);
  const [errorMsg,    setErrorMsg]    = useState<string | null>(null);

  const handleSalvarDados = () => {
    setSuccessMsg(null);
    setErrorMsg(null);
    mutate(
      { nome: nome.trim() || undefined, email: email.trim() || undefined, notifEmailAtivo: notifEmail },
      {
        onSuccess: () => setSuccessMsg("Dados atualizados com sucesso."),
        onError: (err: unknown) => {
          const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
          setErrorMsg(msg ?? "Erro ao atualizar dados.");
        },
      }
    );
  };

  const handleSalvarSenha = () => {
    setErroSenha(null);
    setSuccessMsg(null);
    setErrorMsg(null);

    if (novaSenha.length < 6) {
      setErroSenha("A nova senha deve ter pelo menos 6 caracteres.");
      return;
    }
    if (novaSenha !== confirma) {
      setErroSenha("As senhas não coincidem.");
      return;
    }
    mutate(
      { senhaAtual, novaSenha },
      {
        onSuccess: () => {
          setSuccessMsg("Senha alterada com sucesso.");
          setSenhaAtual("");
          setNovaSenha("");
          setConfirma("");
        },
        onError: (err: unknown) => {
          const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
          setErroSenha(msg ?? "Erro ao alterar senha.");
        },
      }
    );
  };

  return (
    <Box sx={{ maxWidth: 640 }}>
      <Typography variant="h5" fontWeight={700} mb={0.5}>Meu Perfil</Typography>
      <Typography variant="body2" color="text.secondary" mb={3}>
        Gerencie suas informações pessoais e preferências.
      </Typography>

      {successMsg && <Alert severity="success" sx={{ mb: 2 }} onClose={() => setSuccessMsg(null)}>{successMsg}</Alert>}
      {errorMsg   && <Alert severity="error"   sx={{ mb: 2 }} onClose={() => setErrorMsg(null)}>{errorMsg}</Alert>}

      {/* Avatar + Papel */}
      <Paper variant="outlined" sx={{ p: 3, borderRadius: 3, mb: 3, display: "flex", alignItems: "center", gap: 2 }}>
        <Avatar
          src={user?.fotoUrl ?? undefined}
          sx={{ width: 56, height: 56, bgcolor: "primary.main", fontSize: "1.25rem", fontWeight: 700 }}
        >
          {user?.nome?.[0]?.toUpperCase()}
        </Avatar>
        <Box>
          <Typography fontWeight={700}>{user?.nome}</Typography>
          <Typography variant="caption" color="text.secondary">{user?.email}</Typography>
          <Box>
            <Typography variant="caption" sx={{ bgcolor: "#eff6ff", color: "primary.main", fontWeight: 600, px: 1, py: 0.25, borderRadius: 1, display: "inline-block", mt: 0.5 }}>
              {user?.papelGlobal === "ADMIN" ? "Admin" : user?.papelGlobal === "COLABORADOR" ? "Colaborador" : "Leitor"}
            </Typography>
          </Box>
        </Box>
      </Paper>

      {/* Dados pessoais */}
      <Paper variant="outlined" sx={{ p: 3, borderRadius: 3, mb: 3 }}>
        <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 2 }}>
          <PersonOutlineIcon sx={{ color: "text.secondary", fontSize: 20 }} />
          <Typography fontWeight={600}>Dados pessoais</Typography>
        </Box>
        <Box sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
          <TextField
            label="Nome"
            value={nome}
            onChange={(e) => setNome(e.target.value)}
            size="small"
            fullWidth
          />
          <TextField
            label="E-mail"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            size="small"
            fullWidth
            InputProps={{ startAdornment: <EmailOutlinedIcon sx={{ mr: 1, fontSize: 18, color: "text.disabled" }} /> }}
          />
        </Box>

        <>
          <Divider sx={{ my: 2.5 }} />
          <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 1.5 }}>
            <EmailOutlinedIcon sx={{ color: "text.secondary", fontSize: 20 }} />
            <Typography fontWeight={600}>Notificações por e-mail</Typography>
          </Box>
          <FormControlLabel
            control={
              <Switch
                checked={notifEmail}
                onChange={(e) => setNotifEmail(e.target.checked)}
                color="primary"
              />
            }
            label={
              <Typography variant="body2">
                {notifEmail ? "Receber alertas de prazo por e-mail" : "Notificações por e-mail desativadas"}
              </Typography>
            }
          />
        </>

        <Box sx={{ mt: 2.5, display: "flex", justifyContent: "flex-end" }}>
          <Button
            variant="contained"
            onClick={handleSalvarDados}
            disabled={isPending}
            startIcon={isPending ? <CircularProgress size={16} color="inherit" /> : undefined}
          >
            Salvar dados
          </Button>
        </Box>
      </Paper>

      {/* Ferramentas de Admin */}
      {isAdmin && (
        <Paper variant="outlined" sx={{ p: 3, borderRadius: 3, mb: 3, borderColor: "#fde68a" }}>
          <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 1.5 }}>
            <PlayArrowOutlinedIcon sx={{ color: "#d97706", fontSize: 20 }} />
            <Typography fontWeight={600} color="#92400e">Ferramentas de Admin</Typography>
          </Box>
          <Typography variant="body2" color="text.secondary" mb={2}>
            Dispara manualmente a verificação de deadlines — envia e-mails de prazo vencido e prazo próximo sem esperar o cron das 08:00. Útil para testar a integração com SendGrid.
          </Typography>
          {cronMsg && (
            <Alert
              severity={cronMsg.startsWith("Erro") ? "error" : "success"}
              sx={{ mb: 2 }}
              onClose={() => setCronMsg(null)}
            >
              {cronMsg}
            </Alert>
          )}
          <Button
            variant="outlined"
            color="warning"
            size="small"
            disabled={cronPending}
            startIcon={cronPending ? <CircularProgress size={14} color="inherit" /> : <PlayArrowOutlinedIcon />}
            onClick={async () => {
              setCronPending(true);
              setCronMsg(null);
              try {
                const r = await api.post<{ message: string }>("/admin/run-deadline-checks");
                setCronMsg(r.data.message);
              } catch {
                setCronMsg("Erro ao executar o job. Verifique os logs do servidor.");
              } finally {
                setCronPending(false);
              }
            }}
          >
            Executar verificação de deadlines agora
          </Button>
        </Paper>
      )}

      {/* Alterar senha */}
      <Paper variant="outlined" sx={{ p: 3, borderRadius: 3 }}>
        <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 2 }}>
          <LockOutlinedIcon sx={{ color: "text.secondary", fontSize: 20 }} />
          <Typography fontWeight={600}>Alterar senha</Typography>
        </Box>
        {erroSenha && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setErroSenha(null)}>{erroSenha}</Alert>}
        <Box sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
          <TextField
            label="Senha atual"
            type="password"
            value={senhaAtual}
            onChange={(e) => setSenhaAtual(e.target.value)}
            size="small"
            fullWidth
          />
          <TextField
            label="Nova senha"
            type="password"
            value={novaSenha}
            onChange={(e) => setNovaSenha(e.target.value)}
            size="small"
            fullWidth
            helperText="Mínimo de 6 caracteres"
          />
          <TextField
            label="Confirmar nova senha"
            type="password"
            value={confirma}
            onChange={(e) => setConfirma(e.target.value)}
            size="small"
            fullWidth
          />
        </Box>
        <Box sx={{ mt: 2.5, display: "flex", justifyContent: "flex-end" }}>
          <Button
            variant="outlined"
            onClick={handleSalvarSenha}
            disabled={isPending || !senhaAtual || !novaSenha || !confirma}
            startIcon={isPending ? <CircularProgress size={16} color="inherit" /> : undefined}
          >
            Alterar senha
          </Button>
        </Box>
      </Paper>
    </Box>
  );
}
