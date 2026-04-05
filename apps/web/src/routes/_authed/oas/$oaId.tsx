import { createFileRoute, Link } from "@tanstack/react-router";
import {
  Box, Typography, Chip, Button, Card, CardContent,
  Stepper, Step, StepLabel, StepContent, Alert, Skeleton,
  Select, MenuItem, FormControl, InputLabel, Divider,
  TextField, Avatar, IconButton, Tooltip, Snackbar, Tabs, Tab,
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
import LinkIcon                 from "@mui/icons-material/Link";
import EditIcon                 from "@mui/icons-material/Edit";
import { useState, useRef, useCallback } from "react";
import Popover                 from "@mui/material/Popover";
import List                    from "@mui/material/List";
import ListItemButton          from "@mui/material/ListItemButton";
import ListItemText            from "@mui/material/ListItemText";
import { useOA, useAtualizarEtapa, useComentariosOA, useAdicionarComentario, useExcluirComentario, useAuditLogOA } from "@/lib/api/cursos";
import { useAuthStore }         from "@/stores/auth.store";
import type { StatusEtapa, TipoOA, StatusOA, AuditLogEntry } from "shared";

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
  VIDEO:       { label: "Vídeo",         color: "#2b7cee" },
  SLIDE:       { label: "Slide",         color: "#7c3aed" },
  QUIZ:        { label: "Quiz",          color: "#0891b2" },
  EBOOK:       { label: "E-book",        color: "#059669" },
  PLANO_AULA:  { label: "Plano de Aula", color: "#d97706" },
  TAREFA:      { label: "Tarefa",        color: "#dc2626" },
  INFOGRAFICO: { label: "Infográfico",   color: "#7e22ce" },
  TIMELINE:    { label: "Timeline",      color: "#0f766e" },
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
  const [abaEsquerda, setAbaEsquerda] = useState<"pipeline" | "historico">("pipeline");

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

  const setupEtapa   = oa.etapas.find((e) => e.etapaDef.papel === "COORDENADOR_PRODUCAO");
  const setupPendente = setupEtapa && setupEtapa.status !== "CONCLUIDA";

  return (
    <Box>
      {/* Banner de Setup pendente */}
      {setupPendente && isAdmin && (
        <Alert
          severity="warning"
          sx={{ mb: 2.5 }}
          action={
            <Button component={Link} to={`/cursos/${curso.id}/setup-producao`} size="small" color="inherit" sx={{ fontWeight: 700, whiteSpace: "nowrap" }}>
              Ir para Setup
            </Button>
          }
        >
          O Setup de Produção deste OA ainda não foi concluído. Configure templates, responsáveis e deadlines antes de iniciar a produção.
        </Alert>
      )}

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
        {/* Pipeline + Histórico */}
        <Card>
          <Box sx={{ borderBottom: 1, borderColor: "divider" }}>
            <Tabs value={abaEsquerda} onChange={(_, v) => setAbaEsquerda(v)} sx={{ px: 2 }}>
              <Tab label="Pipeline" value="pipeline" sx={{ fontWeight: 700, fontSize: "0.8rem" }} />
              <Tab label="Histórico" value="historico" sx={{ fontWeight: 700, fontSize: "0.8rem" }} />
            </Tabs>
          </Box>

          {abaEsquerda === "pipeline" && (
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
                const cfg              = STATUS_ETAPA[etapa.status];
                const isAtiva         = idx === etapaAtivaIdx;
                const isResponsavel   = user?.id === etapa.responsavelId || user?.id === etapa.responsavelSecundarioId;
                const podeEditar      = isAdmin || isResponsavel;
                // Bloqueia conclusão se a etapa exige artefato e ele ainda não foi adicionado
                const precisaArtefato = etapa.etapaDef.temArtefato || etapa.etapaDef.papel === "PROFESSOR_ATOR";
                const artefatoFaltando = precisaArtefato && !etapa.linkArtefato && !isAdmin;
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
                              disabled={isPending || !podeEditar}
                            >
                              <MenuItem value="PENDENTE">Pendente</MenuItem>
                              <MenuItem value="EM_ANDAMENTO">Em Andamento</MenuItem>
                              <MenuItem value="CONCLUIDA" disabled={artefatoFaltando}>Concluída</MenuItem>
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
                              disabled={isPending || !isAdmin}
                            >
                              <MenuItem value=""><em>Sem responsável</em></MenuItem>
                              {curso.membros.map((m) => (
                                <MenuItem key={m.usuarioId} value={m.usuarioId}>{m.usuario.nome}</MenuItem>
                              ))}
                            </Select>
                          </FormControl>
                          {/* Videomaker — apenas para etapa de Gravação (PROFESSOR_ATOR) */}
                          {etapa.etapaDef.papel === "PROFESSOR_ATOR" && (
                            <FormControl size="small" sx={{ minWidth: 180 }}>
                              <InputLabel>Videomaker</InputLabel>
                              <Select
                                value={etapa.responsavelSecundarioId ?? ""}
                                label="Videomaker"
                                onChange={(e) => atualizarEtapa({
                                  etapaId: etapa.id,
                                  data: { responsavelSecundarioId: e.target.value || null },
                                })}
                                disabled={isPending || !isAdmin}
                              >
                                <MenuItem value=""><em>Sem videomaker</em></MenuItem>
                                {curso.membros.map((m) => (
                                  <MenuItem key={m.usuarioId} value={m.usuarioId}>{m.usuario.nome}</MenuItem>
                                ))}
                              </Select>
                            </FormControl>
                          )}
                          {etapa.status !== "CONCLUIDA" && (
                            <Tooltip title={artefatoFaltando ? "Adicione o link do entregável antes de concluir esta etapa." : ""}>
                              <span>
                                <Button
                                  variant="contained" size="small"
                                  disabled={isPending || !podeEditar || artefatoFaltando}
                                  onClick={() => atualizarEtapa({
                                    etapaId: etapa.id,
                                    data: { status: "CONCLUIDA", deadlineReal: new Date().toISOString() },
                                  })}
                                  sx={{ fontWeight: 700 }}
                                >
                                  Marcar como Concluída
                                </Button>
                              </span>
                            </Tooltip>
                          )}
                        </Box>
                        {/* Template — link do objeto em produção (visível para etapas de produção) */}
                        {oa.linkObjeto && etapa.etapaDef.papel !== "COORDENADOR_PRODUCAO" && (
                          <Box sx={{ mt: 1.5, pt: 1.5, borderTop: "1px solid", borderColor: "divider" }}>
                            <Typography variant="caption" color="text.secondary" fontWeight={600} sx={{ display: "block", mb: 0.75 }}>
                              Template de produção
                            </Typography>
                            <Button
                              href={oa.linkObjeto} target="_blank" rel="noopener noreferrer"
                              startIcon={<LinkIcon sx={{ fontSize: 14 }} />}
                              size="small" variant="outlined"
                              sx={{ fontSize: "0.75rem", py: 0.25, textTransform: "none" }}
                            >
                              Abrir template
                            </Button>
                          </Box>
                        )}
                        {/* Link de artefato — etapas com entregável + Gravação (videomaker) */}
                        {(etapa.etapaDef.temArtefato || etapa.etapaDef.papel === "PROFESSOR_ATOR") && (
                          <ArtefatoInput
                            etapa={etapa}
                            isPending={isPending}
                            label={etapa.etapaDef.papel === "PROFESSOR_ATOR" ? "Vídeo Gravado" : undefined}
                            onSave={(link) => atualizarEtapa({ etapaId: etapa.id, data: { linkArtefato: link } })}
                          />
                        )}
                      </StepContent>
                    )}
                  </Step>
                );
              })}
            </Stepper>
          </CardContent>
          )}

          {abaEsquerda === "historico" && (
            <HistoricoTab oaId={oaId} />
          )}
        </Card>

        <Snackbar
          open={!!snackMsg} autoHideDuration={4000} onClose={() => setSnackMsg(null)}
          message={snackMsg}
          anchorOrigin={{ vertical: "bottom", horizontal: "center" }}
        />

        {/* Comentários */}
        <ComentariosCard oaId={oaId} membros={curso.membros} />

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

          {/* Links — roteiro + artefatos por etapa + objeto final */}
          {(oa.linkObjeto || oa.linkObjetoFinal || oa.etapas.some((e) => e.linkArtefato)) && (
            <Card>
              <CardContent sx={{ p: 3 }}>
                <Typography variant="h6" sx={{ mb: 2, fontWeight: 700 }}>Links</Typography>
                <Box sx={{ display: "flex", flexDirection: "column", gap: 1.5 }}>
                  {oa.linkObjeto && (
                    <LinkFase
                      label={oa.tipo === "VIDEO" ? "Roteiro de Produção" : "Template de Produção"}
                      href={oa.linkObjeto}
                    />
                  )}
                  {oa.etapas
                    .filter((e) => e.linkArtefato)
                    .map((e) => (
                      <LinkFase
                        key={e.id}
                        label={PAPEL_LINK_LABEL[e.etapaDef.papel] ?? e.etapaDef.nome}
                        href={e.linkArtefato!}
                      />
                    ))}
                  {oa.linkObjetoFinal && (
                    <LinkFase label="Objeto Final" href={oa.linkObjetoFinal} primary />
                  )}
                </Box>
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

type MembroSimples = { usuarioId: string; usuario: { id: string; nome: string } };

/** Highlights @mentions in comment text with a blue span */
function TextoComMencoes({ texto }: { texto: string }) {
  const parts = texto.split(/(@[\w\u00C0-\u017F]+(?:\s[\w\u00C0-\u017F]+)*)/g);
  return (
    <Typography variant="body2" sx={{ whiteSpace: "pre-wrap" }}>
      {parts.map((p, i) =>
        p.startsWith("@")
          ? <Box key={i} component="span" sx={{ color: "primary.main", fontWeight: 600 }}>{p}</Box>
          : p
      )}
    </Typography>
  );
}

function ComentariosCard({ oaId, membros }: { oaId: string; membros: MembroSimples[] }) {
  const meId                                           = useAuthStore((s) => s.user?.id);
  const { data: comentarios = [], isLoading }          = useComentariosOA(oaId);
  const { mutate: adicionar, isPending: adicionando }  = useAdicionarComentario(oaId);
  const { mutate: excluir }                            = useExcluirComentario(oaId);
  const [texto, setTexto]                              = useState("");

  // Mention popover state
  const inputRef                   = useRef<HTMLTextAreaElement>(null);
  const anchorRef                  = useRef<HTMLDivElement>(null);
  const [mentionQuery, setMentionQuery] = useState<string | null>(null);
  const [mentionStart, setMentionStart] = useState(0);

  const sugestoes = mentionQuery !== null
    ? membros
        .filter((m) => mentionQuery === "" || m.usuario.nome.toLowerCase().includes(mentionQuery.toLowerCase()))
        .slice(0, 6)
    : [];

  const handleTextoChange = useCallback((valor: string, cursor: number) => {
    setTexto(valor);
    // Find last @ before cursor position (read from event, not from ref)
    const before = valor.slice(0, cursor);
    const match  = before.match(/@([\w\u00C0-\u017F]*)$/);
    if (match) {
      setMentionQuery(match[1] ?? "");
      setMentionStart(cursor - (match[1]?.length ?? 0) - 1);
    } else {
      setMentionQuery(null);
    }
  }, []);

  const inserirMencao = (nome: string) => {
    const antes  = texto.slice(0, mentionStart);
    const depois = texto.slice(mentionStart + 1 + (mentionQuery?.length ?? 0));
    const novo   = `${antes}@${nome} ${depois}`;
    setTexto(novo);
    setMentionQuery(null);
    // restore focus
    setTimeout(() => {
      const el = inputRef.current;
      if (!el) return;
      const pos = antes.length + nome.length + 2; // @nome + space
      el.setSelectionRange(pos, pos);
      el.focus();
    }, 0);
  };

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
                  <TextoComMencoes texto={c.texto} />
                </Box>
              </Box>
            ))}
          </Box>
        )}

        <Divider sx={{ mb: 2 }} />
        <Box ref={anchorRef} sx={{ display: "flex", gap: 1, alignItems: "flex-end" }}>
          <TextField
            multiline maxRows={4} size="small" fullWidth
            placeholder="Escreva um comentário… use @ para mencionar alguém"
            value={texto}
            onChange={(e) => handleTextoChange(e.target.value, e.target.selectionStart ?? e.target.value.length)}
            onKeyDown={(e) => {
              if (e.key === "Escape") { setMentionQuery(null); return; }
              if (sugestoes.length > 0 && (e.key === "Enter" || e.key === "Tab")) {
                e.preventDefault();
                inserirMencao(sugestoes[0]!.usuario.nome);
                return;
              }
              if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleEnviar(); }
            }}
            slotProps={{ input: { inputRef } }}
          />
          <IconButton
            color="primary" disabled={!texto.trim() || adicionando}
            onClick={handleEnviar} sx={{ mb: 0.25 }}
          >
            <SendIcon sx={{ fontSize: 20 }} />
          </IconButton>
        </Box>

        {/* Mention autocomplete popover */}
        <Popover
          open={sugestoes.length > 0}
          anchorEl={anchorRef.current}
          onClose={() => setMentionQuery(null)}
          anchorOrigin={{ vertical: "top", horizontal: "left" }}
          transformOrigin={{ vertical: "bottom", horizontal: "left" }}
          disableAutoFocus
          disableEnforceFocus
          PaperProps={{ sx: { width: anchorRef.current?.offsetWidth ?? 300, maxHeight: 220, overflow: "auto", borderRadius: 2, boxShadow: "0 4px 20px rgba(0,0,0,0.12)" } }}
        >
          <List dense disablePadding>
            {sugestoes.map((m, i) => (
              <ListItemButton
                key={m.usuarioId}
                selected={i === 0}
                onClick={() => inserirMencao(m.usuario.nome)}
                sx={{ py: 0.75, px: 2 }}
              >
                <Avatar sx={{ width: 24, height: 24, bgcolor: "primary.light", fontSize: "0.65rem", mr: 1.5 }}>
                  {m.usuario.nome[0]?.toUpperCase()}
                </Avatar>
                <ListItemText primary={m.usuario.nome} primaryTypographyProps={{ variant: "body2", fontWeight: 600 }} />
              </ListItemButton>
            ))}
          </List>
        </Popover>
      </CardContent>
    </Card>
  );
}

// ─── Histórico de auditoria ───────────────────────────────────────────────────

const ACAO_LABEL: Record<string, string> = {
  "etapa.atualizada":           "Etapa atualizada",
  "etapa.status_atualizado":    "Status da etapa alterado",
  "etapa.responsavel_atualizado": "Responsável alterado",
  "etapa.deadline_atualizado":  "Deadline alterado",
  "oa.criado":                  "OA criado",
  "oa.status_atualizado":       "Status do OA alterado",
};

const CAMPO_LABEL: Record<string, string> = {
  status:                   "Status",
  responsavelId:            "Responsável",
  responsavelSecundarioId:  "Videomaker",
  deadlinePrevisto:         "Deadline previsto",
  etapa:                    "Etapa",
};

const STATUS_LABEL: Record<string, string> = {
  PENDENTE:     "Pendente",
  EM_ANDAMENTO: "Em Andamento",
  CONCLUIDA:    "Concluída",
  BLOQUEADA:    "Bloqueada",
};

function formatValor(campo: string, valor: unknown): string {
  if (valor === null || valor === undefined) return "—";
  if (campo === "deadlinePrevisto" && typeof valor === "string") {
    return new Date(valor).toLocaleDateString("pt-BR");
  }
  if (typeof valor === "string" && STATUS_LABEL[valor]) return STATUS_LABEL[valor];
  return String(valor);
}

function HistoricoTab({ oaId }: { oaId: string }) {
  const { data: logs = [], isLoading } = useAuditLogOA(oaId);

  if (isLoading) return (
    <Box sx={{ p: 3 }}>
      {[1,2,3].map((i) => <Skeleton key={i} height={60} sx={{ mb: 1, borderRadius: 2 }} />)}
    </Box>
  );

  if (logs.length === 0) return (
    <Box sx={{ p: 4, textAlign: "center" }}>
      <Typography variant="body2" color="text.secondary">Nenhum evento registrado ainda.</Typography>
    </Box>
  );

  return (
    <Box sx={{ p: 3, display: "flex", flexDirection: "column", gap: 0 }}>
      {logs.map((log, idx) => (
        <HistoricoItem key={log.id} log={log} isLast={idx === logs.length - 1} />
      ))}
    </Box>
  );
}

function HistoricoItem({ log, isLast }: { log: AuditLogEntry; isLast: boolean }) {
  const label = ACAO_LABEL[log.acao] ?? log.acao;

  // Campos alterados (excluindo o campo "etapa" que é só contexto)
  const campos = Object.keys(log.payloadDepois ?? {}).filter((k) => k !== "etapa");
  const etapaNome = (log.payloadDepois as any)?.etapa as string | undefined;

  return (
    <Box sx={{ display: "flex", gap: 1.5 }}>
      {/* Timeline line + dot */}
      <Box sx={{ display: "flex", flexDirection: "column", alignItems: "center", flexShrink: 0 }}>
        <Avatar sx={{ width: 28, height: 28, bgcolor: "primary.light", fontSize: "0.7rem", fontWeight: 700 }}>
          {log.usuario?.nome?.[0]?.toUpperCase() ?? "?"}
        </Avatar>
        {!isLast && <Box sx={{ width: 2, flex: 1, bgcolor: "#e2e8f0", mt: 0.5, mb: 0.5 }} />}
      </Box>

      {/* Content */}
      <Box sx={{ pb: 2.5, flex: 1, minWidth: 0 }}>
        <Box sx={{ display: "flex", alignItems: "baseline", gap: 1, flexWrap: "wrap" }}>
          <Typography variant="caption" fontWeight={700} sx={{ color: "text.primary" }}>
            {log.usuario?.nome ?? "Sistema"}
          </Typography>
          <Typography variant="caption" color="text.secondary">{label}</Typography>
          <Typography variant="caption" color="text.disabled" sx={{ ml: "auto", whiteSpace: "nowrap" }}>
            {new Date(log.createdAt).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}
          </Typography>
        </Box>
        {etapaNome && (
          <Typography variant="caption" color="text.disabled" sx={{ display: "block", mb: 0.5 }}>
            Etapa: {etapaNome}
          </Typography>
        )}
        {campos.map((campo) => {
          const antes  = (log.payloadAntes  as any)?.[campo];
          const depois = (log.payloadDepois as any)?.[campo];
          return (
            <Box key={campo} sx={{ display: "flex", alignItems: "center", gap: 0.75, mt: 0.5, flexWrap: "wrap" }}>
              <Typography variant="caption" sx={{ color: "#64748b", fontWeight: 600 }}>
                {CAMPO_LABEL[campo] ?? campo}:
              </Typography>
              <Typography variant="caption" sx={{ bgcolor: "#fee2e2", color: "#991b1b", px: 0.75, borderRadius: 1, textDecoration: "line-through" }}>
                {formatValor(campo, antes)}
              </Typography>
              <Typography variant="caption" color="text.disabled">→</Typography>
              <Typography variant="caption" sx={{ bgcolor: "#dcfce7", color: "#166534", px: 0.75, borderRadius: 1 }}>
                {formatValor(campo, depois)}
              </Typography>
            </Box>
          );
        })}
      </Box>
    </Box>
  );
}

// ─── Mapa de rótulos de link por papel ────────────────────────────────────────

const PAPEL_LINK_LABEL: Record<string, string> = {
  PROFESSOR_ATOR:        "Vídeo Gravado",
  EDITOR_VIDEO:          "Vídeo Final (Edição)",
  CONTEUDISTA:           "Conteúdo",
  DESIGNER_INSTRUCIONAL: "Versão Revisada DI",
  PRODUTOR_FINAL:        "Versão de Produção Final",
  VALIDADOR_FINAL:       "Versão Validada",
};

// ─── LinkFase — link rotulado por fase ────────────────────────────────────────

function LinkFase({ label, href, primary }: { label: string; href: string; primary?: boolean }) {
  return (
    <Box>
      <Typography
        variant="caption"
        sx={{ display: "block", mb: 0.5, fontWeight: 700, color: "text.disabled",
          textTransform: "uppercase", letterSpacing: "0.07em", fontSize: "0.62rem" }}
      >
        {label}
      </Typography>
      <Button
        href={href} target="_blank" rel="noopener noreferrer"
        variant={primary ? "contained" : "outlined"}
        fullWidth size="small"
        startIcon={<LinkIcon sx={{ fontSize: 13 }} />}
        sx={{ justifyContent: "flex-start", fontSize: "0.75rem", textTransform: "none",
          overflow: "hidden", "& .MuiButton-endIcon": { ml: "auto" } }}
      >
        <Box component="span" sx={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {href.length > 36 ? href.slice(0, 36) + "…" : href}
        </Box>
      </Button>
    </Box>
  );
}

// ─── Link de artefato (entregável da etapa) ───────────────────────────────────

function ArtefatoInput({ etapa, isPending, onSave, label }: {
  etapa: { linkArtefato: string | null; etapaDef: { nome: string } };
  isPending: boolean;
  onSave: (link: string | null) => void;
  label?: string;
}) {
  const [editando, setEditando] = useState(false);
  const [valor, setValor]       = useState(etapa.linkArtefato ?? "");

  const handleAbrir = () => { setValor(etapa.linkArtefato ?? ""); setEditando(true); };
  const handleSalvar = () => { onSave(valor.trim() || null); setEditando(false); };
  const handleCancelar = () => setEditando(false);

  return (
    <Box sx={{ mt: 1.5, pt: 1.5, borderTop: "1px solid", borderColor: "divider" }}>
      <Typography variant="caption" color="text.secondary" fontWeight={600} sx={{ display: "block", mb: 0.75 }}>
        {label ?? `Link do artefato (${etapa.etapaDef.nome})`}
      </Typography>
      {editando ? (
        <Box sx={{ display: "flex", gap: 1, alignItems: "center" }}>
          <TextField
            size="small" fullWidth autoFocus
            placeholder="Cole aqui o link do entregável..."
            value={valor}
            onChange={(e) => setValor(e.target.value)}
            disabled={isPending}
            sx={{ "& .MuiInputBase-input": { fontSize: "0.8125rem" } }}
          />
          <Tooltip title="Salvar link">
            <IconButton size="small" color="primary" onClick={handleSalvar} disabled={isPending}>
              <CheckIcon sx={{ fontSize: 16 }} />
            </IconButton>
          </Tooltip>
          <Tooltip title="Cancelar">
            <IconButton size="small" onClick={handleCancelar}>
              <CloseIcon sx={{ fontSize: 16 }} />
            </IconButton>
          </Tooltip>
        </Box>
      ) : etapa.linkArtefato ? (
        <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
          <Button
            href={etapa.linkArtefato} target="_blank" rel="noopener noreferrer"
            startIcon={<LinkIcon sx={{ fontSize: 14 }} />}
            size="small" variant="outlined"
            sx={{ fontSize: "0.75rem", py: 0.25, textTransform: "none", maxWidth: 280,
              overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}
          >
            {etapa.linkArtefato}
          </Button>
          <Tooltip title="Editar link">
            <IconButton size="small" onClick={handleAbrir} sx={{ color: "text.disabled" }}>
              <EditIcon sx={{ fontSize: 14 }} />
            </IconButton>
          </Tooltip>
        </Box>
      ) : (
        <Button
          size="small" variant="text" startIcon={<LinkIcon sx={{ fontSize: 14 }} />}
          onClick={handleAbrir}
          sx={{ fontSize: "0.75rem", color: "text.secondary", textTransform: "none" }}
        >
          Adicionar link do entregável
        </Button>
      )}
    </Box>
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
