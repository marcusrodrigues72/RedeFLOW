import { createFileRoute, Link } from "@tanstack/react-router";
import {
  Box, Typography, Chip, Button, Card, CardContent,
  Stepper, Step, StepLabel, StepContent, Alert, Skeleton,
  Select, MenuItem, FormControl, InputLabel, Divider,
  TextField, Avatar, IconButton, Tooltip, Snackbar,
} from "@mui/material";
import ArrowBackIcon            from "@mui/icons-material/ArrowBack";
import CheckCircleIcon          from "@mui/icons-material/CheckCircle";
import RadioButtonUncheckedIcon from "@mui/icons-material/RadioButtonUnchecked";
import BlockIcon                from "@mui/icons-material/Block";
import SendIcon                 from "@mui/icons-material/Send";
import DeleteOutlineIcon        from "@mui/icons-material/DeleteOutline";
import EditCalendarIcon         from "@mui/icons-material/EditCalendar";
import CheckIcon                from "@mui/icons-material/Check";
import CloseIcon                from "@mui/icons-material/Close";
import { useState }             from "react";
import { useOA, useAtualizarEtapa, useComentariosOA, useAdicionarComentario, useExcluirComentario } from "@/lib/api/cursos";
import { useAuthStore }         from "@/stores/auth.store";
import type { StatusEtapa, TipoOA, StatusOA } from "shared";

export const Route = createFileRoute("/_authed/oas/$oaId")({
  component: OADetalhePage,
});

const STATUS_OA_CONFIG: Record<StatusOA, { label: string; color: string; bg: string }> = {
  PENDENTE:     { label: "Pendente",     color: "#64748b", bg: "#f8fafc" },
  EM_ANDAMENTO: { label: "Em Andamento", color: "#f59e0b", bg: "#fffbeb" },
  BLOQUEADO:    { label: "Bloqueado",    color: "#ef4444", bg: "#fff5f5" },
  CONCLUIDO:    { label: "Concluído",    color: "#10b981", bg: "#f0fdf4" },
};

const TIPO_CONFIG: Record<TipoOA, { label: string; color: string }> = {
  VIDEO:      { label: "Vídeo",         color: "#2b7cee" },
  SLIDE:      { label: "Slide",         color: "#7c3aed" },
  QUIZ:       { label: "Quiz",          color: "#0891b2" },
  EBOOK:      { label: "E-book",        color: "#059669" },
  PLANO_AULA: { label: "Plano de Aula", color: "#d97706" },
  TAREFA:     { label: "Tarefa",        color: "#dc2626" },
};

const STATUS_ETAPA: Record<StatusEtapa, { label: string; icon: React.ReactNode }> = {
  PENDENTE:     { label: "Pendente",     icon: <RadioButtonUncheckedIcon sx={{ fontSize: 18, color: "#94a3b8" }} /> },
  EM_ANDAMENTO: { label: "Em Andamento", icon: <RadioButtonUncheckedIcon sx={{ fontSize: 18, color: "#f59e0b" }} /> },
  CONCLUIDA:    { label: "Concluída",    icon: <CheckCircleIcon sx={{ fontSize: 18, color: "#10b981" }} /> },
  BLOQUEADA:    { label: "Bloqueada",    icon: <BlockIcon sx={{ fontSize: 18, color: "#ef4444" }} /> },
};

function OADetalhePage() {
  const { oaId } = Route.useParams();
  const { data: oa, isLoading, isError } = useOA(oaId);
  const { mutate: atualizarEtapa, isPending } = useAtualizarEtapa(oaId);
  const user      = useAuthStore((s) => s.user);
  const [snackMsg, setSnackMsg] = useState<string | null>(null);

  if (isLoading) return <LoadingSkeleton />;
  if (isError || !oa) return <Alert severity="error">OA não encontrado.</Alert>;

  const sc    = STATUS_OA_CONFIG[oa.status];
  const tc    = TIPO_CONFIG[oa.tipo];
  const curso = oa.capitulo.unidade.curso;

  // Verifica se o usuário é ADMIN (global ou no curso)
  const isAdmin = user?.papelGlobal === "ADMIN"
    || curso.membros.some((m) => m.usuarioId === user?.id && m.papel === "ADMIN");

  // Índice da etapa ativa (primeira não concluída)
  const etapaAtivaIdx = oa.etapas.findIndex((e) => e.status !== "CONCLUIDA");

  return (
    <Box>
      {/* Header */}
      <Box sx={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", mb: 3 }}>
        <Box sx={{ display: "flex", alignItems: "center", gap: 2 }}>
          <Button component={Link} to={`/cursos/${curso.id}/oas`} startIcon={<ArrowBackIcon />} sx={{ color: "text.secondary" }}>
            {curso.nome}
          </Button>
          <Box>
            <Box sx={{ display: "flex", alignItems: "center", gap: 1.5, mb: 0.25 }}>
              <Typography sx={{ fontSize: "1.375rem", fontWeight: 800, fontFamily: "monospace" }}>{oa.codigo}</Typography>
              <Chip label={sc.label} size="small" sx={{ bgcolor: sc.bg, color: sc.color, fontWeight: 600 }} />
              <Chip label={tc.label} size="small" sx={{ bgcolor: `${tc.color}18`, color: tc.color, fontWeight: 600 }} />
            </Box>
            <Typography variant="caption" color="text.disabled">
              {oa.capitulo.unidade.nome} › {oa.capitulo.nome}
            </Typography>
          </Box>
        </Box>
      </Box>

      <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", md: "1fr 340px" }, gap: 3 }}>
        {/* Pipeline */}
        <Card>
          <CardContent sx={{ p: 3 }}>
            <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", mb: 3 }}>
              <Typography variant="h6" sx={{ fontWeight: 700 }}>Pipeline de Produção</Typography>
              {isAdmin && (
                <Chip icon={<EditCalendarIcon sx={{ fontSize: "0.9rem !important" }} />}
                  label="Modo Admin — deadlines editáveis" size="small"
                  sx={{ bgcolor: "#eff6ff", color: "primary.main", fontWeight: 600, fontSize: "0.7rem" }} />
              )}
            </Box>
            <Stepper activeStep={etapaAtivaIdx} orientation="vertical">
              {oa.etapas.map((etapa, idx) => {
                const cfg     = STATUS_ETAPA[etapa.status];
                const isAtiva = idx === etapaAtivaIdx;
                return (
                  <Step key={etapa.id} completed={etapa.status === "CONCLUIDA"}>
                    <StepLabel
                      icon={cfg.icon}
                      optional={
                        <DeadlineLabel
                          etapa={etapa}
                          isAdmin={isAdmin}
                          isPending={isPending}
                          onSave={(novaData) => {
                            const subsequentes = oa.etapas.filter((e) => e.ordem > etapa.ordem && e.deadlinePrevisto);
                            atualizarEtapa(
                              { etapaId: etapa.id, data: { deadlinePrevisto: novaData, recalcularSequencia: true } },
                              { onSuccess: () => setSnackMsg(subsequentes.length > 0 ? `${subsequentes.length} etapa(s) subsequente(s) ajustada(s) automaticamente.` : "Deadline atualizado.") }
                            );
                          }}
                        />
                      }
                    >
                      <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                        <Typography fontWeight={600} sx={{ fontSize: "0.875rem" }}>{etapa.etapaDef.nome}</Typography>
                        <Chip label={cfg.label} size="small"
                          sx={{ fontSize: "0.65rem", height: 18,
                            bgcolor: etapa.status === "CONCLUIDA" ? "#f0fdf4" : etapa.status === "EM_ANDAMENTO" ? "#fffbeb" : etapa.status === "BLOQUEADA" ? "#fff5f5" : "#f8fafc",
                            color:   etapa.status === "CONCLUIDA" ? "#10b981" : etapa.status === "EM_ANDAMENTO" ? "#f59e0b" : etapa.status === "BLOQUEADA" ? "#ef4444" : "#64748b",
                          }} />
                      </Box>
                    </StepLabel>
                    {isAtiva && (
                      <StepContent>
                        <Box sx={{ display: "flex", gap: 2, mt: 1, flexWrap: "wrap", alignItems: "center" }}>
                          <FormControl size="small" sx={{ minWidth: 160 }}>
                            <InputLabel>Status</InputLabel>
                            <Select
                              value={etapa.status}
                              label="Status"
                              onChange={(e) => atualizarEtapa({ etapaId: etapa.id, data: { status: e.target.value as StatusEtapa } })}
                              disabled={isPending}
                            >
                              <MenuItem value="PENDENTE">Pendente</MenuItem>
                              <MenuItem value="EM_ANDAMENTO">Em Andamento</MenuItem>
                              <MenuItem value="CONCLUIDA">Concluída</MenuItem>
                              <MenuItem value="BLOQUEADA">Bloqueada</MenuItem>
                            </Select>
                          </FormControl>
                          <FormControl size="small" sx={{ minWidth: 180 }}>
                            <InputLabel>Responsável</InputLabel>
                            <Select
                              value={etapa.responsavelId ?? ""}
                              label="Responsável"
                              onChange={(e) => atualizarEtapa({
                                etapaId: etapa.id,
                                data: { responsavelId: e.target.value || null },
                              })}
                              disabled={isPending}
                            >
                              <MenuItem value=""><em>Sem responsável</em></MenuItem>
                              {curso.membros.map((m) => (
                                <MenuItem key={m.usuarioId} value={m.usuarioId}>{m.usuario.nome}</MenuItem>
                              ))}
                            </Select>
                          </FormControl>
                          {etapa.status !== "CONCLUIDA" && (
                            <Button
                              variant="contained" size="small"
                              disabled={isPending}
                              onClick={() => atualizarEtapa({
                                etapaId: etapa.id,
                                data: { status: "CONCLUIDA", deadlineReal: new Date().toISOString() },
                              })}
                              sx={{ fontWeight: 700 }}
                            >
                              Marcar como Concluída
                            </Button>
                          )}
                        </Box>
                      </StepContent>
                    )}
                  </Step>
                );
              })}
            </Stepper>
          </CardContent>
        </Card>

        <Snackbar
          open={!!snackMsg} autoHideDuration={4000} onClose={() => setSnackMsg(null)}
          message={snackMsg}
          anchorOrigin={{ vertical: "bottom", horizontal: "center" }}
        />

        {/* Comentários */}
        <ComentariosCard oaId={oaId} />

        {/* Painel lateral */}
        <Box sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
          {/* Detalhes */}
          <Card>
            <CardContent sx={{ p: 3 }}>
              <Typography variant="h6" sx={{ mb: 2, fontWeight: 700 }}>Detalhes</Typography>
              {[
                { label: "Código",   value: oa.codigo },
                { label: "Tipo",     value: tc.label },
                { label: "Unidade",  value: oa.capitulo.unidade.nome },
                { label: "Capítulo", value: oa.capitulo.nome },
                { label: "Progresso",value: `${oa.progressoPct}%` },
                { label: "Deadline", value: oa.deadlineFinal ? new Date(oa.deadlineFinal).toLocaleDateString("pt-BR") : "—" },
              ].map(({ label, value }) => (
                <Box key={label}>
                  <Box sx={{ display: "flex", justifyContent: "space-between", py: 1 }}>
                    <Typography variant="body2" color="text.secondary">{label}</Typography>
                    <Typography variant="body2" fontWeight={600}>{value}</Typography>
                  </Box>
                  <Divider />
                </Box>
              ))}
            </CardContent>
          </Card>

          {/* Links */}
          {(oa.linkObjeto || oa.linkObjetoFinal) && (
            <Card>
              <CardContent sx={{ p: 3 }}>
                <Typography variant="h6" sx={{ mb: 2, fontWeight: 700 }}>Links</Typography>
                {oa.linkObjeto && (
                  <Button href={oa.linkObjeto} target="_blank" variant="outlined" fullWidth size="small" sx={{ mb: 1 }}>
                    Objeto em Produção
                  </Button>
                )}
                {oa.linkObjetoFinal && (
                  <Button href={oa.linkObjetoFinal} target="_blank" variant="contained" fullWidth size="small">
                    Objeto Final
                  </Button>
                )}
              </CardContent>
            </Card>
          )}
        </Box>
      </Box>
    </Box>
  );
}

// ─── Deadline Label (com edição inline para ADMIN) ────────────────────────────

function toInputDate(iso: string | null | undefined): string {
  if (!iso) return "";
  return new Date(iso).toISOString().slice(0, 10);
}

function DeadlineLabel({ etapa, isAdmin, isPending, onSave }: {
  etapa: { deadlinePrevisto: string | null; responsavel: { nome: string } | null };
  isAdmin: boolean; isPending: boolean;
  onSave: (isoDate: string) => void;
}) {
  const [editando, setEditando]   = useState(false);
  const [valor,    setValor]      = useState("");

  const hoje = new Date();
  hoje.setHours(0, 0, 0, 0);
  const atrasado = etapa.deadlinePrevisto
    ? new Date(etapa.deadlinePrevisto) < hoje
    : false;

  const handleAbrir = () => {
    setValor(toInputDate(etapa.deadlinePrevisto));
    setEditando(true);
  };
  const handleConfirmar = () => {
    if (!valor) return;
    onSave(new Date(valor + "T12:00:00").toISOString());
    setEditando(false);
  };

  if (editando) {
    return (
      <Box sx={{ display: "flex", alignItems: "center", gap: 0.5, mt: 0.25 }}>
        <TextField
          type="date" size="small" value={valor}
          onChange={(e) => setValor(e.target.value)}
          disabled={isPending}
          sx={{ width: 150, "& .MuiInputBase-input": { fontSize: "0.75rem", py: 0.5, px: 1 } }}
          InputLabelProps={{ shrink: true }}
        />
        <Tooltip title="Confirmar e recalcular etapas seguintes">
          <IconButton size="small" color="primary" onClick={handleConfirmar} disabled={!valor || isPending}>
            <CheckIcon sx={{ fontSize: 16 }} />
          </IconButton>
        </Tooltip>
        <Tooltip title="Cancelar">
          <IconButton size="small" onClick={() => setEditando(false)}>
            <CloseIcon sx={{ fontSize: 16 }} />
          </IconButton>
        </Tooltip>
      </Box>
    );
  }

  return (
    <Box sx={{ display: "flex", alignItems: "center", gap: 0.5 }}>
      <Typography variant="caption" color="text.disabled">
        {etapa.responsavel?.nome ?? "Sem responsável"}
        {etapa.deadlinePrevisto && (
          <Box component="span" sx={{ color: atrasado ? "#ef4444" : "text.disabled", fontWeight: atrasado ? 700 : 400 }}>
            {` · DL: ${new Date(etapa.deadlinePrevisto).toLocaleDateString("pt-BR")}`}
          </Box>
        )}
        {!etapa.deadlinePrevisto && " · Sem deadline"}
      </Typography>
      {isAdmin && (
        <Tooltip title="Editar deadline (recalcula etapas subsequentes)">
          <IconButton size="small" onClick={handleAbrir} sx={{ p: 0.25, color: "text.disabled", "&:hover": { color: "primary.main" } }}>
            <EditCalendarIcon sx={{ fontSize: 13 }} />
          </IconButton>
        </Tooltip>
      )}
    </Box>
  );
}

// ─── Comentários ──────────────────────────────────────────────────────────────

function ComentariosCard({ oaId }: { oaId: string }) {
  const meId                                           = useAuthStore((s) => s.user?.id);
  const { data: comentarios = [], isLoading }          = useComentariosOA(oaId);
  const { mutate: adicionar, isPending: adicionando }  = useAdicionarComentario(oaId);
  const { mutate: excluir }                            = useExcluirComentario(oaId);
  const [texto, setTexto]                              = useState("");

  const handleEnviar = () => {
    const t = texto.trim();
    if (!t) return;
    adicionar({ texto: t }, { onSuccess: () => setTexto("") });
  };

  return (
    <Card>
      <CardContent sx={{ p: 3 }}>
        <Typography variant="h6" sx={{ mb: 2.5, fontWeight: 700 }}>Comentários</Typography>

        {isLoading ? (
          <Skeleton height={60} sx={{ borderRadius: 2 }} />
        ) : comentarios.length === 0 ? (
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            Nenhum comentário ainda.
          </Typography>
        ) : (
          <Box sx={{ display: "flex", flexDirection: "column", gap: 2, mb: 2.5 }}>
            {comentarios.map((c) => (
              <Box key={c.id} sx={{ display: "flex", gap: 1.5, alignItems: "flex-start" }}>
                <Avatar sx={{ width: 28, height: 28, bgcolor: "primary.light", fontSize: "0.7rem", fontWeight: 700, flexShrink: 0 }}>
                  {c.autor.nome[0]?.toUpperCase()}
                </Avatar>
                <Box sx={{ flex: 1, bgcolor: "#f8fafc", borderRadius: 2, px: 1.5, py: 1 }}>
                  <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 0.25 }}>
                    <Typography variant="caption" fontWeight={700}>{c.autor.nome}</Typography>
                    <Typography variant="caption" color="text.disabled">
                      {new Date(c.createdAt).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}
                    </Typography>
                    {c.autor.id === meId && (
                      <Tooltip title="Excluir">
                        <IconButton size="small" sx={{ ml: "auto", color: "text.disabled" }} onClick={() => excluir(c.id)}>
                          <DeleteOutlineIcon sx={{ fontSize: 14 }} />
                        </IconButton>
                      </Tooltip>
                    )}
                  </Box>
                  <Typography variant="body2" sx={{ whiteSpace: "pre-wrap" }}>{c.texto}</Typography>
                </Box>
              </Box>
            ))}
          </Box>
        )}

        <Divider sx={{ mb: 2 }} />
        <Box sx={{ display: "flex", gap: 1, alignItems: "flex-end" }}>
          <TextField
            multiline maxRows={4} size="small" fullWidth
            placeholder="Escreva um comentário..."
            value={texto} onChange={(e) => setTexto(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleEnviar(); } }}
          />
          <IconButton
            color="primary" disabled={!texto.trim() || adicionando}
            onClick={handleEnviar} sx={{ mb: 0.25 }}
          >
            <SendIcon sx={{ fontSize: 20 }} />
          </IconButton>
        </Box>
      </CardContent>
    </Card>
  );
}

function LoadingSkeleton() {
  return (
    <Box>
      <Skeleton height={40} sx={{ mb: 1 }} />
      <Skeleton height={400} />
    </Box>
  );
}
