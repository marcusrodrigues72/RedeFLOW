import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import {
  Box, Typography, Chip, Button, Card, CardContent,
  Table, TableHead, TableRow, TableCell, TableBody,
  Skeleton, AvatarGroup,
  Tabs, Tab, Accordion, AccordionSummary, AccordionDetails,
  Alert, IconButton, Tooltip, Drawer, Divider, Switch, FormControlLabel,
  Snackbar, Checkbox, ListItemText,
} from "@mui/material";
import ArrowBackIcon           from "@mui/icons-material/ArrowBack";
import FileDownloadIcon         from "@mui/icons-material/FileDownload";
import ExpandMoreIcon           from "@mui/icons-material/ExpandMore";
import FileUploadIcon           from "@mui/icons-material/FileUpload";
import EditOutlinedIcon         from "@mui/icons-material/EditOutlined";
import DeleteOutlineIcon        from "@mui/icons-material/DeleteOutline";
import GroupIcon                from "@mui/icons-material/Group";
import HistoryIcon              from "@mui/icons-material/History";
import ChatBubbleOutlineIcon    from "@mui/icons-material/ChatBubbleOutline";
import RestoreIcon              from "@mui/icons-material/Restore";
import SendIcon                 from "@mui/icons-material/Send";
import DeleteIcon               from "@mui/icons-material/Delete";
import EditIcon                 from "@mui/icons-material/Edit";
import ReplyIcon                from "@mui/icons-material/Reply";
import CheckIcon                from "@mui/icons-material/Check";
import CloseIcon                from "@mui/icons-material/Close";
import DiffIcon                 from "@mui/icons-material/CompareArrows";
import { useState, useRef }     from "react";
import {
  Dialog, DialogTitle, DialogContent, DialogActions,
  TextField, Select, MenuItem, FormControl, InputLabel,
  Badge, List, ListItem, Avatar,
} from "@mui/material";
import PersonAddIcon   from "@mui/icons-material/PersonAdd";
import SearchIcon      from "@mui/icons-material/Search";
import InputAdornment  from "@mui/material/InputAdornment";
import AddCircleOutlineIcon from "@mui/icons-material/AddCircleOutline";
import { useCurso, useOAsByCurso, useAdicionarMembro, useRemoverMembro, useAtualizarCurso, useExcluirCurso, useAtribuicaoPreview, useAtribuirResponsaveis, useExportarMC, useAtualizarPapeisProducao, useMIHistorico, useRestaurarMI, useComentariosMI, useAdicionarComentarioMI, useEditarComentarioMI, useExcluirComentarioMI, useAtualizarCHCapitulo } from "@/lib/api/cursos";
import { useUsuarios } from "@/lib/api/usuarios";
import { useAuthStore } from "@/stores/auth.store";
import { useConfigAlertasCurso, useSalvarConfigAlertasCurso, useAtualizarNotifMembro } from "@/lib/api/notificacoes";
import type { PapelEtapa, MIHistoricoResumo, ComentarioMI } from "shared";
import { UserAvatar } from "@/components/ui/UserAvatar";
import NotificationsNoneIcon   from "@mui/icons-material/NotificationsNone";
import CircularProgress        from "@mui/material/CircularProgress";
import Stack                   from "@mui/material/Stack";
import Slider                  from "@mui/material/Slider";

export const Route = createFileRoute("/_authed/cursos/$cursoId")({
  component: CursoDetalhePage,
});

// ─── RF-M2-02: Célula CH editável inline ─────────────────────────────────────
function CHCell({ value, onSave }: { value: string | null; onSave: (v: number | null) => void }) {
  const [editando, setEditando] = useState(false);
  const [draft,    setDraft]    = useState("");

  const iniciar = () => { setDraft(value != null ? String(Number(value)) : ""); setEditando(true); };

  const salvar = () => {
    const t = draft.trim().replace(",", ".");
    const n = t === "" ? null : parseFloat(t);
    onSave(n != null && !isNaN(n) && n >= 0 ? n : null);
    setEditando(false);
  };

  if (editando) {
    return (
      <TextField
        autoFocus size="small" value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={salvar}
        onKeyDown={(e) => {
          if (e.key === "Enter") { e.preventDefault(); salvar(); }
          if (e.key === "Escape") setEditando(false);
        }}
        inputProps={{ style: { padding: "3px 6px", width: 48, fontSize: "0.75rem", textAlign: "center" } }}
        sx={{ "& .MuiOutlinedInput-root": { borderRadius: 1 } }}
      />
    );
  }
  return (
    <Tooltip title="Clique para editar (em horas)">
      <Box
        onClick={iniciar}
        sx={{
          cursor: "pointer", display: "inline-flex", alignItems: "center", justifyContent: "center",
          px: 1, py: 0.25, borderRadius: 1, minWidth: 44,
          color: value && Number(value) > 0 ? "text.primary" : "text.disabled",
          fontSize: "0.75rem", fontWeight: value && Number(value) > 0 ? 600 : 400,
          "&:hover": { bgcolor: "#eff6ff", color: "primary.main" },
        }}
      >
        {value && Number(value) > 0
          ? `${Number(value) % 1 === 0 ? Number(value) : Number(value).toFixed(1)}h`
          : "—"}
      </Box>
    </Tooltip>
  );
}


function CursoDetalhePage() {
  const { cursoId }                   = Route.useParams();
  const navigate                      = useNavigate();
  const { data: curso, isLoading, isError } = useCurso(cursoId);
  const [aba, setAba]                 = useState(0);
  const [editOpen,       setEditOpen]       = useState(false);
  const [deleteOpen,     setDeleteOpen]     = useState(false);
  const [atribuirOpen,   setAtribuirOpen]   = useState(false);
  const [miHistoricoOpen, setMiHistoricoOpen] = useState(false);
  const [comentarioCapId, setComentarioCapId] = useState<string | null>(null);

  const user = useAuthStore((s) => s.user);

  const { mutate: atualizar, isPending: atualizando } = useAtualizarCurso(cursoId);
  const { mutate: excluir,   isPending: excluindo   } = useExcluirCurso();
  const { mutate: atualizarCH } = useAtualizarCHCapitulo(cursoId);
  const { mutate: exportar,  isPending: exportando  } = useExportarMC(cursoId, curso?.codigo ?? "");
  const { data: oasDoCurso = [] }                     = useOAsByCurso(cursoId, {});

  if (isLoading) return <LoadingSkeleton />;
  if (isError || !curso) return (
    <Alert severity="error" sx={{ maxWidth: 600 }}>Curso não encontrado ou sem acesso.</Alert>
  );

  // KPIs da MC (calculados a partir das unidades)
  const totalCapitulos = curso.unidades.reduce((s, u) => s + u.capitulos.length, 0);
  const totalOAs       = curso.unidades.reduce((s, u) => u.capitulos.reduce((ss, c) => ss + c._count.oas, 0) + s, 0);

  const isAdmin = user?.papelGlobal === "ADMIN"
    || curso.membros.some((m) => m.usuarioId === user?.id && m.papel === "ADMIN");
  const setupPendente = oasDoCurso.length > 0
    ? oasDoCurso.filter((oa) =>
        oa.etapas.some((e) => e.etapaDef.papel === "COORDENADOR_PRODUCAO" && e.status !== "CONCLUIDA")
      ).length
    : 0;
  const totalComSetup = oasDoCurso.filter((oa) =>
    oa.etapas.some((e) => e.etapaDef.papel === "COORDENADOR_PRODUCAO")
  ).length;

  return (
    <Box>
      {/* ── Banner de Setup de Produção ─────────────────────────────────────── */}
      {setupPendente > 0 && isAdmin && (
        <Alert
          severity="warning"
          sx={{ mb: 2.5 }}
          action={
            <Button component={Link} to={`/cursos/${cursoId}/setup-producao`} size="small" color="inherit" sx={{ fontWeight: 700, whiteSpace: "nowrap" }}>
              Ir para Setup
            </Button>
          }
        >
          <strong>Setup de Produção pendente:</strong> {setupPendente} de {totalComSetup} OAs ainda não foram configurados.
        </Alert>
      )}

      {/* ── Header ──────────────────────────────────────────────────────────── */}
      <Box sx={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", mb: 3 }}>
        <Box sx={{ display: "flex", alignItems: "center", gap: 2 }}>
          <Button component={Link} to="/cursos" startIcon={<ArrowBackIcon />} sx={{ color: "text.secondary" }}>
            Cursos
          </Button>
          <Box>
            <Box sx={{ display: "flex", alignItems: "center", gap: 1.5, mb: 0.25 }}>
              <Typography sx={{ fontSize: "1.375rem", fontWeight: 800 }}>{curso.nome}</Typography>
              <StatusCursoChip status={curso.status} />
            </Box>
            <Typography variant="caption" color="text.disabled" sx={{ fontFamily: "monospace" }}>{curso.codigo}</Typography>
          </Box>
        </Box>
        <Box sx={{ display: "flex", gap: 1.5 }}>
          <Button
            component={Link} to="/cursos/importar"
            variant="outlined" startIcon={<FileUploadIcon />} size="small" sx={{ fontWeight: 600 }}
          >
            Importar MC
          </Button>
          <Button
            variant="outlined" startIcon={<FileDownloadIcon />} size="small"
            disabled={exportando || totalOAs === 0}
            onClick={() => exportar()}
          >
            {exportando ? "Gerando..." : "Exportar .xlsx"}
          </Button>
          {isAdmin && (
            <Button
              variant="outlined" startIcon={<GroupIcon />} size="small" sx={{ fontWeight: 600 }}
              onClick={() => setAtribuirOpen(true)}
            >
              Atribuir Responsáveis
            </Button>
          )}
          <Tooltip title="Editar curso">
            <IconButton size="small" onClick={() => setEditOpen(true)} sx={{ border: "1px solid", borderColor: "divider" }}>
              <EditOutlinedIcon fontSize="small" />
            </IconButton>
          </Tooltip>
          <Tooltip title="Excluir curso">
            <IconButton size="small" onClick={() => setDeleteOpen(true)} sx={{ border: "1px solid", borderColor: "divider", color: "#ef4444" }}>
              <DeleteOutlineIcon fontSize="small" />
            </IconButton>
          </Tooltip>
        </Box>
      </Box>

      {/* ── Dialogs ──────────────────────────────────────────────────────────── */}
      <EditarCursoDialog
        open={editOpen}
        curso={curso}
        salvando={atualizando}
        onClose={() => setEditOpen(false)}
        onSalvar={(data) => atualizar(data, { onSuccess: () => setEditOpen(false) })}
      />
      <ExcluirCursoDialog
        open={deleteOpen}
        nomeCurso={curso.nome}
        totalOAs={totalOAs}
        excluindo={excluindo}
        onClose={() => setDeleteOpen(false)}
        onConfirmar={() => excluir(cursoId, { onSuccess: () => navigate({ to: "/cursos" }) })}
      />
      <AtribuicaoDrawer
        open={atribuirOpen}
        cursoId={cursoId}
        membros={curso.membros}
        unidades={curso.unidades}
        onClose={() => setAtribuirOpen(false)}
      />

      {/* ── KPIs ───────────────────────────────────────────────────────────── */}
      <Box sx={{ display: "flex", gap: 2.5, mb: 3, flexWrap: "wrap" }}>
        {[
          { label: "Unidades",   value: curso.unidades.length },
          { label: "Capítulos",  value: totalCapitulos },
          { label: "OAs",        value: totalOAs },
          { label: "CH Planejada", value: `${curso.chTotalPlanejada}h` },
        ].map((k) => (
          <Card key={k.label} sx={{ minWidth: 120 }}>
            <CardContent sx={{ p: 2.5, pb: "12px !important" }}>
              <Typography sx={{ fontSize: "1.75rem", fontWeight: 900, color: "text.primary" }}>{k.value}</Typography>
              <Typography variant="caption" color="text.secondary">{k.label}</Typography>
            </CardContent>
          </Card>
        ))}

        {/* Equipe */}
        {curso.membros.length > 0 && (
          <Card sx={{ flex: 1, minWidth: 200 }}>
            <CardContent sx={{ p: 2.5, pb: "12px !important", display: "flex", alignItems: "center", gap: 2 }}>
              <AvatarGroup max={5} sx={{ "& .MuiAvatar-root": { width: 32, height: 32, fontSize: "0.75rem", border: "2px solid white" } }}>
                {curso.membros.map((m) => (
                  <UserAvatar key={m.usuarioId} nome={m.usuario.nome} fotoUrl={m.usuario.fotoUrl} size={32} showTooltip />
                ))}
              </AvatarGroup>
              <Box>
                <Typography variant="body2" fontWeight={700}>{curso.membros.length} membro(s)</Typography>
                <Typography variant="caption" color="text.secondary">na equipe do curso</Typography>
              </Box>
            </CardContent>
          </Card>
        )}
      </Box>

      {/* ── Abas ────────────────────────────────────────────────────────────── */}
      <Tabs value={aba} onChange={(_, v) => setAba(v)} sx={{ mb: 3, borderBottom: "1px solid", borderColor: "divider" }}>
        <Tab label="Matriz de Conteúdo" sx={{ fontWeight: 600 }} />
        <Tab label="Matriz Instrucional" sx={{ fontWeight: 600 }} />
        <Tab label="Equipe" sx={{ fontWeight: 600 }} />
        <Tab label="Alertas" sx={{ fontWeight: 600 }} icon={<NotificationsNoneIcon sx={{ fontSize: 16 }} />} iconPosition="start" />
      </Tabs>

      {/* Aba 0 — Matriz de Conteúdo */}
      {aba === 0 && (
        totalOAs === 0 ? (
          <EmptyMC cursoId={cursoId} />
        ) : (
          <Box>
            {curso.unidades.map((unidade) => (
              <Accordion key={unidade.id} defaultExpanded={curso.unidades.length === 1} sx={{ mb: 1.5, "&:before": { display: "none" }, borderRadius: "12px !important", overflow: "hidden" }}>
                <AccordionSummary expandIcon={<ExpandMoreIcon />} sx={{ bgcolor: "#f8fafc", px: 3 }}>
                  <Box sx={{ display: "flex", alignItems: "center", gap: 2 }}>
                    <Chip label={`U${unidade.numero}`} size="small" sx={{ bgcolor: "primary.main", color: "white", fontWeight: 700, fontSize: "0.7rem" }} />
                    <Typography fontWeight={700}>{unidade.nome}</Typography>
                    <Typography variant="caption" color="text.secondary">
                      {unidade.capitulos.reduce((s, c) => s + c._count.oas, 0)} OAs · {unidade.capitulos.length} capítulos
                    </Typography>
                  </Box>
                </AccordionSummary>
                <AccordionDetails sx={{ p: 0 }}>
                  <Table size="small">
                    <TableHead>
                      <TableRow sx={{ bgcolor: "#fafafa" }}>
                        {["Capítulo", "OAs", "Ações"].map((h) => (
                          <TableCell key={h} sx={{ fontWeight: 700, fontSize: "0.75rem", color: "text.secondary", py: 1.5 }}>{h}</TableCell>
                        ))}
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {unidade.capitulos.map((cap) => (
                        <TableRow key={cap.id} sx={{ "&:hover": { bgcolor: "action.hover" } }}>
                          <TableCell sx={{ py: 1.5 }}>
                            <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                              <Typography variant="caption" color="text.disabled" sx={{ fontFamily: "monospace", minWidth: 32 }}>
                                C{cap.numero}
                              </Typography>
                              <Typography variant="body2" fontWeight={500}>{cap.nome}</Typography>
                            </Box>
                          </TableCell>
                          <TableCell>
                            <Chip
                              label={`${cap._count.oas} OA${cap._count.oas !== 1 ? "s" : ""}`}
                              size="small"
                              sx={{ bgcolor: cap._count.oas > 0 ? "#eff6ff" : "#f1f5f9", color: cap._count.oas > 0 ? "primary.main" : "text.disabled", fontWeight: 600, fontSize: "0.7rem" }}
                            />
                          </TableCell>
                          <TableCell>
                            <Button
                              component={Link}
                              to={`/cursos/${cursoId}/oas`}
                              size="small" variant="outlined"
                              sx={{ fontSize: "0.7rem", py: 0.25 }}
                            >
                              Ver OAs
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </AccordionDetails>
              </Accordion>
            ))}
          </Box>
        )
      )}

      {/* Aba 1 — Matriz Instrucional */}
      {aba === 1 && (
        curso.unidades.every((u) => u.capitulos.every((c) => c.objetivos.length === 0)) ? (
          <Card>
            <CardContent sx={{ p: 6, textAlign: "center" }}>
              <Typography color="text.secondary" sx={{ mb: 2 }}>
                Nenhuma Matriz Instrucional importada ainda.
              </Typography>
              <Button
                component={Link}
                to="/cursos/importar"
                variant="contained"
                startIcon={<FileUploadIcon />}
                sx={{ fontWeight: 700 }}
              >
                Importar Matriz Instrucional
              </Button>
            </CardContent>
          </Card>
        ) : (
          <Box>
            {/* Barra de ações da MI */}
            <Box sx={{ display: "flex", justifyContent: "flex-end", mb: 2 }}>
              <Button
                variant="outlined"
                size="small"
                startIcon={<HistoryIcon />}
                onClick={() => setMiHistoricoOpen(true)}
              >
                Histórico de versões
              </Button>
            </Box>

            {curso.unidades.map((unidade) => {
              // RF-M2-02: totais calculados em tempo real a partir dos capítulos
              const totalAssinc = unidade.capitulos.reduce((s, c) => s + Number(c.chAssincrona ?? 0), 0);
              const totalSinc   = unidade.capitulos.reduce((s, c) => s + Number(c.chSincrona   ?? 0), 0);
              const totalAtiv   = unidade.capitulos.reduce((s, c) => s + Number(c.chAtividades  ?? 0), 0);
              const fmt = (v: number) => v > 0 ? `${v % 1 === 0 ? v : v.toFixed(1)}h` : null;

              return (
                <Accordion key={unidade.id} defaultExpanded={curso.unidades.length === 1}
                  sx={{ mb: 1.5, "&:before": { display: "none" }, borderRadius: "12px !important", overflow: "hidden" }}>
                  <AccordionSummary expandIcon={<ExpandMoreIcon />} sx={{ bgcolor: "#f8fafc", px: 3 }}>
                    <Box sx={{ display: "flex", alignItems: "center", gap: 2, flexWrap: "wrap" }}>
                      <Chip label={`U${unidade.numero}`} size="small"
                        sx={{ bgcolor: "primary.main", color: "white", fontWeight: 700, fontSize: "0.7rem" }} />
                      <Typography fontWeight={700}>{unidade.nome}</Typography>
                      <Typography variant="caption" color="text.secondary">
                        {unidade.capitulos.length} capítulos
                      </Typography>
                      {/* Totais de CH calculados automaticamente */}
                      {(totalAssinc > 0 || totalSinc > 0 || totalAtiv > 0) && (
                        <Box sx={{ display: "flex", gap: 0.75, ml: "auto" }}>
                          {fmt(totalAssinc) && (
                            <Chip label={`Assínc. ${fmt(totalAssinc)}`} size="small"
                              sx={{ bgcolor: "#eff6ff", color: "primary.main", fontSize: "0.65rem", height: 20, fontWeight: 600 }} />
                          )}
                          {fmt(totalSinc) && (
                            <Chip label={`Sínc. ${fmt(totalSinc)}`} size="small"
                              sx={{ bgcolor: "#f0fdf4", color: "#166534", fontSize: "0.65rem", height: 20, fontWeight: 600 }} />
                          )}
                          {fmt(totalAtiv) && (
                            <Chip label={`Ativ. ${fmt(totalAtiv)}`} size="small"
                              sx={{ bgcolor: "#fef9c3", color: "#854d0e", fontSize: "0.65rem", height: 20, fontWeight: 600 }} />
                          )}
                        </Box>
                      )}
                    </Box>
                  </AccordionSummary>
                  <AccordionDetails sx={{ p: 0 }}>
                    <Table size="small">
                      <TableHead>
                        <TableRow sx={{ bgcolor: "#fafafa" }}>
                          <TableCell sx={{ fontWeight: 700, fontSize: "0.75rem", color: "text.secondary", py: 1.5 }}>Capítulo</TableCell>
                          <TableCell sx={{ fontWeight: 700, fontSize: "0.75rem", color: "text.secondary", py: 1.5, width: 70, textAlign: "center" }}>
                            <Tooltip title="Carga Horária Assíncrona — clique para editar">
                              <span>Assínc.</span>
                            </Tooltip>
                          </TableCell>
                          <TableCell sx={{ fontWeight: 700, fontSize: "0.75rem", color: "text.secondary", py: 1.5, width: 70, textAlign: "center" }}>
                            <Tooltip title="Carga Horária Síncrona — clique para editar">
                              <span>Sínc.</span>
                            </Tooltip>
                          </TableCell>
                          <TableCell sx={{ fontWeight: 700, fontSize: "0.75rem", color: "text.secondary", py: 1.5, width: 70, textAlign: "center" }}>
                            <Tooltip title="Carga Horária de Atividades — clique para editar">
                              <span>Ativ.</span>
                            </Tooltip>
                          </TableCell>
                          <TableCell sx={{ fontWeight: 700, fontSize: "0.75rem", color: "text.secondary", py: 1.5 }}>Objetivos Educacionais</TableCell>
                          <TableCell sx={{ width: 48 }} />
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {unidade.capitulos.map((cap) => (
                          <TableRow key={cap.id} sx={{ verticalAlign: "top", "&:hover": { bgcolor: "action.hover" } }}>
                            <TableCell sx={{ py: 1.5, minWidth: 160 }}>
                              <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                                <Typography variant="caption" color="text.disabled"
                                  sx={{ fontFamily: "monospace", minWidth: 32 }}>C{cap.numero}</Typography>
                                <Typography variant="body2" fontWeight={500}>{cap.nome}</Typography>
                              </Box>
                            </TableCell>
                            {/* CH editável inline — RF-M2-02 */}
                            <TableCell sx={{ py: 1, textAlign: "center" }}>
                              <CHCell
                                value={cap.chAssincrona}
                                onSave={(v) => atualizarCH({ capituloId: cap.id, chAssincrona: v })}
                              />
                            </TableCell>
                            <TableCell sx={{ py: 1, textAlign: "center" }}>
                              <CHCell
                                value={cap.chSincrona}
                                onSave={(v) => atualizarCH({ capituloId: cap.id, chSincrona: v })}
                              />
                            </TableCell>
                            <TableCell sx={{ py: 1, textAlign: "center" }}>
                              <CHCell
                                value={cap.chAtividades}
                                onSave={(v) => atualizarCH({ capituloId: cap.id, chAtividades: v })}
                              />
                            </TableCell>
                            <TableCell sx={{ py: 1.5 }}>
                              {cap.objetivos.length === 0 ? (
                                <Typography variant="caption" color="text.disabled">—</Typography>
                              ) : (
                                <Box sx={{ display: "flex", flexDirection: "column", gap: 0.5 }}>
                                  {cap.objetivos.map((oe) => (
                                    <Box key={oe.id} sx={{ display: "flex", alignItems: "flex-start", gap: 1 }}>
                                      <Typography variant="caption" color="text.disabled"
                                        sx={{ fontFamily: "monospace", minWidth: 24, mt: 0.1 }}>
                                        OE{oe.numero}
                                      </Typography>
                                      <Box sx={{ flex: 1 }}>
                                        <Typography variant="caption">{oe.descricao}</Typography>
                                        {oe.nivelBloom && (
                                          <Chip label={oe.nivelBloom} size="small"
                                            sx={{ ml: 0.75, height: 16, fontSize: "0.6rem", bgcolor: "#eff6ff", color: "primary.main" }} />
                                        )}
                                      </Box>
                                    </Box>
                                  ))}
                                </Box>
                              )}
                            </TableCell>
                            <TableCell sx={{ py: 1.5, width: 48, textAlign: "right" }}>
                              <Tooltip title={`${cap._count.comentarios} comentário(s)`}>
                                <IconButton size="small" onClick={() => setComentarioCapId(cap.id)}>
                                  <Badge
                                    badgeContent={cap._count.comentarios || undefined}
                                    color="primary"
                                    sx={{ "& .MuiBadge-badge": { fontSize: "0.6rem", minWidth: 16, height: 16 } }}
                                  >
                                    <ChatBubbleOutlineIcon sx={{ fontSize: 18, color: "text.disabled" }} />
                                  </Badge>
                                </IconButton>
                              </Tooltip>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </AccordionDetails>
                </Accordion>
              );
            })}
          </Box>
        )
      )}

      {/* Drawers de MI */}
      <MIHistoricoDrawer
        open={miHistoricoOpen}
        cursoId={cursoId}
        isAdmin={isAdmin}
        onClose={() => setMiHistoricoOpen(false)}
      />
      {comentarioCapId && (
        <ComentariosMIDrawer
          open={!!comentarioCapId}
          cursoId={cursoId}
          capituloId={comentarioCapId}
          capituloNome={
            curso.unidades.flatMap((u) => u.capitulos).find((c) => c.id === comentarioCapId)?.nome ?? ""
          }
          onClose={() => setComentarioCapId(null)}
        />
      )}

      {/* Aba 2 — Equipe */}
      {aba === 2 && <EquipeTab cursoId={cursoId} membros={curso.membros} isAdmin={isAdmin} />}

      {/* Aba 3 — Alertas */}
      {aba === 3 && <AlertasTab cursoId={cursoId} membros={curso.membros} isAdmin={isAdmin} />}
    </Box>
  );
}

// ─── Dialog Editar Curso ──────────────────────────────────────────────────────

function EditarCursoDialog({ open, curso, salvando, onClose, onSalvar }: {
  open: boolean;
  curso: { nome: string; descricao: string | null; status: string };
  salvando: boolean;
  onClose: () => void;
  onSalvar: (data: { nome: string; descricao?: string; status: string }) => void;
}) {
  const [nome,      setNome]      = useState(curso.nome);
  const [descricao, setDescricao] = useState(curso.descricao ?? "");
  const [status,    setStatus]    = useState(curso.status);

  // Sincroniza com dados do curso quando o dialog abre
  const handleOpen = () => { setNome(curso.nome); setDescricao(curso.descricao ?? ""); setStatus(curso.status); };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth TransitionProps={{ onEnter: handleOpen }}>
      <DialogTitle sx={{ fontWeight: 700 }}>Editar Curso</DialogTitle>
      <DialogContent sx={{ display: "flex", flexDirection: "column", gap: 2.5, pt: "16px !important" }}>
        <TextField
          label="Nome" value={nome} onChange={(e) => setNome(e.target.value)}
          fullWidth size="small" inputProps={{ maxLength: 200 }}
        />
        <TextField
          label="Descrição" value={descricao} onChange={(e) => setDescricao(e.target.value)}
          fullWidth size="small" multiline rows={3} inputProps={{ maxLength: 1000 }}
        />
        <FormControl size="small" fullWidth>
          <InputLabel>Status</InputLabel>
          <Select value={status} label="Status" onChange={(e) => setStatus(e.target.value)}>
            <MenuItem value="RASCUNHO">Rascunho</MenuItem>
            <MenuItem value="ATIVO">Ativo</MenuItem>
            <MenuItem value="ARQUIVADO">Arquivado</MenuItem>
          </Select>
        </FormControl>
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button onClick={onClose}>Cancelar</Button>
        <Button
          variant="contained" onClick={() => onSalvar({ nome, descricao: descricao || undefined, status })}
          disabled={!nome.trim() || salvando} sx={{ fontWeight: 700 }}
        >
          {salvando ? "Salvando..." : "Salvar"}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

// ─── Dialog Excluir Curso ─────────────────────────────────────────────────────

function ExcluirCursoDialog({ open, nomeCurso, totalOAs, excluindo, onClose, onConfirmar }: {
  open: boolean; nomeCurso: string; totalOAs: number; excluindo: boolean;
  onClose: () => void; onConfirmar: () => void;
}) {
  return (
    <Dialog open={open} onClose={onClose} maxWidth="xs" fullWidth>
      <DialogTitle sx={{ fontWeight: 700, color: "#ef4444" }}>Excluir Curso</DialogTitle>
      <DialogContent>
        <Typography variant="body2" color="text.secondary">
          Tem certeza que deseja excluir o curso <strong>{nomeCurso}</strong>?
        </Typography>
        <Alert severity="warning" sx={{ mt: 2, fontSize: "0.8rem" }}>
          Esta ação é irreversível.{" "}
          {totalOAs > 0
            ? <><strong>{totalOAs} OA{totalOAs !== 1 ? "s" : ""}</strong>, além de etapas, objetivos e comentários, serão excluídos permanentemente.</>
            : <>Todos os dados do curso serão excluídos permanentemente.</>}
        </Alert>
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button onClick={onClose}>Cancelar</Button>
        <Button
          variant="contained" color="error" onClick={onConfirmar}
          disabled={excluindo} sx={{ fontWeight: 700 }}
        >
          {excluindo ? "Excluindo..." : "Excluir Permanentemente"}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

// ─── Aba Equipe ───────────────────────────────────────────────────────────────

const PAPEL_EQUIPE_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
  ADMIN:       { label: "Admin",       color: "#2b7cee", bg: "#eff6ff" },
  COLABORADOR: { label: "Colaborador", color: "#7c3aed", bg: "#f5f3ff" },
  LEITOR:      { label: "Leitor",      color: "#64748b", bg: "#f8fafc" },
};

const PAPEIS_PRODUCAO_OPCOES: { value: string; label: string }[] = [
  { value: "COORDENADOR_PRODUCAO",   label: "Coord. Produção" },
  { value: "CONTEUDISTA",            label: "Conteudista" },
  { value: "DESIGNER_INSTRUCIONAL",  label: "Designer Instrucional" },
  { value: "PROFESSOR_ATOR",         label: "Professor Ator" },
  { value: "PROFESSOR_TECNICO",      label: "Professor Técnico" },
  { value: "ACESSIBILIDADE",         label: "Acessibilidade" },
  { value: "EDITOR_VIDEO",           label: "Editor de Vídeo" },
  { value: "DESIGNER_GRAFICO",       label: "Designer Gráfico" },
  { value: "PRODUTOR_FINAL",         label: "Produtor Final" },
  { value: "VALIDADOR_FINAL",        label: "Validador Final" },
];

function EquipeTab({ cursoId, membros, isAdmin }: {
  cursoId: string;
  membros: { usuarioId: string; papel: string; papeisProducao: string[]; usuario: { id: string; nome: string; email: string; fotoUrl: string | null } }[];
  isAdmin: boolean;
}) {
  const { mutate: adicionar, isPending: adicionando }  = useAdicionarMembro(cursoId);
  const { mutate: remover }                            = useRemoverMembro(cursoId);
  const { mutate: atualizarRoles }                     = useAtualizarPapeisProducao(cursoId);
  const { data: todos = [] }                           = useUsuarios();
  const [dialogOpen,    setDialogOpen]                 = useState(false);
  const [busca,         setBusca]                      = useState("");
  const [papeis,        setPapeis]                     = useState<Record<string, string>>({});
  const [adicionandoId, setAdicionandoId]              = useState<string | null>(null);
  const [localRoles,    setLocalRoles]                 = useState<Record<string, string[]>>({});

  const getRoles = (usuarioId: string): string[] =>
    localRoles[usuarioId] ?? membros.find((m) => m.usuarioId === usuarioId)?.papeisProducao ?? [];

  const handleRolesChange = (usuarioId: string, newRoles: string[]) =>
    setLocalRoles((prev) => ({ ...prev, [usuarioId]: newRoles }));

  const handleRolesClose = (usuarioId: string) => {
    const original = membros.find((m) => m.usuarioId === usuarioId)?.papeisProducao ?? [];
    const pending  = localRoles[usuarioId];
    if (pending && JSON.stringify([...pending].sort()) !== JSON.stringify([...original].sort())) {
      atualizarRoles({ usuarioId, papeisProducao: pending });
    }
  };

  const disponiveis = todos.filter((u) => u.ativo && !membros.some((m) => m.usuarioId === u.id));

  const dispFiltrados = busca.trim()
    ? disponiveis.filter((u) => {
        const q = busca.toLowerCase();
        return u.nome.toLowerCase().includes(q) || u.email.toLowerCase().includes(q);
      })
    : disponiveis;

  const getPapel = (id: string) => papeis[id] ?? "COLABORADOR";

  const handleAdicionar = (usuarioId: string) => {
    setAdicionandoId(usuarioId);
    adicionar(
      { usuarioId, papel: getPapel(usuarioId) },
      { onSuccess: () => { setAdicionandoId(null); setPapeis((p) => { const n = { ...p }; delete n[usuarioId]; return n; }); } },
    );
  };

  const handleClose = () => { setDialogOpen(false); setBusca(""); setPapeis({}); };

  return (
    <>
      <Card>
        <CardContent sx={{ p: 0, pb: "0 !important" }}>
          <Box sx={{ px: 3, py: 2, display: "flex", alignItems: "center", justifyContent: "space-between",
            borderBottom: "1px solid", borderColor: "divider" }}>
            <Typography variant="body2" fontWeight={700}>{membros.length} membro{membros.length !== 1 ? "s" : ""}</Typography>
            <Button size="small" startIcon={<PersonAddIcon />} variant="outlined"
              onClick={() => setDialogOpen(true)} sx={{ fontWeight: 600, fontSize: "0.75rem" }}>
              Adicionar
            </Button>
          </Box>
          <Table>
            <TableHead>
              <TableRow sx={{ bgcolor: "#f8fafc" }}>
                {["Membro", "E-mail", "Papel", "Papéis de Produção", ""].map((h) => (
                  <TableCell key={h} sx={{ fontWeight: 700, fontSize: "0.75rem", color: "text.secondary" }}>{h}</TableCell>
                ))}
              </TableRow>
            </TableHead>
            <TableBody>
              {membros.map((m) => {
                const pc    = PAPEL_EQUIPE_CONFIG[m.papel] ?? PAPEL_EQUIPE_CONFIG.COLABORADOR;
                const roles = getRoles(m.usuarioId);
                return (
                  <TableRow key={m.usuarioId} sx={{ "&:hover": { bgcolor: "action.hover" } }}>
                    <TableCell>
                      <Box sx={{ display: "flex", alignItems: "center", gap: 1.5 }}>
                        <UserAvatar nome={m.usuario.nome} fotoUrl={m.usuario.fotoUrl} size={32} />
                        <Typography variant="body2" fontWeight={600}>{m.usuario.nome}</Typography>
                      </Box>
                    </TableCell>
                    <TableCell><Typography variant="body2" color="text.secondary">{m.usuario.email}</Typography></TableCell>
                    <TableCell>
                      {isAdmin ? (
                        <Select
                          size="small"
                          value={m.papel}
                          onChange={(e) => atualizarRoles({ usuarioId: m.usuarioId, papel: e.target.value })}
                          sx={{
                            fontSize: "0.75rem", height: 28, fontWeight: 600,
                            bgcolor: pc.bg, color: pc.color,
                            "& .MuiOutlinedInput-notchedOutline": { border: "none" },
                            "& .MuiSelect-icon": { color: pc.color },
                          }}
                        >
                          {(Object.keys(PAPEL_EQUIPE_CONFIG) as string[]).map((p) => (
                            <MenuItem key={p} value={p} sx={{ fontSize: "0.75rem" }}>
                              {PAPEL_EQUIPE_CONFIG[p]!.label}
                            </MenuItem>
                          ))}
                        </Select>
                      ) : (
                        <Chip label={pc.label} size="small"
                          sx={{ bgcolor: pc.bg, color: pc.color, fontWeight: 600, fontSize: "0.7rem" }} />
                      )}
                    </TableCell>
                    <TableCell sx={{ minWidth: 220 }}>
                      <Select
                        multiple
                        size="small"
                        displayEmpty
                        value={roles}
                        onChange={(e) => handleRolesChange(m.usuarioId, e.target.value as string[])}
                        onClose={() => handleRolesClose(m.usuarioId)}
                        renderValue={(selected) =>
                          selected.length === 0 ? (
                            <Typography variant="caption" color="text.disabled">Nenhum</Typography>
                          ) : (
                            <Box sx={{ display: "flex", flexWrap: "wrap", gap: 0.5 }}>
                              {(selected as string[]).map((v) => (
                                <Chip
                                  key={v}
                                  label={PAPEIS_PRODUCAO_OPCOES.find((o) => o.value === v)?.label ?? v}
                                  size="small"
                                  sx={{ fontSize: "0.65rem", height: 18 }}
                                />
                              ))}
                            </Box>
                          )
                        }
                        sx={{ fontSize: "0.8rem", minWidth: 160 }}
                      >
                        {PAPEIS_PRODUCAO_OPCOES.map((op) => (
                          <MenuItem key={op.value} value={op.value} dense>
                            <Checkbox checked={roles.includes(op.value)} size="small" sx={{ py: 0 }} />
                            <ListItemText primary={op.label} primaryTypographyProps={{ fontSize: "0.8rem" }} />
                          </MenuItem>
                        ))}
                      </Select>
                    </TableCell>
                    <TableCell align="right">
                      <Tooltip title="Remover do curso">
                        <IconButton size="small" onClick={() => remover(m.usuarioId)} sx={{ color: "text.disabled" }}>
                          <DeleteOutlineIcon sx={{ fontSize: 16 }} />
                        </IconButton>
                      </Tooltip>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* ── Dialog: adicionar membro ── */}
      <Dialog open={dialogOpen} onClose={handleClose} maxWidth="sm" fullWidth>
        <DialogTitle sx={{ fontWeight: 700, pb: 1 }}>Adicionar membro</DialogTitle>
        <DialogContent sx={{ pt: "8px !important", pb: 1 }}>
          <TextField
            size="small" fullWidth
            placeholder="Buscar por nome ou e-mail…"
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            sx={{ mb: 2 }}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <SearchIcon sx={{ fontSize: 18, color: "text.disabled" }} />
                </InputAdornment>
              ),
            }}
          />

          {disponiveis.length === 0 ? (
            <Typography variant="body2" color="text.disabled" sx={{ textAlign: "center", py: 3 }}>
              Todos os usuários já fazem parte da equipe.
            </Typography>
          ) : dispFiltrados.length === 0 ? (
            <Typography variant="body2" color="text.disabled" sx={{ textAlign: "center", py: 3 }}>
              Nenhum usuário encontrado para "{busca}"
            </Typography>
          ) : (
            <Box sx={{ maxHeight: 360, overflowY: "auto", display: "flex", flexDirection: "column", gap: 0.5 }}>
              {dispFiltrados.map((u) => (
                <Box key={u.id} sx={{
                  display: "flex", alignItems: "center", gap: 1.5,
                  px: 1.5, py: 1, borderRadius: 1.5,
                  border: "1px solid", borderColor: "divider",
                  "&:hover": { bgcolor: "action.hover" },
                }}>
                  <UserAvatar nome={u.nome} fotoUrl={u.fotoUrl} size={34} />
                  <Box sx={{ flex: 1, minWidth: 0 }}>
                    <Typography variant="body2" fontWeight={600} noWrap>{u.nome}</Typography>
                    <Typography variant="caption" color="text.secondary" noWrap>{u.email}</Typography>
                  </Box>
                  <Select
                    size="small"
                    value={getPapel(u.id)}
                    onChange={(e) => setPapeis((p) => ({ ...p, [u.id]: e.target.value }))}
                    sx={{ minWidth: 130, fontSize: "0.8rem" }}
                  >
                    <MenuItem value="ADMIN">Admin</MenuItem>
                    <MenuItem value="COLABORADOR">Colaborador</MenuItem>
                    <MenuItem value="LEITOR">Leitor</MenuItem>
                  </Select>
                  <Tooltip title="Adicionar ao curso">
                    <span>
                      <IconButton
                        size="small" color="primary"
                        onClick={() => handleAdicionar(u.id)}
                        disabled={adicionando && adicionandoId === u.id}
                      >
                        <AddCircleOutlineIcon sx={{ fontSize: 22 }} />
                      </IconButton>
                    </span>
                  </Tooltip>
                </Box>
              ))}
            </Box>
          )}
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button variant="contained" onClick={handleClose} sx={{ fontWeight: 700 }}>Fechar</Button>
        </DialogActions>
      </Dialog>
    </>
  );
}

// ─── Aba Alertas ──────────────────────────────────────────────────────────────

function AlertasTab({ cursoId, membros, isAdmin }: {
  cursoId: string;
  membros: { usuarioId: string; papel: string; notifEmailAtivo: boolean; notifInAppAtivo: boolean; usuario: { id: string; nome: string; email: string; fotoUrl: string | null } }[];
  isAdmin: boolean;
}) {
  const { data: config, isLoading } = useConfigAlertasCurso(cursoId);
  const { mutate: salvar, isPending: salvando } = useSalvarConfigAlertasCurso(cursoId);
  const { mutate: atualizarNotif } = useAtualizarNotifMembro(cursoId);

  if (isLoading) {
    return (
      <Box sx={{ display: "flex", justifyContent: "center", py: 6 }}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Stack spacing={3}>
      {/* ── Configuração global do curso ─────────────────────────────────── */}
      <Card>
        <CardContent>
          <Typography variant="subtitle1" fontWeight={700} mb={2}>
            Configuração de Alertas do Curso
          </Typography>
          {!isAdmin && (
            <Alert severity="info" sx={{ mb: 2 }}>
              Apenas administradores podem alterar estas configurações.
            </Alert>
          )}

          {/* Dias de antecedência */}
          <Box sx={{ mb: 3 }}>
            <Typography variant="body2" fontWeight={600} gutterBottom>
              Dias de antecedência para alerta de prazo próximo
            </Typography>
            <Stack direction="row" alignItems="center" spacing={2} sx={{ maxWidth: 400 }}>
              <Slider
                value={config?.diasAntecedencia ?? 3}
                min={1} max={30} step={1}
                marks={[{ value: 1, label: "1d" }, { value: 7, label: "7d" }, { value: 14, label: "14d" }, { value: 30, label: "30d" }]}
                valueLabelDisplay="auto"
                disabled={!isAdmin || salvando}
                onChange={(_, v) => salvar({ diasAntecedencia: v as number })}
                sx={{ flex: 1 }}
              />
              <Typography variant="body2" fontWeight={700} sx={{ minWidth: 32, textAlign: "right" }}>
                {config?.diasAntecedencia ?? 3}d
              </Typography>
            </Stack>
          </Box>

          {/* Toggles de tipos de alerta */}
          <Typography variant="body2" fontWeight={600} gutterBottom>
            Tipos de alerta ativos
          </Typography>
          <Stack spacing={0.5}>
            {([
              { key: "alertDeadlineVencido", label: "Prazo vencido" },
              { key: "alertPrazoProximo",    label: "Prazo próximo" },
              { key: "alertEtapaLiberada",   label: "Etapa liberada" },
              { key: "alertMencao",          label: "Menção" },
            ] as { key: keyof typeof config; label: string }[]).map(({ key, label }) => (
              <FormControlLabel
                key={key}
                control={
                  <Switch
                    size="small"
                    checked={Boolean(config?.[key] ?? true)}
                    disabled={!isAdmin || salvando}
                    onChange={(e) => salvar({ [key]: e.target.checked })}
                  />
                }
                label={<Typography variant="body2">{label}</Typography>}
              />
            ))}
          </Stack>
        </CardContent>
      </Card>

      {/* ── Preferências por colaborador ─────────────────────────────────── */}
      <Card>
        <CardContent sx={{ p: 0, pb: "0 !important" }}>
          <Box sx={{ px: 3, py: 2, borderBottom: "1px solid", borderColor: "divider" }}>
            <Typography variant="subtitle1" fontWeight={700}>
              Preferências de Notificação por Membro
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
              Cada membro pode desativar notificações por e-mail ou in-app especificamente para este curso.
            </Typography>
          </Box>
          <Table size="small">
            <TableHead>
              <TableRow sx={{ bgcolor: "#f8fafc" }}>
                {["Membro", "E-mail", "Notif. In-App", "E-mail Ativo", "In-App Ativo"].map((h) => (
                  <TableCell key={h} sx={{ fontWeight: 700, fontSize: "0.75rem", color: "text.secondary" }}>{h}</TableCell>
                ))}
              </TableRow>
            </TableHead>
            <TableBody>
              {membros.map((m) => (
                <TableRow key={m.usuarioId} sx={{ "&:hover": { bgcolor: "action.hover" } }}>
                  <TableCell>
                    <Box sx={{ display: "flex", alignItems: "center", gap: 1.5 }}>
                      <UserAvatar nome={m.usuario.nome} fotoUrl={m.usuario.fotoUrl} size={28} />
                      <Typography variant="body2" fontWeight={600}>{m.usuario.nome}</Typography>
                    </Box>
                  </TableCell>
                  <TableCell>
                    <Typography variant="body2" color="text.secondary">{m.usuario.email}</Typography>
                  </TableCell>
                  <TableCell />
                  <TableCell>
                    <Switch
                      size="small"
                      checked={m.notifEmailAtivo}
                      disabled={!isAdmin}
                      onChange={(e) => atualizarNotif({ usuarioId: m.usuarioId, notifEmailAtivo: e.target.checked })}
                    />
                  </TableCell>
                  <TableCell>
                    <Switch
                      size="small"
                      checked={m.notifInAppAtivo}
                      disabled={!isAdmin}
                      onChange={(e) => atualizarNotif({ usuarioId: m.usuarioId, notifInAppAtivo: e.target.checked })}
                    />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </Stack>
  );
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function StatusCursoChip({ status }: { status: string }) {
  const map: Record<string, { label: string; color: string; bg: string }> = {
    ATIVO:     { label: "Ativo",     color: "#10b981", bg: "#f0fdf4" },
    RASCUNHO:  { label: "Rascunho",  color: "#64748b", bg: "#f8fafc" },
    ARQUIVADO: { label: "Arquivado", color: "#94a3b8", bg: "#f1f5f9" },
  };
  const s = map[status] ?? map["RASCUNHO"]!;
  return <Chip label={s.label} size="small" sx={{ bgcolor: s.bg, color: s.color, fontWeight: 600, fontSize: "0.7rem" }} />;
}

function EmptyMC(_: { cursoId: string }) {
  return (
    <Card>
      <CardContent sx={{ p: 6, textAlign: "center" }}>
        <Typography color="text.secondary" sx={{ mb: 2 }}>
          Nenhum Objeto de Aprendizagem importado ainda.
        </Typography>
        <Button
          component={Link}
          to="/cursos/importar"
          variant="contained"
          startIcon={<FileUploadIcon />}
          sx={{ fontWeight: 700 }}
        >
          Importar Matriz de Conteúdo
        </Button>
      </CardContent>
    </Card>
  );
}

// ─── Drawer Atribuição em Massa ───────────────────────────────────────────────

const PAPEIS_ETAPA: { value: PapelEtapa; label: string }[] = [
  { value: "CONTEUDISTA",           label: "Conteudista" },
  { value: "DESIGNER_INSTRUCIONAL", label: "Designer Instrucional" },
  { value: "PROFESSOR_ATOR",        label: "Professor Ator" },
  { value: "PROFESSOR_TECNICO",     label: "Professor Técnico" },
  { value: "ACESSIBILIDADE",        label: "Acessibilidade" },
  { value: "EDITOR_VIDEO",          label: "Editor de Vídeo" },
  { value: "DESIGNER_GRAFICO",      label: "Designer Gráfico" },
  { value: "PRODUTOR_FINAL",        label: "Produtor Final" },
  { value: "VALIDADOR_FINAL",       label: "Validador Final" },
];

function AtribuicaoDrawer({ open, cursoId, membros, unidades, onClose }: {
  open: boolean;
  cursoId: string;
  membros: { usuarioId: string; papel: string; usuario: { id: string; nome: string; email: string; fotoUrl: string | null } }[];
  unidades: { id: string; numero: number; nome: string }[];
  onClose: () => void;
}) {
  const [papelEtapa,    setPapelEtapa]    = useState<PapelEtapa | "">("");
  const [responsavelId, setResponsavelId] = useState("");
  const [sobrescrever,  setSobrescrever]  = useState(false);
  const [unidadesIds,   setUnidadesIds]   = useState<string[]>([]);
  const [snack,         setSnack]         = useState<string | null>(null);

  const previewParams = papelEtapa ? { papelEtapa, sobrescrever, unidadesIds } : null;
  const { data: preview, isFetching: buscandoPreview } = useAtribuicaoPreview(cursoId, previewParams);
  const { mutate: atribuir, isPending: atribuindo }    = useAtribuirResponsaveis(cursoId);

  const colaboradores = membros.filter((m) => m.papel !== "LEITOR");

  const handleUnidadesChange = (values: string[]) => {
    // "__todas__" limpa a seleção (= todas as unidades)
    if (values.includes("__todas__")) { setUnidadesIds([]); return; }
    setUnidadesIds(values);
  };

  const handleConfirmar = () => {
    if (!papelEtapa || !responsavelId) return;
    atribuir(
      { papelEtapa, responsavelId, sobrescrever, unidadesIds },
      {
        onSuccess: (result) => {
          setSnack(`${result.totalAtualizado} etapa(s) atribuída(s) com sucesso.`);
          onClose();
        },
      },
    );
  };

  const handleClose = () => {
    setPapelEtapa("");
    setResponsavelId("");
    setSobrescrever(false);
    setUnidadesIds([]);
    onClose();
  };

  const unidadesLabel = unidadesIds.length === 0
    ? "Todas as unidades"
    : unidades
        .filter((u) => unidadesIds.includes(u.id))
        .map((u) => `U${u.numero}`)
        .join(", ");

  return (
    <>
      <Drawer anchor="right" open={open} onClose={handleClose}
        PaperProps={{ sx: { width: 420, p: 3, display: "flex", flexDirection: "column", gap: 3 } }}>
        <Box>
          <Typography variant="h6" fontWeight={800} sx={{ mb: 0.5 }}>Atribuir Responsáveis</Typography>
          <Typography variant="body2" color="text.secondary">
            Atribua um membro do curso a todas as etapas de um determinado papel.
          </Typography>
        </Box>

        <Divider />

        <FormControl size="small" fullWidth>
          <InputLabel>Papel da Etapa</InputLabel>
          <Select
            value={papelEtapa}
            label="Papel da Etapa"
            onChange={(e) => { setPapelEtapa(e.target.value as PapelEtapa); setResponsavelId(""); }}
          >
            {PAPEIS_ETAPA.map((p) => (
              <MenuItem key={p.value} value={p.value}>{p.label}</MenuItem>
            ))}
          </Select>
        </FormControl>

        {/* Filtro por unidade */}
        {unidades.length > 1 && (
          <FormControl size="small" fullWidth>
            <InputLabel>Unidades</InputLabel>
            <Select
              multiple
              value={unidadesIds}
              label="Unidades"
              onChange={(e) => handleUnidadesChange(e.target.value as string[])}
              renderValue={() => unidadesLabel}
            >
              <MenuItem value="__todas__">
                <Checkbox checked={unidadesIds.length === 0} size="small" />
                <ListItemText primary="Todas as unidades" />
              </MenuItem>
              <Divider />
              {unidades.map((u) => (
                <MenuItem key={u.id} value={u.id}>
                  <Checkbox checked={unidadesIds.includes(u.id)} size="small" />
                  <ListItemText primary={`U${u.numero} — ${u.nome}`} />
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        )}

        <FormControl size="small" fullWidth disabled={!papelEtapa}>
          <InputLabel>Responsável</InputLabel>
          <Select
            value={responsavelId}
            label="Responsável"
            onChange={(e) => setResponsavelId(e.target.value)}
          >
            {colaboradores.length === 0 && (
              <MenuItem value="" disabled>Nenhum colaborador no curso</MenuItem>
            )}
            {colaboradores.map((m) => (
              <MenuItem key={m.usuarioId} value={m.usuarioId}>
                {m.usuario.nome} — {m.usuario.email}
              </MenuItem>
            ))}
          </Select>
        </FormControl>

        <FormControlLabel
          control={<Switch checked={sobrescrever} onChange={(e) => setSobrescrever(e.target.checked)} size="small" />}
          label={<Typography variant="body2">Sobrescrever atribuições existentes</Typography>}
        />

        {papelEtapa && (
          <Card variant="outlined" sx={{ bgcolor: "#f8fafc" }}>
            <CardContent sx={{ p: 2, pb: "8px !important" }}>
              {buscandoPreview ? (
                <Typography variant="body2" color="text.secondary">Calculando...</Typography>
              ) : (
                <>
                  <Typography variant="h5" fontWeight={900} color="primary.main">{preview?.totalEtapas ?? 0}</Typography>
                  <Typography variant="caption" color="text.secondary">
                    etapa(s) serão atribuídas a {responsavelId
                      ? colaboradores.find((m) => m.usuarioId === responsavelId)?.usuario.nome ?? "..."
                      : "..."}
                    {unidadesIds.length > 0 && ` (${unidadesLabel})`}
                  </Typography>
                </>
              )}
            </CardContent>
          </Card>
        )}

        <Box sx={{ flex: 1 }} />

        <Box sx={{ display: "flex", gap: 1.5 }}>
          <Button fullWidth onClick={handleClose}>Cancelar</Button>
          <Button
            fullWidth variant="contained"
            disabled={!papelEtapa || !responsavelId || atribuindo || (preview?.totalEtapas ?? 0) === 0}
            onClick={handleConfirmar}
            sx={{ fontWeight: 700 }}
          >
            {atribuindo ? "Atribuindo..." : `Atribuir ${preview?.totalEtapas ?? ""}`}
          </Button>
        </Box>
      </Drawer>

      <Snackbar
        open={!!snack} autoHideDuration={4000} onClose={() => setSnack(null)}
        message={snack} anchorOrigin={{ vertical: "bottom", horizontal: "center" }}
      />
    </>
  );
}

function LoadingSkeleton() {
  return (
    <Box>
      <Skeleton height={40} sx={{ mb: 1 }} />
      <Skeleton height={100} sx={{ mb: 2 }} />
      <Skeleton height={400} />
    </Box>
  );
}

// ─── Drawer: Histórico de versões da MI (RF-M2-05) ───────────────────────────

const TIPO_ICON: Record<string, string> = {
  CAPITULO_ADICIONADO: "➕",
  CAPITULO_REMOVIDO:   "➖",
  CAPITULO_MODIFICADO: "✏️",
};

function MIHistoricoDrawer({
  open, cursoId, isAdmin, onClose,
}: { open: boolean; cursoId: string; isAdmin: boolean; onClose: () => void }) {
  const { data: versoes = [], isLoading } = useMIHistorico(cursoId);
  const { mutate: restaurar, isPending: restaurando } = useRestaurarMI(cursoId);
  const [confirmId,   setConfirmId]   = useState<string | null>(null);
  const [expandedId,  setExpandedId]  = useState<string | null>(null);
  const [snack, setSnack] = useState<string | null>(null);

  const handleRestaurar = (versaoId: string) => {
    restaurar(versaoId, {
      onSuccess: (r) => { setSnack(r.message); setConfirmId(null); },
      onError: () => setSnack("Erro ao restaurar versão."),
    });
  };

  return (
    <Drawer anchor="right" open={open} onClose={onClose}
      PaperProps={{ sx: { width: { xs: "100%", sm: 500 }, display: "flex", flexDirection: "column" } }}>
      <Box sx={{ p: 3, borderBottom: "1px solid", borderColor: "divider", display: "flex", alignItems: "center", gap: 1.5 }}>
        <HistoryIcon sx={{ color: "text.secondary" }} />
        <Typography fontWeight={700} fontSize="1rem">Histórico de versões da MI</Typography>
      </Box>

      <Box sx={{ flex: 1, overflowY: "auto", p: 2 }}>
        {isLoading ? (
          <Box sx={{ p: 3 }}><CircularProgress size={24} /></Box>
        ) : versoes.length === 0 ? (
          <Typography color="text.secondary" sx={{ p: 2 }}>Nenhuma versão registrada ainda.</Typography>
        ) : (
          <List disablePadding>
            {versoes.map((v: MIHistoricoResumo, idx) => {
              const temAlteracoes = v.alteracoes && v.alteracoes.length > 0;
              const expandido = expandedId === v.id;
              return (
                <ListItem key={v.id} disablePadding
                  sx={{ mb: 1.5, borderRadius: 2, border: "1px solid", borderColor: "divider",
                        flexDirection: "column", alignItems: "flex-start", p: 2 }}>
                  <Box sx={{ display: "flex", alignItems: "center", gap: 1.5, width: "100%", mb: 0.5 }}>
                    <Avatar src={v.importadoPor.fotoUrl ?? undefined} sx={{ width: 28, height: 28, fontSize: "0.75rem" }}>
                      {v.importadoPor.nome[0]?.toUpperCase()}
                    </Avatar>
                    <Box sx={{ flex: 1 }}>
                      <Typography variant="body2" fontWeight={600}>{v.importadoPor.nome}</Typography>
                      <Typography variant="caption" color="text.disabled">
                        {new Date(v.createdAt).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" })}
                      </Typography>
                    </Box>
                    {idx === 0 && (
                      <Chip label="Atual" size="small" sx={{ bgcolor: "#dcfce7", color: "#166534", fontSize: "0.65rem", height: 20 }} />
                    )}
                  </Box>

                  {v.resumo && (
                    <Typography variant="caption" color="text.secondary" sx={{ mb: temAlteracoes ? 0.5 : 1 }}>
                      {v.resumo}
                    </Typography>
                  )}

                  {/* Campos modificados (RF-M2-05) */}
                  {temAlteracoes && (
                    <Box sx={{ width: "100%", mb: 1 }}>
                      <Box
                        sx={{ display: "flex", alignItems: "center", gap: 0.5, cursor: "pointer", mb: expandido ? 0.5 : 0 }}
                        onClick={() => setExpandedId(expandido ? null : v.id)}
                      >
                        <DiffIcon sx={{ fontSize: 14, color: "text.disabled" }} />
                        <Typography variant="caption" color="primary" sx={{ fontWeight: 600 }}>
                          {v.alteracoes!.length} alteração(ões) detectada(s)
                        </Typography>
                        <Typography variant="caption" color="text.disabled" sx={{ ml: "auto" }}>
                          {expandido ? "▲ ocultar" : "▼ ver"}
                        </Typography>
                      </Box>
                      {expandido && (
                        <Box sx={{ pl: 1, borderLeft: "2px solid", borderColor: "divider", display: "flex", flexDirection: "column", gap: 0.25 }}>
                          {v.alteracoes!.map((a, i) => (
                            <Typography key={i} variant="caption" color="text.secondary">
                              {TIPO_ICON[a.tipo] ?? "•"} {a.descricao}
                            </Typography>
                          ))}
                        </Box>
                      )}
                    </Box>
                  )}

                  {isAdmin && idx > 0 && (
                    confirmId === v.id ? (
                      <Box sx={{ display: "flex", gap: 1 }}>
                        <Button size="small" variant="contained" color="warning"
                          disabled={restaurando}
                          startIcon={restaurando ? <CircularProgress size={14} color="inherit" /> : <RestoreIcon />}
                          onClick={() => handleRestaurar(v.id)}>
                          Confirmar restauração
                        </Button>
                        <Button size="small" onClick={() => setConfirmId(null)}>Cancelar</Button>
                      </Box>
                    ) : (
                      <Button size="small" variant="outlined" startIcon={<RestoreIcon />}
                        onClick={() => setConfirmId(v.id)}>
                        Restaurar esta versão
                      </Button>
                    )
                  )}
                </ListItem>
              );
            })}
          </List>
        )}
      </Box>

      <Snackbar
        open={!!snack} autoHideDuration={5000} onClose={() => setSnack(null)}
        message={snack} anchorOrigin={{ vertical: "bottom", horizontal: "center" }}
      />
    </Drawer>
  );
}

// ─── Drawer: Comentários por capítulo da MI (RF-M2-06) ───────────────────────

function ComentarioCard({
  c, userId, cursoId, capituloId, onReply,
}: {
  c: ComentarioMI;
  userId: string | undefined;
  cursoId: string;
  capituloId: string;
  onReply: (c: ComentarioMI) => void;
}) {
  const { mutate: excluir }  = useExcluirComentarioMI(cursoId, capituloId);
  const { mutate: editar, isPending: editando } = useEditarComentarioMI(cursoId, capituloId);
  const [modoEdicao, setModoEdicao] = useState(false);
  const [textoEdicao, setTextoEdicao] = useState(c.texto);
  const isMine = c.autor.id === userId;

  const salvarEdicao = () => {
    const t = textoEdicao.trim();
    if (!t || t === c.texto) { setModoEdicao(false); return; }
    editar({ comentarioId: c.id, texto: t }, { onSuccess: () => setModoEdicao(false) });
  };

  return (
    <Box sx={{ p: 1.5, borderRadius: 2, bgcolor: isMine ? "#eff6ff" : "#f8fafc",
               border: "1px solid", borderColor: isMine ? "#bfdbfe" : "divider" }}>
      <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 0.5 }}>
        <Avatar src={c.autor.fotoUrl ?? undefined} sx={{ width: 24, height: 24, fontSize: "0.7rem" }}>
          {c.autor.nome[0]?.toUpperCase()}
        </Avatar>
        <Typography variant="caption" fontWeight={600}>{c.autor.nome}</Typography>
        {c.editado && (
          <Typography variant="caption" color="text.disabled" sx={{ fontStyle: "italic" }}>(editado)</Typography>
        )}
        <Typography variant="caption" color="text.disabled" sx={{ ml: "auto" }}>
          {new Date(c.createdAt).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" })}
        </Typography>
        <Tooltip title="Responder">
          <IconButton size="small" onClick={() => onReply(c)} sx={{ color: "text.disabled" }}>
            <ReplyIcon sx={{ fontSize: 14 }} />
          </IconButton>
        </Tooltip>
        {isMine && !modoEdicao && (
          <Tooltip title="Editar">
            <IconButton size="small" onClick={() => { setTextoEdicao(c.texto); setModoEdicao(true); }} sx={{ color: "text.disabled" }}>
              <EditIcon sx={{ fontSize: 14 }} />
            </IconButton>
          </Tooltip>
        )}
        {isMine && (
          <Tooltip title="Excluir">
            <IconButton size="small" onClick={() => excluir(c.id)} sx={{ color: "text.disabled" }}>
              <DeleteIcon sx={{ fontSize: 14 }} />
            </IconButton>
          </Tooltip>
        )}
      </Box>

      {modoEdicao ? (
        <Box sx={{ display: "flex", gap: 0.5, alignItems: "flex-end", mt: 0.5 }}>
          <TextField
            multiline maxRows={4} size="small" fullWidth autoFocus
            value={textoEdicao}
            onChange={(e) => setTextoEdicao(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); salvarEdicao(); } }}
          />
          <IconButton size="small" color="primary" disabled={editando} onClick={salvarEdicao}>
            {editando ? <CircularProgress size={14} color="inherit" /> : <CheckIcon sx={{ fontSize: 16 }} />}
          </IconButton>
          <IconButton size="small" onClick={() => setModoEdicao(false)}>
            <CloseIcon sx={{ fontSize: 16 }} />
          </IconButton>
        </Box>
      ) : (
        <Typography variant="body2" sx={{ whiteSpace: "pre-wrap" }}>{c.texto}</Typography>
      )}
    </Box>
  );
}

function ComentariosMIDrawer({
  open, cursoId, capituloId, capituloNome, onClose,
}: { open: boolean; cursoId: string; capituloId: string; capituloNome: string; onClose: () => void }) {
  const user = useAuthStore((s) => s.user);
  const { data: comentarios = [], isLoading } = useComentariosMI(cursoId, capituloId);
  const { mutate: adicionar, isPending: adicionando } = useAdicionarComentarioMI(cursoId, capituloId);
  const [texto,       setTexto]       = useState("");
  const [respondendo, setRespondendo] = useState<ComentarioMI | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleEnviar = () => {
    const t = texto.trim();
    if (!t) return;
    adicionar({ texto: t, parentId: respondendo?.id ?? null }, {
      onSuccess: () => { setTexto(""); setRespondendo(null); },
    });
  };

  return (
    <Drawer anchor="right" open={open} onClose={onClose}
      PaperProps={{ sx: { width: { xs: "100%", sm: 460 }, display: "flex", flexDirection: "column" } }}>
      <Box sx={{ p: 3, borderBottom: "1px solid", borderColor: "divider", display: "flex", alignItems: "center", gap: 1.5 }}>
        <ChatBubbleOutlineIcon sx={{ color: "text.secondary" }} />
        <Box sx={{ flex: 1 }}>
          <Typography fontWeight={700} fontSize="0.95rem">Comentários</Typography>
          <Typography variant="caption" color="text.secondary">{capituloNome}</Typography>
        </Box>
        <IconButton size="small" onClick={onClose}><DeleteOutlineIcon sx={{ fontSize: 18 }} /></IconButton>
      </Box>

      <Box sx={{ flex: 1, overflowY: "auto", p: 2, display: "flex", flexDirection: "column", gap: 1.5 }}>
        {isLoading ? (
          <Box sx={{ display: "flex", justifyContent: "center", p: 3 }}><CircularProgress size={24} /></Box>
        ) : comentarios.length === 0 ? (
          <Typography variant="body2" color="text.secondary" sx={{ textAlign: "center", mt: 4 }}>
            Nenhum comentário ainda. Seja o primeiro!
          </Typography>
        ) : comentarios.map((c) => (
          <Box key={c.id}>
            <ComentarioCard
              c={c} userId={user?.id} cursoId={cursoId} capituloId={capituloId}
              onReply={(r) => { setRespondendo(r); setTimeout(() => inputRef.current?.focus(), 50); }}
            />
            {/* Respostas aninhadas */}
            {c.respostas && c.respostas.length > 0 && (
              <Box sx={{ pl: 3, mt: 0.75, display: "flex", flexDirection: "column", gap: 0.75,
                         borderLeft: "2px solid", borderColor: "divider" }}>
                {c.respostas.map((r) => (
                  <ComentarioCard
                    key={r.id} c={r} userId={user?.id} cursoId={cursoId} capituloId={capituloId}
                    onReply={(rr) => { setRespondendo(rr); setTimeout(() => inputRef.current?.focus(), 50); }}
                  />
                ))}
              </Box>
            )}
          </Box>
        ))}
      </Box>

      <Divider />
      {respondendo && (
        <Box sx={{ px: 2, pt: 1.5, display: "flex", alignItems: "center", gap: 1,
                   bgcolor: "#f0f9ff", borderTop: "1px solid #bae6fd" }}>
          <ReplyIcon sx={{ fontSize: 14, color: "#0284c7" }} />
          <Typography variant="caption" color="#0284c7" sx={{ flex: 1 }}>
            Respondendo a <strong>{respondendo.autor.nome}</strong>
          </Typography>
          <IconButton size="small" onClick={() => setRespondendo(null)}>
            <CloseIcon sx={{ fontSize: 14 }} />
          </IconButton>
        </Box>
      )}
      <Box sx={{ p: 2, display: "flex", gap: 1, alignItems: "flex-end" }}>
        <TextField
          inputRef={inputRef}
          multiline maxRows={4}
          size="small"
          fullWidth
          placeholder={respondendo ? `Responder a ${respondendo.autor.nome}...` : "Escreva um comentário... (@nome para mencionar)"}
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleEnviar(); } }}
        />
        <IconButton
          color="primary" disabled={!texto.trim() || adicionando}
          onClick={handleEnviar}
          sx={{ border: "1px solid", borderColor: "primary.main", borderRadius: 2, p: 1 }}
        >
          {adicionando ? <CircularProgress size={18} color="inherit" /> : <SendIcon fontSize="small" />}
        </IconButton>
      </Box>
    </Drawer>
  );
}
