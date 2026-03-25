import { createFileRoute } from "@tanstack/react-router";
import {
  Box, Typography, Card, CardContent, Table, TableHead,
  TableRow, TableCell, TableBody, Chip, Button, Avatar,
  Dialog, DialogTitle, DialogContent, DialogActions,
  TextField, Select, MenuItem, FormControl, InputLabel,
  Skeleton, Alert, Switch, FormControlLabel, IconButton, Tooltip,
} from "@mui/material";
import AddIcon        from "@mui/icons-material/Add";
import EditIcon       from "@mui/icons-material/Edit";
import DeleteIcon     from "@mui/icons-material/DeleteOutline";
import BlockIcon      from "@mui/icons-material/Block";
import CheckIcon      from "@mui/icons-material/Check";
import { useState }   from "react";
import { useAuthStore } from "@/stores/auth.store";
import { useUsuarios, useCriarUsuario, useAtualizarUsuario, useExcluirUsuario } from "@/lib/api/usuarios";
import type { UsuarioAdmin } from "shared";

export const Route = createFileRoute("/_authed/admin/usuarios")({
  component: UsuariosPage,
});

const PAPEL_CONFIG = {
  ADMIN:       { label: "Admin",       color: "#2b7cee", bg: "#eff6ff" },
  COLABORADOR: { label: "Colaborador", color: "#7c3aed", bg: "#f5f3ff" },
  LEITOR:      { label: "Leitor",      color: "#64748b", bg: "#f8fafc" },
};

function UsuariosPage() {
  const { data: usuarios = [], isLoading, isError } = useUsuarios();
  const { mutate: excluir, isPending: excluindo }   = useExcluirUsuario();
  const meId = useAuthStore((s) => s.user?.id);

  const [dialogOpen, setDialogOpen]             = useState(false);
  const [editando, setEditando]                 = useState<UsuarioAdmin | null>(null);
  const [confirmExcluir, setConfirmExcluir]     = useState<UsuarioAdmin | null>(null);

  const handleNovo    = () => { setEditando(null); setDialogOpen(true); };
  const handleEditar  = (u: UsuarioAdmin) => { setEditando(u); setDialogOpen(true); };
  const handleExcluir = (u: UsuarioAdmin) => setConfirmExcluir(u);
  const confirmarExclusao = () => {
    if (!confirmExcluir) return;
    excluir(confirmExcluir.id, { onSuccess: () => setConfirmExcluir(null) });
  };

  return (
    <Box>
      <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", mb: 3 }}>
        <Box>
          <Typography sx={{ fontSize: "1.375rem", fontWeight: 800 }}>Usuários</Typography>
          <Typography variant="caption" color="text.disabled">
            {usuarios.length} usuário{usuarios.length !== 1 ? "s" : ""} cadastrado{usuarios.length !== 1 ? "s" : ""}
          </Typography>
        </Box>
        <Button variant="contained" startIcon={<AddIcon />} onClick={handleNovo} sx={{ fontWeight: 700 }}>
          Novo Usuário
        </Button>
      </Box>

      {isLoading ? (
        [1, 2, 3].map((i) => <Skeleton key={i} height={60} sx={{ mb: 1, borderRadius: 2 }} />)
      ) : isError ? (
        <Alert severity="error">Erro ao carregar usuários. Você precisa ter papel de Admin.</Alert>
      ) : (
        <Card>
          <CardContent sx={{ p: 0, pb: "0 !important" }}>
            <Table>
              <TableHead>
                <TableRow sx={{ bgcolor: "#f8fafc" }}>
                  {["Usuário", "E-mail", "Papel", "Status", "Desde", "Ações"].map((h) => (
                    <TableCell key={h} sx={{ fontWeight: 700, fontSize: "0.75rem", color: "text.secondary", py: 1.5 }}>{h}</TableCell>
                  ))}
                </TableRow>
              </TableHead>
              <TableBody>
                {usuarios.map((u) => {
                  const pc = PAPEL_CONFIG[u.papelGlobal] ?? PAPEL_CONFIG.COLABORADOR;
                  return (
                    <TableRow key={u.id} sx={{ "&:hover": { bgcolor: "action.hover" }, opacity: u.ativo ? 1 : 0.5 }}>
                      <TableCell sx={{ py: 1.5 }}>
                        <Box sx={{ display: "flex", alignItems: "center", gap: 1.5 }}>
                          <Avatar sx={{ width: 32, height: 32, bgcolor: "primary.light", fontSize: "0.8rem", fontWeight: 700 }}>
                            {u.nome[0]?.toUpperCase()}
                          </Avatar>
                          <Typography variant="body2" fontWeight={600}>{u.nome}</Typography>
                        </Box>
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2" color="text.secondary">{u.email}</Typography>
                      </TableCell>
                      <TableCell>
                        <Chip label={pc.label} size="small"
                          sx={{ bgcolor: pc.bg, color: pc.color, fontWeight: 600, fontSize: "0.7rem" }} />
                      </TableCell>
                      <TableCell>
                        <Chip
                          label={u.ativo ? "Ativo" : "Inativo"}
                          size="small"
                          icon={u.ativo ? <CheckIcon sx={{ fontSize: "14px !important" }} /> : <BlockIcon sx={{ fontSize: "14px !important" }} />}
                          sx={{
                            bgcolor: u.ativo ? "#f0fdf4" : "#f1f5f9",
                            color:   u.ativo ? "#10b981" : "#94a3b8",
                            fontWeight: 600, fontSize: "0.7rem",
                          }}
                        />
                      </TableCell>
                      <TableCell>
                        <Typography variant="caption" color="text.disabled">
                          {new Date(u.createdAt).toLocaleDateString("pt-BR")}
                        </Typography>
                      </TableCell>
                      <TableCell align="right">
                        <Tooltip title="Editar">
                          <IconButton size="small" onClick={() => handleEditar(u)}>
                            <EditIcon sx={{ fontSize: 16 }} />
                          </IconButton>
                        </Tooltip>
                        {u.id !== meId && (
                          <Tooltip title="Excluir">
                            <IconButton size="small" onClick={() => handleExcluir(u)} sx={{ color: "#ef4444" }}>
                              <DeleteIcon sx={{ fontSize: 16 }} />
                            </IconButton>
                          </Tooltip>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      <UsuarioDialog
        open={dialogOpen}
        usuario={editando}
        onClose={() => setDialogOpen(false)}
      />

      {/* Confirmar exclusão */}
      <Dialog open={Boolean(confirmExcluir)} onClose={() => setConfirmExcluir(null)} maxWidth="xs" fullWidth>
        <DialogTitle sx={{ fontWeight: 700 }}>Excluir usuário</DialogTitle>
        <DialogContent>
          <Typography variant="body2">
            Tem certeza que deseja excluir <strong>{confirmExcluir?.nome}</strong>?
            O usuário será desativado e suas atribuições de etapas serão removidas. Esta ação não pode ser desfeita.
          </Typography>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setConfirmExcluir(null)}>Cancelar</Button>
          <Button variant="contained" color="error" onClick={confirmarExclusao} disabled={excluindo} sx={{ fontWeight: 700 }}>
            {excluindo ? "Excluindo..." : "Excluir"}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}

// ─── Dialog ───────────────────────────────────────────────────────────────────

function UsuarioDialog({ open, usuario, onClose }: {
  open: boolean; usuario: UsuarioAdmin | null; onClose: () => void;
}) {
  const { mutate: criar,     isPending: criando }     = useCriarUsuario();
  const { mutate: atualizar, isPending: atualizando } = useAtualizarUsuario();

  const [nome,           setNome]           = useState("");
  const [email,          setEmail]          = useState("");
  const [senha,          setSenha]          = useState("");
  const [novaSenha,      setNovaSenha]      = useState("");
  const [confirmarSenha, setConfirmarSenha] = useState("");
  const [papel,          setPapel]          = useState("COLABORADOR");
  const [ativo,          setAtivo]          = useState(true);

  const isEdit = Boolean(usuario);
  const busy   = criando || atualizando;

  const senhasDivergem = isEdit && novaSenha !== "" && novaSenha !== confirmarSenha;
  const senhasCurtas   = isEdit && novaSenha !== "" && novaSenha.length < 6;

  // Preenche campos ao abrir edição
  const handleEnter = () => {
    if (usuario) {
      setNome(usuario.nome);
      setEmail(usuario.email);
      setSenha("");
      setNovaSenha("");
      setConfirmarSenha("");
      setPapel(usuario.papelGlobal);
      setAtivo(usuario.ativo);
    } else {
      setNome(""); setEmail(""); setSenha(""); setNovaSenha(""); setConfirmarSenha(""); setPapel("COLABORADOR"); setAtivo(true);
    }
  };

  const handleSalvar = () => {
    if (isEdit && usuario) {
      const data: { nome: string; email: string; papelGlobal: string; ativo: boolean; senha?: string } = { nome, email, papelGlobal: papel, ativo };
      if (novaSenha) data.senha = novaSenha;
      atualizar({ id: usuario.id, data }, { onSuccess: onClose });
    } else {
      criar({ nome, email, senha, papelGlobal: papel }, { onSuccess: onClose });
    }
  };

  const canSave = nome && email && (isEdit
    ? !senhasDivergem && !senhasCurtas
    : Boolean(senha)
  );

  return (
    <Dialog open={open} onClose={onClose} maxWidth="xs" fullWidth TransitionProps={{ onEnter: handleEnter }}>
      <DialogTitle sx={{ fontWeight: 700 }}>{isEdit ? "Editar Usuário" : "Novo Usuário"}</DialogTitle>
      <DialogContent sx={{ display: "flex", flexDirection: "column", gap: 2, pt: "16px !important" }}>
        <TextField
          label="Nome" value={nome} onChange={(e) => setNome(e.target.value)}
          size="small" fullWidth required
        />
        <TextField
          label="E-mail" type="email" value={email} onChange={(e) => setEmail(e.target.value)}
          size="small" fullWidth required
        />
        {!isEdit && (
          <TextField
            label="Senha" type="password" value={senha} onChange={(e) => setSenha(e.target.value)}
            size="small" fullWidth required helperText="Mínimo 6 caracteres"
          />
        )}
        {isEdit && (
          <>
            <TextField
              label="Nova Senha" type="password" value={novaSenha}
              onChange={(e) => setNovaSenha(e.target.value)}
              size="small" fullWidth
              helperText={senhasCurtas ? "Mínimo 6 caracteres" : "Deixe em branco para não alterar"}
              error={senhasCurtas}
            />
            <TextField
              label="Confirmar Nova Senha" type="password" value={confirmarSenha}
              onChange={(e) => setConfirmarSenha(e.target.value)}
              size="small" fullWidth
              error={senhasDivergem}
              helperText={senhasDivergem ? "As senhas não coincidem" : ""}
              disabled={!novaSenha}
            />
          </>
        )}
        <FormControl size="small" fullWidth>
          <InputLabel>Papel</InputLabel>
          <Select value={papel} label="Papel" onChange={(e) => setPapel(e.target.value)}>
            <MenuItem value="ADMIN">Admin</MenuItem>
            <MenuItem value="COLABORADOR">Colaborador</MenuItem>
            <MenuItem value="LEITOR">Leitor</MenuItem>
          </Select>
        </FormControl>
        {isEdit && (
          <FormControlLabel
            control={<Switch checked={ativo} onChange={(e) => setAtivo(e.target.checked)} />}
            label={ativo ? "Usuário ativo" : "Usuário inativo"}
          />
        )}
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button onClick={onClose} disabled={busy}>Cancelar</Button>
        <Button
          variant="contained" onClick={handleSalvar} disabled={busy || !canSave}
          sx={{ fontWeight: 700 }}
        >
          {busy ? "Salvando..." : isEdit ? "Salvar" : "Criar"}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
