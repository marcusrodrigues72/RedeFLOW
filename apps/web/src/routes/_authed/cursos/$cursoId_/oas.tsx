import { createFileRoute, Link } from "@tanstack/react-router";
import {
  Box, Typography, Chip, Button, Card, CardContent, TextField, InputAdornment,
  Select, MenuItem, FormControl, Skeleton, Alert, LinearProgress,
  Table, TableHead, TableRow, TableCell, TableBody, Checkbox,
  Tabs, Tab, Tooltip, ToggleButtonGroup, ToggleButton,
  Drawer, IconButton, CircularProgress, Divider, Avatar,
  Dialog, DialogTitle, DialogContent, DialogContentText, DialogActions,
} from "@mui/material";
import ArrowBackIcon            from "@mui/icons-material/ArrowBack";
import SearchIcon               from "@mui/icons-material/Search";
import TableRowsIcon            from "@mui/icons-material/TableRows";
import ViewKanbanIcon           from "@mui/icons-material/ViewKanban";
import ViewTimelineIcon         from "@mui/icons-material/ViewTimeline";
import PeopleAltOutlinedIcon    from "@mui/icons-material/PeopleAltOutlined";
import WarningAmberIcon         from "@mui/icons-material/WarningAmber";
import SettingsIcon             from "@mui/icons-material/Settings";
import CloseIcon         from "@mui/icons-material/Close";
import OpenInNewIcon     from "@mui/icons-material/OpenInNew";
import SendIcon          from "@mui/icons-material/Send";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";
import ExpandMoreIcon    from "@mui/icons-material/ExpandMore";
import CheckCircleOutlineIcon from "@mui/icons-material/CheckCircleOutline";
import HourglassEmptyIcon     from "@mui/icons-material/HourglassEmpty";
import BlockIcon              from "@mui/icons-material/Block";
import ErrorOutlineIcon       from "@mui/icons-material/ErrorOutline";
import TrendingUpIcon         from "@mui/icons-material/TrendingUp";
import AccessTimeIcon         from "@mui/icons-material/AccessTime";
import SchoolIcon             from "@mui/icons-material/School";
import { useState, useCallback, useRef, useEffect } from "react";
import { useOAsByCurso, useCurso, useAtualizarEtapaGeral, useComentariosOA, useAdicionarComentario, useExcluirComentario, useAuditLogOA, useExcluirOA, useExcluirOAsEmMassa } from "@/lib/api/cursos";
import { useAuthStore } from "@/stores/auth.store";
import type { StatusOA, TipoOA, StatusEtapa, CursoDetalhe } from "shared";

export const Route = createFileRoute("/_authed/cursos/$cursoId_/oas")({
  component: OAsPage,
});

const STATUS_CONFIG: Record<StatusOA, { label: string; color: string; bg: string }> = {
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
  ANIMACAO:    { label: "Animação",      color: "#db2777" },
};

const ETAPA_STATUS_COLOR: Record<string, string> = {
  CONCLUIDA:    "#10b981",
  EM_ANDAMENTO: "#f59e0b",
  BLOQUEADA:    "#ef4444",
  PENDENTE:     "#cbd5e1",
};

const ETAPA_STATUS_LABEL: Record<string, string> = {
  CONCLUIDA:    "Concluída",
  EM_ANDAMENTO: "Em andamento",
  BLOQUEADA:    "Bloqueada",
  PENDENTE:     "Pendente",
};

// Mapeamento StatusOA → StatusEtapa para atualização via drag
const OA_TO_ETAPA: Record<StatusOA, StatusEtapa> = {
  PENDENTE:     "PENDENTE",
  EM_ANDAMENTO: "EM_ANDAMENTO",
  BLOQUEADO:    "BLOQUEADA",
  CONCLUIDO:    "CONCLUIDA",
};

type Visao = "lista" | "kanban" | "gantt" | "responsavel";
type FiltroDeadline = "" | "vencido" | "semana" | "mes";

// ─── Painel de KPIs ──────────────────────────────────────────────────────────

type OAParaKPI = { status: StatusOA; progressoPct: number; etapas: { status: StatusEtapa; deadlinePrevisto: string | null }[] };

function minutosParaHoras(min: string | null | undefined): string {
  if (!min) return "—";
  const v = parseFloat(min);
  if (isNaN(v) || v === 0) return "—";
  const h = v / 60;
  return `${Number.isInteger(h) ? h : h.toFixed(1)}h`;
}

function KPICard({
  valor, label, icon, cor, destaque,
}: {
  valor: string | number; label: string; icon: React.ReactNode;
  cor: string; destaque?: boolean;
}) {
  return (
    <Card sx={{
      flex: "1 1 130px", minWidth: 0, borderRadius: 2,
      borderTop: `3px solid ${cor}`,
      boxShadow: destaque ? `0 0 0 1.5px ${cor}40, 0 2px 8px rgba(0,0,0,0.08)` : "0 1px 4px rgba(0,0,0,0.06)",
    }}>
      <CardContent sx={{ p: "12px 16px !important" }}>
        <Box sx={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between" }}>
          <Box>
            <Typography sx={{ fontSize: "1.6rem", fontWeight: 800, lineHeight: 1, color: cor }}>
              {valor}
            </Typography>
            <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600, display: "block", mt: 0.5 }}>
              {label}
            </Typography>
          </Box>
          <Box sx={{ color: cor, opacity: 0.25, mt: 0.25 }}>
            {icon}
          </Box>
        </Box>
      </CardContent>
    </Card>
  );
}

function PainelKPIs({ oas, curso }: { oas: OAParaKPI[]; curso?: CursoDetalhe }) {
  const total       = oas.length;
  const concluidos  = oas.filter((o) => o.status === "CONCLUIDO").length;
  const emAndamento = oas.filter((o) => o.status === "EM_ANDAMENTO").length;
  const bloqueados  = oas.filter((o) => o.status === "BLOQUEADO").length;
  const atrasados   = oas.filter((o) =>
    o.status !== "CONCLUIDO" &&
    o.etapas.some((e) => e.status !== "CONCLUIDA" && e.deadlinePrevisto && new Date(e.deadlinePrevisto) < inicioHoje)
  ).length;
  const progresso   = total > 0 ? Math.round(oas.reduce((s, o) => s + o.progressoPct, 0) / total) : 0;

  // CH somada de todos os capítulos do curso
  const todosCapitulos = curso?.unidades.flatMap((u) => u.capitulos) ?? [];
  const chSincTotal  = todosCapitulos.reduce((s, c) => s + (parseFloat(c.chSincrona  ?? "0") || 0), 0);
  const chAsyncTotal = todosCapitulos.reduce((s, c) => s + (parseFloat(c.chAssincrona ?? "0") || 0), 0);
  const chSincStr  = minutosParaHoras(String(chSincTotal  || ""));
  const chAsyncStr = minutosParaHoras(String(chAsyncTotal || ""));

  if (total === 0) return null;

  return (
    <Box sx={{ display: "flex", gap: 1.5, mb: 3, flexWrap: "wrap" }}>
      <KPICard valor={total}       label="Total de OAs"   icon={<SchoolIcon sx={{ fontSize: 28 }} />}            cor="#475569" />
      <KPICard valor={concluidos}  label="Concluídos"     icon={<CheckCircleOutlineIcon sx={{ fontSize: 28 }} />} cor="#10b981" destaque={concluidos > 0} />
      <KPICard valor={emAndamento} label="Em Andamento"   icon={<TrendingUpIcon sx={{ fontSize: 28 }} />}         cor="#f59e0b" destaque={emAndamento > 0} />
      <KPICard valor={bloqueados}  label="Bloqueados"     icon={<BlockIcon sx={{ fontSize: 28 }} />}              cor="#ef4444" destaque={bloqueados > 0} />
      <KPICard valor={atrasados}   label="Atrasados"      icon={<ErrorOutlineIcon sx={{ fontSize: 28 }} />}       cor={atrasados > 0 ? "#ef4444" : "#94a3b8"} destaque={atrasados > 0} />
      <Card sx={{ flex: "1 1 160px", minWidth: 0, borderRadius: 2, borderTop: "3px solid #2b7cee", boxShadow: "0 1px 4px rgba(0,0,0,0.06)" }}>
        <CardContent sx={{ p: "12px 16px !important" }}>
          <Box sx={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between" }}>
            <Box sx={{ flex: 1 }}>
              <Typography sx={{ fontSize: "1.6rem", fontWeight: 800, lineHeight: 1, color: "#2b7cee" }}>
                {progresso}%
              </Typography>
              <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600, display: "block", mt: 0.5 }}>
                Progresso Geral
              </Typography>
              <LinearProgress
                variant="determinate" value={progresso}
                sx={{ mt: 1, height: 4, borderRadius: 2, bgcolor: "#e2e8f0", "& .MuiLinearProgress-bar": { bgcolor: "#2b7cee" } }}
              />
            </Box>
            <Box sx={{ color: "#2b7cee", opacity: 0.25, mt: 0.25, ml: 1 }}>
              <HourglassEmptyIcon sx={{ fontSize: 28 }} />
            </Box>
          </Box>
        </CardContent>
      </Card>
      <KPICard valor={chSincStr}  label="CH Síncrona"   icon={<AccessTimeIcon sx={{ fontSize: 28 }} />} cor="#7c3aed" />
      <KPICard valor={chAsyncStr} label="CH Assíncrona" icon={<AccessTimeIcon sx={{ fontSize: 28 }} />} cor="#0891b2" />
    </Box>
  );
}

// ── helpers de intervalo ──────────────────────────────────────────────────────
const inicioHoje = (() => { const d = new Date(); d.setHours(0,0,0,0); return d; })();
const fimSemana  = (() => { const d = new Date(inicioHoje); d.setDate(d.getDate() + 7);  return d; })();
const fimMes     = (() => { const d = new Date(inicioHoje); d.setDate(d.getDate() + 30); return d; })();

function deadlineEfetivo(oa: { deadlineFinal?: string | null; etapas: { status: string; deadlinePrevisto?: string | null }[] }): Date | null {
  // Usa o deadline da etapa ativa, ou o deadlineFinal do OA
  const etapaAtiva = oa.etapas.find((e) => e.status !== "CONCLUIDA");
  const iso = etapaAtiva?.deadlinePrevisto ?? oa.deadlineFinal;
  if (!iso) return null;
  const d = new Date(iso);
  d.setHours(0, 0, 0, 0);
  return d;
}

function matchDeadline(oa: Parameters<typeof deadlineEfetivo>[0], filtro: FiltroDeadline): boolean {
  if (!filtro) return true;
  if (oa.etapas.every((e) => e.status === "CONCLUIDA")) return false; // concluídos ignorados
  const dl = deadlineEfetivo(oa);
  if (!dl) return false;
  if (filtro === "vencido") return dl < inicioHoje;
  if (filtro === "semana")  return dl >= inicioHoje && dl < fimSemana;
  if (filtro === "mes")     return dl >= inicioHoje && dl < fimMes;
  return true;
}

function OAsPage() {
  const { cursoId }                               = Route.useParams();
  const { data: curso }                           = useCurso(cursoId);
  const [search,              setSearch]          = useState("");
  const [filtroStatus,        setFiltroStatus]    = useState("");
  const [filtroTipo,          setFiltroTipo]      = useState("");
  const [filtroUnidade,       setFiltroUnidade]   = useState("");
  const [filtroCapitulo,      setFiltroCapitulo]  = useState("");
  const [filtroDeadline,      setFiltroDeadline]  = useState<FiltroDeadline>("");
  const [filtroResponsavel,   setFiltroResponsavel] = useState("");
  const [filtroStatusEtapa,   setFiltroStatusEtapa] = useState("");
  const [visao,               setVisao]           = useState<Visao>("lista");
  const [agrupamentoLista,    setAgrupamentoLista] = useState<"capitulo" | "responsavel">("capitulo");
  const [selectedOaId,        setSelectedOaId]    = useState<string | null>(null);
  const [oaParaExcluir,       setOaParaExcluir]   = useState<{ id: string; codigo: string } | null>(null);
  const [selectedIds,         setSelectedIds]      = useState<Set<string>>(new Set());
  const [confirmarMassa,      setConfirmarMassa]   = useState(false);
  const { mutate: atualizarEtapa }                = useAtualizarEtapaGeral();
  const { mutate: excluirOA, isPending: excluindo } = useExcluirOA(cursoId);
  const { mutate: excluirEmMassa, isPending: excluindoMassa } = useExcluirOAsEmMassa(cursoId);
  const user                                      = useAuthStore((s) => s.user);
  const isAdmin = user?.papelGlobal === "ADMIN" ||
    curso?.membros.some((m) => m.usuarioId === user?.id && m.papel === "ADMIN");

  const handleToggleSelect = useCallback((id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }, []);

  const handleSelectAll = useCallback((ids: string[], checked: boolean) => {
    setSelectedIds(checked ? new Set(ids) : new Set());
  }, []);

  const { data: oas = [], isLoading, isError } = useOAsByCurso(cursoId, {
    status: filtroStatus || undefined,
    tipo:   filtroTipo   || undefined,
  });

  const unidades = Array.from(
    new Map(oas.map((oa) => [oa.capitulo.unidade.numero, oa.capitulo.unidade])).values()
  ).sort((a, b) => a.numero - b.numero);

  // Capítulos da unidade selecionada
  const capitulos = Array.from(
    new Map(
      oas
        .filter((oa) => !filtroUnidade || String(oa.capitulo.unidade.numero) === filtroUnidade)
        .map((oa) => [`${oa.capitulo.unidade.numero}:${oa.capitulo.numero}`, oa.capitulo])
    ).values()
  ).sort((a, b) => a.numero - b.numero);

  // Responsáveis únicos com etapas neste curso
  const responsaveis = Array.from(
    new Map(
      oas.flatMap((oa) =>
        oa.etapas
          .filter((e) => e.responsavel)
          .map((e) => [e.responsavel!.id, e.responsavel!])
      )
    ).values()
  ).sort((a, b) => a.nome.localeCompare(b.nome));

  const oasFiltrados = oas.filter((oa) => {
    const q = search.toLowerCase();
    if (search && !oa.codigo.toLowerCase().includes(q) && !(oa.titulo ?? "").toLowerCase().includes(q)) return false;
    if (filtroUnidade  && String(oa.capitulo.unidade.numero) !== filtroUnidade) return false;
    if (filtroCapitulo && `${oa.capitulo.unidade.numero}:${oa.capitulo.numero}` !== filtroCapitulo) return false;
    if (filtroResponsavel && !oa.etapas.some((e) => e.responsavel?.id === filtroResponsavel || e.responsavelSecundario?.id === filtroResponsavel)) return false;
    if (filtroStatusEtapa && !oa.etapas.some((e) => e.status === filtroStatusEtapa)) return false;
    if (!matchDeadline(oa, filtroDeadline)) return false;
    return true;
  });

  const grupos = oasFiltrados.reduce<Record<string, typeof oasFiltrados>>((acc, oa) => {
    const key = `U${oa.capitulo.unidade.numero} — ${oa.capitulo.unidade.nome} / C${oa.capitulo.numero} — ${oa.capitulo.nome}`;
    acc[key] = acc[key] ?? [];
    acc[key]!.push(oa);
    return acc;
  }, {});

  // Agrupamento por responsável para a ListaView
  const gruposResponsavel = oasFiltrados.reduce<Record<string, typeof oasFiltrados>>((acc, oa) => {
    const etapaAtiva = oa.etapas.find((e) => e.status !== "CONCLUIDA" && e.responsavel);
    const nome = etapaAtiva?.responsavel?.nome ?? "Não atribuído";
    acc[nome] = acc[nome] ?? [];
    acc[nome]!.push(oa);
    return acc;
  }, {});
  // Ordena: nomes alfabéticos, "Não atribuído" por último
  const gruposResponsavelOrdenado = Object.fromEntries(
    Object.entries(gruposResponsavel).sort(([a], [b]) => {
      if (a === "Não atribuído") return 1;
      if (b === "Não atribuído") return -1;
      return a.localeCompare(b);
    })
  );

  const handleStatusChange = useCallback((oa: (typeof oas)[0], novoStatus: StatusOA) => {
    const etapaAtual = oa.etapas.find((e) => e.status !== "CONCLUIDA");
    if (!etapaAtual) return;
    atualizarEtapa({ oaId: oa.id, etapaId: etapaAtual.id, data: { status: OA_TO_ETAPA[novoStatus] } });
  }, [atualizarEtapa]);

  return (
    <Box>
      {/* ── Header ── */}
      <Box sx={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", mb: 2 }}>
        <Box sx={{ display: "flex", alignItems: "center", gap: 2 }}>
          <Button component={Link} to={`/cursos/${cursoId}`} startIcon={<ArrowBackIcon />} sx={{ color: "text.secondary" }}>
            {curso?.nome ?? "Curso"}
          </Button>
          <Box>
            <Typography sx={{ fontSize: "1.375rem", fontWeight: 800 }}>Objetos de Aprendizagem</Typography>
            <Typography variant="caption" color="text.disabled">
              {oas.length} OA{oas.length !== 1 ? "s" : ""} no total
            </Typography>
          </Box>
        </Box>
        {isAdmin && (
          <Button
            component={Link} to={`/cursos/${cursoId}/setup-producao`}
            variant="outlined" size="small"
            startIcon={<SettingsIcon sx={{ fontSize: 16 }} />}
            sx={{ fontWeight: 700, fontSize: "0.75rem" }}
          >
            Setup de Produção
          </Button>
        )}
      </Box>

      {/* ── Painel de KPIs ── */}
      {!isLoading && <PainelKPIs oas={oas} curso={curso ?? undefined} />}

      {/* ── Abas de visão ── */}
      <Box sx={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", borderBottom: "1px solid", borderColor: "divider", mb: 2.5 }}>
        <Tabs
          value={visao}
          onChange={(_, v) => { setVisao(v as Visao); setSelectedIds(new Set()); }}
          sx={{ "& .MuiTabs-root": { borderBottom: "none" } }}
        >
          <Tab value="lista"       label="Lista"         icon={<TableRowsIcon sx={{ fontSize: 18 }} />}           iconPosition="start" sx={{ minHeight: 40, fontWeight: 600 }} />
          <Tab value="kanban"      label="Kanban"        icon={<ViewKanbanIcon sx={{ fontSize: 18 }} />}          iconPosition="start" sx={{ minHeight: 40, fontWeight: 600 }} />
          <Tab value="gantt"       label="Gantt"         icon={<ViewTimelineIcon sx={{ fontSize: 18 }} />}        iconPosition="start" sx={{ minHeight: 40, fontWeight: 600 }} />
          <Tab value="responsavel" label="Por responsável" icon={<PeopleAltOutlinedIcon sx={{ fontSize: 18 }} />} iconPosition="start" sx={{ minHeight: 40, fontWeight: 600 }} />
        </Tabs>

        {/* Toggle de agrupamento — só visível na visão Lista */}
        {visao === "lista" && (
          <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 0.5 }}>
            <Typography variant="caption" color="text.disabled" fontWeight={600}>Agrupar por:</Typography>
            <ToggleButtonGroup
              value={agrupamentoLista}
              exclusive
              size="small"
              onChange={(_, v) => { if (v) setAgrupamentoLista(v); }}
            >
              <ToggleButton value="capitulo" sx={{ fontSize: "0.7rem", px: 1.5, py: 0.4, fontWeight: 600 }}>
                Capítulo
              </ToggleButton>
              <ToggleButton value="responsavel" sx={{ fontSize: "0.7rem", px: 1.5, py: 0.4, fontWeight: 600 }}>
                Responsável
              </ToggleButton>
            </ToggleButtonGroup>
          </Box>
        )}
      </Box>

      {/* ── Filtros ── */}
      <Box sx={{ display: "flex", gap: 2, mb: 3, flexWrap: "wrap", alignItems: "center" }}>
        {/* Busca: código ou título */}
        <TextField
          placeholder="Buscar código ou título..." size="small" value={search}
          onChange={(e) => setSearch(e.target.value)} sx={{ minWidth: 230 }}
          slotProps={{ input: { startAdornment: <InputAdornment position="start"><SearchIcon sx={{ fontSize: 18, color: "text.disabled" }} /></InputAdornment> } }}
        />

        {/* Status do OA */}
        <FormControl size="small" sx={{ minWidth: 150 }}>
          <Select value={filtroStatus} onChange={(e) => setFiltroStatus(e.target.value)} displayEmpty>
            <MenuItem value="">Todos os status</MenuItem>
            {(Object.keys(STATUS_CONFIG) as StatusOA[]).map((s) => (
              <MenuItem key={s} value={s}>{STATUS_CONFIG[s].label}</MenuItem>
            ))}
          </Select>
        </FormControl>

        {/* Tipo */}
        <FormControl size="small" sx={{ minWidth: 150 }}>
          <Select value={filtroTipo} onChange={(e) => setFiltroTipo(e.target.value)} displayEmpty>
            <MenuItem value="">Todos os tipos</MenuItem>
            {(Object.keys(TIPO_CONFIG) as TipoOA[]).map((t) => (
              <MenuItem key={t} value={t}>{TIPO_CONFIG[t].label}</MenuItem>
            ))}
          </Select>
        </FormControl>

        {/* Unidade */}
        <FormControl size="small" sx={{ minWidth: 170 }}>
          <Select value={filtroUnidade} onChange={(e) => { setFiltroUnidade(e.target.value); setFiltroCapitulo(""); }} displayEmpty>
            <MenuItem value="">Todas as unidades</MenuItem>
            {unidades.map((u) => (
              <MenuItem key={u.numero} value={String(u.numero)}>U{u.numero} — {u.nome}</MenuItem>
            ))}
          </Select>
        </FormControl>

        {/* Capítulo — dependente da unidade */}
        {capitulos.length > 0 && (
          <FormControl size="small" sx={{ minWidth: 180 }}>
            <Select value={filtroCapitulo} onChange={(e) => setFiltroCapitulo(e.target.value)} displayEmpty>
              <MenuItem value="">Todos os capítulos</MenuItem>
              {capitulos.map((c) => (
                <MenuItem key={c.id} value={`${c.unidade.numero}:${c.numero}`}>
                  C{c.numero} — {c.nome}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        )}

        {/* Responsável */}
        {responsaveis.length > 0 && (
          <FormControl size="small" sx={{ minWidth: 170 }}>
            <Select value={filtroResponsavel} onChange={(e) => setFiltroResponsavel(e.target.value)} displayEmpty>
              <MenuItem value="">Todos responsáveis</MenuItem>
              {responsaveis.map((r) => (
                <MenuItem key={r.id} value={r.id}>{r.nome}</MenuItem>
              ))}
            </Select>
          </FormControl>
        )}

        {/* Status de etapa */}
        <FormControl size="small" sx={{ minWidth: 170 }}>
          <Select value={filtroStatusEtapa} onChange={(e) => setFiltroStatusEtapa(e.target.value)} displayEmpty>
            <MenuItem value="">Status de etapa</MenuItem>
            {(Object.keys(ETAPA_STATUS_LABEL) as StatusEtapa[]).map((s) => (
              <MenuItem key={s} value={s}>{ETAPA_STATUS_LABEL[s]}</MenuItem>
            ))}
          </Select>
        </FormControl>

        {/* Deadline */}
        <FormControl size="small" sx={{ minWidth: 160 }}>
          <Select
            value={filtroDeadline}
            onChange={(e) => setFiltroDeadline(e.target.value as FiltroDeadline)}
            displayEmpty
            sx={filtroDeadline === "vencido" ? { color: "#ef4444", fontWeight: 700 } : {}}
          >
            <MenuItem value="">Todos os prazos</MenuItem>
            <MenuItem value="vencido" sx={{ color: "#ef4444", fontWeight: 600 }}>⚠ Vencido</MenuItem>
            <MenuItem value="semana">Vence esta semana</MenuItem>
            <MenuItem value="mes">Vence este mês</MenuItem>
          </Select>
        </FormControl>

        {/* Limpar filtros */}
        {(search || filtroStatus || filtroTipo || filtroUnidade || filtroCapitulo || filtroResponsavel || filtroStatusEtapa || filtroDeadline) && (
          <Button size="small" variant="text" sx={{ color: "text.disabled", fontWeight: 600 }}
            onClick={() => { setSearch(""); setFiltroStatus(""); setFiltroTipo(""); setFiltroUnidade(""); setFiltroCapitulo(""); setFiltroResponsavel(""); setFiltroStatusEtapa(""); setFiltroDeadline(""); }}>
            Limpar filtros
          </Button>
        )}
      </Box>

      {/* ── Conteúdo ── */}
      {isLoading ? (
        [1, 2, 3].map((i) => <Skeleton key={i} height={60} sx={{ mb: 1, borderRadius: 2 }} />)
      ) : isError ? (
        <Alert severity="error">Erro ao carregar OAs.</Alert>
      ) : oasFiltrados.length === 0 ? (
        <Card>
          <CardContent sx={{ p: 6, textAlign: "center" }}>
            <Typography color="text.secondary">Nenhum OA encontrado.</Typography>
            <Typography variant="body2" color="text.disabled" sx={{ mt: 1 }}>
              Importe a Matriz Instrucional para gerar os OAs automaticamente.
            </Typography>
          </CardContent>
        </Card>
      ) : visao === "lista" ? (
        <ListaView
          grupos={agrupamentoLista === "responsavel" ? gruposResponsavelOrdenado : grupos}
          onStatusChange={handleStatusChange}
          onSelect={setSelectedOaId}
          isAdmin={!!isAdmin}
          onDelete={setOaParaExcluir}
          selectedIds={selectedIds}
          onToggleSelect={handleToggleSelect}
          onSelectAll={handleSelectAll}
          agrupamento={agrupamentoLista}
        />
      ) : visao === "kanban" ? (
        <KanbanView oas={oasFiltrados} onSelect={setSelectedOaId} />
      ) : visao === "gantt" ? (
        <GanttView oas={oasFiltrados} onSelect={setSelectedOaId} />
      ) : (
        <ResponsavelView oas={oasFiltrados} onSelect={setSelectedOaId} />
      )}

      {/* ── Dialog de confirmação de exclusão individual ── */}
      <Dialog open={!!oaParaExcluir} onClose={() => setOaParaExcluir(null)}>
        <DialogTitle>Excluir OA</DialogTitle>
        <DialogContent>
          <DialogContentText>
            Tem certeza que deseja excluir o OA <strong>{oaParaExcluir?.codigo}</strong>? Esta ação é irreversível e removerá todas as etapas, arquivos e comentários associados.
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOaParaExcluir(null)} disabled={excluindo}>Cancelar</Button>
          <Button
            color="error" variant="contained" disabled={excluindo}
            onClick={() => {
              if (!oaParaExcluir) return;
              excluirOA(oaParaExcluir.id, { onSuccess: () => setOaParaExcluir(null) });
            }}
          >
            {excluindo ? "Excluindo..." : "Excluir"}
          </Button>
        </DialogActions>
      </Dialog>

      {/* ── Dialog de confirmação de exclusão em massa ── */}
      <Dialog open={confirmarMassa} onClose={() => !excluindoMassa && setConfirmarMassa(false)}>
        <DialogTitle>Excluir {selectedIds.size} OA{selectedIds.size > 1 ? "s" : ""}</DialogTitle>
        <DialogContent>
          <DialogContentText>
            Tem certeza que deseja excluir <strong>{selectedIds.size} OA{selectedIds.size > 1 ? "s" : ""}</strong>?
            Esta ação é irreversível e removerá todas as etapas, arquivos e comentários associados a cada OA.
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setConfirmarMassa(false)} disabled={excluindoMassa}>Cancelar</Button>
          <Button
            color="error" variant="contained" disabled={excluindoMassa}
            onClick={() => {
              excluirEmMassa([...selectedIds], {
                onSuccess: () => { setSelectedIds(new Set()); setConfirmarMassa(false); },
              });
            }}
          >
            {excluindoMassa ? "Excluindo..." : `Excluir ${selectedIds.size} OA${selectedIds.size > 1 ? "s" : ""}`}
          </Button>
        </DialogActions>
      </Dialog>

      {/* ── Barra flutuante de seleção ── */}
      {selectedIds.size > 0 && isAdmin && (
        <Box sx={{
          position: "fixed", bottom: 28, left: "50%", transform: "translateX(-50%)",
          bgcolor: "grey.900", color: "white",
          px: 3, py: 1.5, borderRadius: 3,
          display: "flex", alignItems: "center", gap: 2,
          boxShadow: "0 4px 24px rgba(0,0,0,0.3)",
          zIndex: 1200, whiteSpace: "nowrap",
        }}>
          <Typography fontWeight={600} sx={{ fontSize: "0.875rem" }}>
            {selectedIds.size} OA{selectedIds.size > 1 ? "s" : ""} selecionado{selectedIds.size > 1 ? "s" : ""}
          </Typography>
          <Button
            variant="contained" color="error" size="small"
            startIcon={<DeleteOutlineIcon sx={{ fontSize: 16 }} />}
            onClick={() => setConfirmarMassa(true)}
            sx={{ fontWeight: 700, fontSize: "0.75rem" }}
          >
            Excluir selecionados
          </Button>
          <IconButton size="small" onClick={() => setSelectedIds(new Set())} sx={{ color: "rgba(255,255,255,0.7)", "&:hover": { color: "white" } }}>
            <CloseIcon sx={{ fontSize: 18 }} />
          </IconButton>
        </Box>
      )}

      {/* ── Drawer de detalhes do OA ── */}
      {selectedOaId && (() => {
        const selectedOa = oas.find((o) => o.id === selectedOaId) ?? null;
        if (!selectedOa) return null;
        return (
          <OADrawer
            oa={selectedOa}
            membros={curso?.membros ?? []}
            onClose={() => setSelectedOaId(null)}
          />
        );
      })()}
    </Box>
  );
}

// ─── Helpers de data ──────────────────────────────────────────────────────────

const hoje = new Date();
hoje.setHours(0, 0, 0, 0);

function fmtData(iso: string | null | undefined): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "2-digit" });
}

function isAtrasado(iso: string | null | undefined, concluida = false): boolean {
  if (!iso || concluida) return false;
  const d = new Date(iso);
  d.setHours(0, 0, 0, 0);
  return d < hoje;
}

function DataCell({ iso, concluida = false }: { iso: string | null | undefined; concluida?: boolean }) {
  const atrasado = isAtrasado(iso, concluida);
  return (
    <Typography variant="caption" sx={{ color: atrasado ? "#ef4444" : iso ? "text.secondary" : "text.disabled", fontWeight: atrasado ? 700 : 400 }}>
      {fmtData(iso)}
    </Typography>
  );
}

// ─── Visão Lista ──────────────────────────────────────────────────────────────

function ListaView({
  grupos,
  onStatusChange,
  onSelect,
  isAdmin,
  onDelete,
  selectedIds,
  onToggleSelect,
  onSelectAll,
  agrupamento = "capitulo",
}: {
  grupos: Record<string, ReturnType<typeof useOAsByCurso>["data"]>;
  onStatusChange: (oa: any, status: StatusOA) => void;
  onSelect: (oaId: string) => void;
  isAdmin: boolean;
  onDelete: (oa: { id: string; codigo: string }) => void;
  selectedIds: Set<string>;
  onToggleSelect: (id: string) => void;
  onSelectAll: (ids: string[], checked: boolean) => void;
  agrupamento?: "capitulo" | "responsavel";
}) {
  const [expandidos, setExpandidos] = useState<Set<string>>(new Set());
  function toggleGrupoLista(key: string) {
    setExpandidos((prev) => { const next = new Set(prev); if (next.has(key)) next.delete(key); else next.add(key); return next; });
  }

  return (
    <>
      {Object.entries(grupos).map(([grupo, items]) => {
        const grupoIds = items!.map((oa) => oa.id);
        const todosGrupoSelecionados = grupoIds.length > 0 && grupoIds.every((id) => selectedIds.has(id));
        const algunsGrupoSelecionados = grupoIds.some((id) => selectedIds.has(id)) && !todosGrupoSelecionados;
        const expandido = expandidos.has(grupo);
        return (
        <Box key={grupo} sx={{ mb: expandido ? 3 : 1 }}>
          <Box
            onClick={() => toggleGrupoLista(grupo)}
            sx={{ display: "flex", alignItems: "center", gap: 0.5, mb: expandido ? 1 : 0,
              cursor: "pointer", userSelect: "none",
              "&:hover .grupo-label": { color: "text.secondary" },
            }}
          >
            <ExpandMoreIcon
              sx={{ fontSize: "1rem", color: "text.disabled", transition: "transform 0.2s",
                transform: expandido ? "rotate(180deg)" : "rotate(0deg)" }}
            />
            <Typography className="grupo-label" variant="caption"
              sx={{ fontWeight: 700, color: "text.disabled", letterSpacing: "0.06em", transition: "color 0.15s" }}>
              {grupo.toUpperCase()}
            </Typography>
            <Typography variant="caption" sx={{ color: "text.disabled", fontWeight: 400, ml: 0.5 }}>
              ({grupoIds.length})
            </Typography>
          </Box>
          {expandido && <Card>
            <CardContent sx={{ p: 0, pb: "0 !important" }}>
              <Table size="small">
                <TableHead>
                  <TableRow sx={{ bgcolor: "#f8fafc" }}>
                    {isAdmin && (
                      <TableCell padding="checkbox" sx={{ pl: 1 }}>
                        <Checkbox
                          size="small"
                          checked={todosGrupoSelecionados}
                          indeterminate={algunsGrupoSelecionados}
                          onChange={(e) => onSelectAll(grupoIds, e.target.checked)}
                        />
                      </TableCell>
                    )}
                    {["Código", "Tipo", ...(agrupamento === "responsavel" ? ["Capítulo"] : []), "Progresso", "Status", "Etapa Atual", "Responsável", "DL Etapa", "DL Final", ""].map((h) => (
                      <TableCell key={h} sx={{ fontWeight: 700, fontSize: "0.75rem", color: "text.secondary", py: 1.5, whiteSpace: "nowrap" }}>{h}</TableCell>
                    ))}
                  </TableRow>
                </TableHead>
                <TableBody>
                  {items!.map((oa) => {
                    const etapaAtual = oa.etapas.find((e) => e.status === "EM_ANDAMENTO" || e.status === "PENDENTE");
                    const concluida  = oa.status === "CONCLUIDO";
                    const tc = TIPO_CONFIG[oa.tipo];
                    const isSelected = selectedIds.has(oa.id);
                    return (
                      <TableRow
                        key={oa.id}
                        selected={isSelected}
                        sx={{ "&:hover": { bgcolor: "action.hover" }, ...(isSelected && { bgcolor: "primary.50" }) }}
                      >
                        {isAdmin && (
                          <TableCell padding="checkbox" sx={{ pl: 1 }}>
                            <Checkbox
                              size="small"
                              checked={isSelected}
                              onChange={() => onToggleSelect(oa.id)}
                            />
                          </TableCell>
                        )}
                        <TableCell sx={{ py: 1.5, fontFamily: "monospace", fontWeight: 600, fontSize: "0.8rem" }}>
                          {oa.codigo}
                        </TableCell>
                        <TableCell>
                          <Chip label={tc.label} size="small"
                            sx={{ bgcolor: `${tc.color}18`, color: tc.color, fontWeight: 600, fontSize: "0.7rem" }} />
                        </TableCell>
                        {agrupamento === "responsavel" && (
                          <TableCell sx={{ fontSize: "0.75rem", color: "text.secondary", whiteSpace: "nowrap" }}>
                            U{oa.capitulo.unidade.numero}/C{oa.capitulo.numero} — {oa.capitulo.nome}
                          </TableCell>
                        )}
                        <TableCell sx={{ width: 120 }}>
                          <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                            <LinearProgress variant="determinate" value={oa.progressoPct}
                              sx={{ flex: 1, height: 5, borderRadius: 3 }} />
                            <Typography variant="caption" sx={{ minWidth: 28 }}>{oa.progressoPct}%</Typography>
                          </Box>
                        </TableCell>
                        <TableCell sx={{ minWidth: 140 }}>
                          <Select
                            size="small" value={oa.status}
                            onChange={(e) => onStatusChange(oa, e.target.value as StatusOA)}
                            sx={{ fontSize: "0.75rem", height: 28,
                              bgcolor: STATUS_CONFIG[oa.status].bg,
                              color:   STATUS_CONFIG[oa.status].color,
                              "& .MuiOutlinedInput-notchedOutline": { border: "none" },
                            }}
                          >
                            {(Object.keys(STATUS_CONFIG) as StatusOA[]).map((s) => (
                              <MenuItem key={s} value={s} sx={{ fontSize: "0.75rem" }}>
                                {STATUS_CONFIG[s].label}
                              </MenuItem>
                            ))}
                          </Select>
                        </TableCell>
                        <TableCell>
                          <Typography variant="caption" color="text.secondary" noWrap>
                            {etapaAtual?.etapaDef.nome ?? "—"}
                          </Typography>
                        </TableCell>
                        <TableCell>
                          <Typography variant="caption" color={etapaAtual?.responsavel ? "text.primary" : "text.disabled"} noWrap>
                            {etapaAtual?.responsavel?.nome ?? "Não atribuído"}
                          </Typography>
                        </TableCell>
                        <TableCell>
                          <DataCell iso={etapaAtual?.deadlinePrevisto} concluida={concluida} />
                        </TableCell>
                        <TableCell>
                          <DataCell iso={oa.deadlineFinal} concluida={concluida} />
                        </TableCell>
                        <TableCell align="right">
                          <Box sx={{ display: "flex", gap: 0.5, justifyContent: "flex-end", alignItems: "center" }}>
                            <Button size="small" variant="outlined"
                              onClick={() => onSelect(oa.id)}
                              sx={{ fontSize: "0.7rem", py: 0.25 }}>
                              Detalhes
                            </Button>
                            {isAdmin && (
                              <Tooltip title="Excluir OA">
                                <IconButton size="small" color="error"
                                  onClick={() => onDelete({ id: oa.id, codigo: oa.codigo })}>
                                  <DeleteOutlineIcon sx={{ fontSize: 16 }} />
                                </IconButton>
                              </Tooltip>
                            )}
                          </Box>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </CardContent>
          </Card>}
        </Box>
        );
      })}
    </>
  );
}

// ─── Visão Kanban ─────────────────────────────────────────────────────────────

const KANBAN_COLS: { status: StatusOA; label: string; color: string; bg: string }[] = [
  { status: "PENDENTE",     label: "Pendente",     color: "#64748b", bg: "#f8fafc" },
  { status: "EM_ANDAMENTO", label: "Em Andamento", color: "#f59e0b", bg: "#fffbeb" },
  { status: "BLOQUEADO",    label: "Bloqueado",    color: "#ef4444", bg: "#fff5f5" },
  { status: "CONCLUIDO",    label: "Concluído",    color: "#10b981", bg: "#f0fdf4" },
];

function effectiveStatus(oa: NonNullable<ReturnType<typeof useOAsByCurso>["data"]>[0]): StatusOA {
  if (oa.etapas.length === 0) return "PENDENTE";
  if (oa.etapas.every((e) => e.status === "CONCLUIDA")) return "CONCLUIDO";
  if (oa.etapas.some((e) => e.status === "BLOQUEADA"))  return "BLOQUEADO";
  if (oa.etapas.some((e) => e.status === "EM_ANDAMENTO")) return "EM_ANDAMENTO";
  return "PENDENTE";
}

type OAKanban = NonNullable<ReturnType<typeof useOAsByCurso>["data"]>[0];

function KanbanView({ oas, onSelect }: { oas: OAKanban[]; onSelect: (oaId: string) => void }) {
  const { mutate: atualizarEtapa } = useAtualizarEtapaGeral();
  const [overCol,    setOverCol]    = useState<StatusOA | null>(null);
  // mapa oaId → status otimista; limpo após refetch ou revertido em erro
  const [optimistic, setOptimistic] = useState<Record<string, StatusOA>>({});

  const resolvedStatus = (oa: OAKanban): StatusOA =>
    optimistic[oa.id] ?? effectiveStatus(oa);

  const handleDrop = (targetStatus: StatusOA, oaId: string) => {
    const oa = oas.find((o) => o.id === oaId);
    if (!oa) return;
    const anterior = resolvedStatus(oa);
    if (anterior === targetStatus) return;

    const etapaAtual = oa.etapas.find((e) => e.status !== "CONCLUIDA");
    if (!etapaAtual) return;

    // Move o card imediatamente na UI
    setOptimistic((p) => ({ ...p, [oaId]: targetStatus }));

    atualizarEtapa(
      { oaId: oa.id, etapaId: etapaAtual.id, data: { status: OA_TO_ETAPA[targetStatus] } },
      {
        // Após refetch os dados reais chegam; limpa o override otimista
        onSuccess: () => setOptimistic((p) => { const n = { ...p }; delete n[oaId]; return n; }),
        // Em caso de falha, reverte para o status anterior
        onError:   () => setOptimistic((p) => ({ ...p, [oaId]: anterior })),
      },
    );
  };

  return (
    <Box sx={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 2, alignItems: "start" }}>
      {KANBAN_COLS.map((col) => {
        const colOAs = oas.filter((oa) => resolvedStatus(oa) === col.status);
        const isOver = overCol === col.status;
        return (
          <Box
            key={col.status}
            onDragOver={(e) => { e.preventDefault(); e.dataTransfer.dropEffect = "move"; setOverCol(col.status); }}
            onDragLeave={(e) => {
              if (!e.currentTarget.contains(e.relatedTarget as Node)) setOverCol(null);
            }}
            onDrop={(e) => {
              e.preventDefault();
              setOverCol(null);
              handleDrop(col.status, e.dataTransfer.getData("text/plain"));
            }}
            sx={{
              borderRadius: 3, border: "2px dashed",
              borderColor: isOver ? col.color : "transparent",
              transition: "border-color 0.15s",
              bgcolor: isOver ? `${col.color}08` : "transparent",
            }}
          >
            <Box sx={{ display: "flex", alignItems: "center", gap: 1, px: 1, py: 1.5 }}>
              <Box sx={{ width: 8, height: 8, borderRadius: "50%", bgcolor: col.color }} />
              <Typography variant="caption" sx={{ fontWeight: 700, color: "text.secondary", letterSpacing: "0.05em" }}>
                {col.label.toUpperCase()}
              </Typography>
              <Chip label={colOAs.length} size="small"
                sx={{ height: 18, fontSize: "0.65rem", bgcolor: col.bg, color: col.color, ml: "auto" }} />
            </Box>

            <Box sx={{ display: "flex", flexDirection: "column", gap: 1.5, px: 0.5 }}>
              {colOAs.map((oa) => {
                const tc = TIPO_CONFIG[oa.tipo];
                const etapaAtual = oa.etapas.find((e) => e.status !== "CONCLUIDA");
                return (
                  <Card
                    key={oa.id}
                    draggable
                    onDragStart={(e) => {
                      e.dataTransfer.setData("text/plain", oa.id);
                      e.dataTransfer.effectAllowed = "move";
                    }}
                    onDragOver={(e) => e.preventDefault()}
                    sx={{
                      cursor: "grab", borderRadius: 2,
                      boxShadow: "0 1px 4px rgba(0,0,0,0.08)",
                      "&:active": { cursor: "grabbing" },
                      "&:hover": { boxShadow: "0 4px 12px rgba(0,0,0,0.12)" },
                      transition: "box-shadow 0.15s",
                      borderLeft: `3px solid ${col.color}`,
                    }}
                  >
                    <CardContent sx={{ p: 1.5, pb: "12px !important" }}>
                      <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", mb: 0.75 }}>
                        <Typography sx={{ fontFamily: "monospace", fontWeight: 700, fontSize: "0.8rem" }}>
                          {oa.codigo}
                        </Typography>
                        <Chip label={tc.label} size="small"
                          sx={{ height: 16, fontSize: "0.6rem", bgcolor: `${tc.color}18`, color: tc.color }} />
                      </Box>
                      {etapaAtual && (
                        <Typography variant="caption" color="text.secondary" sx={{ display: "block", mb: 0.75 }}>
                          {etapaAtual.etapaDef.nome}
                          {etapaAtual.responsavel && ` · ${etapaAtual.responsavel.nome}`}
                        </Typography>
                      )}
                      <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                        <LinearProgress variant="determinate" value={oa.progressoPct}
                          sx={{ flex: 1, height: 4, borderRadius: 2,
                            "& .MuiLinearProgress-bar": { bgcolor: col.color } }} />
                        <Typography variant="caption" sx={{ fontSize: "0.65rem", color: "text.disabled", minWidth: 24 }}>
                          {oa.progressoPct}%
                        </Typography>
                      </Box>
                      <Box sx={{ display: "flex", justifyContent: "flex-end", mt: 0.75 }}>
                        <Button size="small" onClick={() => onSelect(oa.id)}
                          sx={{ fontSize: "0.65rem", py: 0, px: 1, minWidth: 0 }}>
                          Abrir
                        </Button>
                      </Box>
                    </CardContent>
                  </Card>
                );
              })}

              {colOAs.length === 0 && (
                <Box sx={{ py: 3, textAlign: "center" }}>
                  <Typography variant="caption" color="text.disabled">Nenhum OA</Typography>
                </Box>
              )}
            </Box>
          </Box>
        );
      })}
    </Box>
  );
}

// ─── Visão Gantt ──────────────────────────────────────────────────────────────

type OAItem = NonNullable<ReturnType<typeof useOAsByCurso>["data"]>[0];

function GanttView({ oas, onSelect }: { oas: OAItem[]; onSelect: (oaId: string) => void }) {
  const [zoom, setZoom]       = useState<"mes" | "semana">("mes");
  // "colapsados" em vez de "expandidos": padrão = todos expandidos (Set vazio)
  const [colapsados, setColapsados] = useState<Set<string>>(new Set());
  const scrollRef = useRef<HTMLDivElement>(null);

  const PX_PER_DAY = zoom === "semana" ? 16 : 4;
  const LABEL_W    = 220;
  const ROW_H      = 42;
  const GROUP_H    = 34;
  const HEADER_H   = 36;

  // ── Coleta todas as datas ─────────────────────────────────────────────────
  const allTs: number[] = [];
  for (const oa of oas) {
    for (const e of oa.etapas) {
      if (e.deadlinePrevisto) allTs.push(new Date(e.deadlinePrevisto).getTime());
    }
    if (oa.deadlineFinal) allTs.push(new Date(oa.deadlineFinal).getTime());
  }

  if (allTs.length === 0) {
    return (
      <Card>
        <CardContent sx={{ p: 6, textAlign: "center" }}>
          <Typography color="text.secondary">Nenhum deadline cadastrado para exibir o Gantt.</Typography>
          <Typography variant="body2" color="text.disabled" sx={{ mt: 1 }}>
            Configure deadlines nas etapas dos OAs para visualizar o cronograma.
          </Typography>
        </CardContent>
      </Card>
    );
  }

  // ── Range com margem ──────────────────────────────────────────────────────
  const rangeStart = new Date(Math.min(...allTs));
  rangeStart.setDate(rangeStart.getDate() - 7);
  rangeStart.setHours(0, 0, 0, 0);

  const rangeEnd = new Date(Math.max(...allTs));
  rangeEnd.setDate(rangeEnd.getDate() + 14);
  rangeEnd.setHours(23, 59, 59, 999);

  const toPx = (d: Date) =>
    Math.round(((d.getTime() - rangeStart.getTime()) / 86_400_000) * PX_PER_DAY);

  const totalChartW = Math.ceil(
    ((rangeEnd.getTime() - rangeStart.getTime()) / 86_400_000) * PX_PER_DAY
  );
  const todayPx = toPx(hoje);

  // ── Cabeçalho de meses ───────────────────────────────────────────────────
  const months: { label: string; leftPx: number; widthPx: number }[] = [];
  const mCur = new Date(rangeStart.getFullYear(), rangeStart.getMonth(), 1);
  while (mCur <= rangeEnd) {
    const mStart   = new Date(Math.max(mCur.getTime(), rangeStart.getTime()));
    const mEndRaw  = new Date(mCur.getFullYear(), mCur.getMonth() + 1, 0, 23, 59, 59);
    const mEnd     = new Date(Math.min(mEndRaw.getTime(), rangeEnd.getTime()));
    months.push({
      label:   mCur.toLocaleDateString("pt-BR", { month: "short", year: "2-digit" }),
      leftPx:  toPx(mStart),
      widthPx: toPx(mEnd) - toPx(mStart),
    });
    mCur.setMonth(mCur.getMonth() + 1);
  }

  // ── Linhas de grade ───────────────────────────────────────────────────────
  const gridPxs: number[] = [];
  if (zoom === "semana") {
    const d = new Date(rangeStart);
    d.setDate(d.getDate() + ((8 - d.getDay()) % 7 || 7));
    while (d <= rangeEnd) { gridPxs.push(toPx(d)); d.setDate(d.getDate() + 7); }
  } else {
    months.forEach((m) => gridPxs.push(m.leftPx));
  }

  // ── Agrupamento por capítulo ──────────────────────────────────────────────
  const grupos = oas.reduce<Record<string, OAItem[]>>((acc, oa) => {
    const key = `U${oa.capitulo.unidade.numero} — ${oa.capitulo.unidade.nome} / C${oa.capitulo.numero} — ${oa.capitulo.nome}`;
    (acc[key] = acc[key] ?? []).push(oa);
    return acc;
  }, {});

  const allExpanded = colapsados.size === 0;
  const toggleGrupo = (key: string) =>
    setColapsados((prev) => { const n = new Set(prev); n.has(key) ? n.delete(key) : n.add(key); return n; });

  // ── Auto-scroll para hoje ─────────────────────────────────────────────────
  useEffect(() => {
    if (!scrollRef.current) return;
    const target = todayPx - scrollRef.current.clientWidth / 2 + LABEL_W / 2;
    scrollRef.current.scrollLeft = Math.max(0, target);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [zoom]);

  // ── Linha de hoje (reutilizada em cada row) ───────────────────────────────
  const TodayLine = () =>
    todayPx >= 0 && todayPx <= totalChartW ? (
      <Box sx={{
        position: "absolute", left: todayPx, top: 0, bottom: 0,
        width: 2, bgcolor: "#ef4444", opacity: 0.65, zIndex: 3, pointerEvents: "none",
      }} />
    ) : null;

  const GridLines = () => (
    <>
      {gridPxs.map((px, i) => (
        <Box key={i} sx={{
          position: "absolute", left: px, top: 0, bottom: 0,
          width: 1, bgcolor: "divider", opacity: 0.45, pointerEvents: "none",
        }} />
      ))}
    </>
  );

  return (
    <Box>
      {/* ── Controles ── */}
      <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mb: 1.5 }}>
        <Button size="small" variant="outlined"
          onClick={() => allExpanded
            ? setColapsados(new Set(Object.keys(grupos)))
            : setColapsados(new Set())}
          sx={{ fontSize: "0.72rem", py: 0.5 }}>
          {allExpanded ? "Recolher todos" : "Expandir todos"}
        </Button>
        <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
          <Typography variant="caption" color="text.secondary">Escala:</Typography>
          <ToggleButtonGroup value={zoom} exclusive size="small"
            onChange={(_, v) => { if (v) setZoom(v); }}>
            <ToggleButton value="mes"    sx={{ fontSize: "0.72rem", px: 1.5, py: 0.5 }}>Mês</ToggleButton>
            <ToggleButton value="semana" sx={{ fontSize: "0.72rem", px: 1.5, py: 0.5 }}>Semana</ToggleButton>
          </ToggleButtonGroup>
        </Box>
      </Box>

      <Card sx={{ overflow: "hidden", border: "1px solid", borderColor: "divider" }}>
        {/* Scroll container */}
        <Box ref={scrollRef} sx={{ overflowX: "auto" }}>
          <Box sx={{ minWidth: LABEL_W + totalChartW }}>

            {/* ── Cabeçalho de meses ── */}
            <Box sx={{ display: "flex", height: HEADER_H, borderBottom: "1px solid", borderColor: "divider", bgcolor: "#f8fafc" }}>
              {/* Célula de label (sticky) */}
              <Box sx={{
                width: LABEL_W, flexShrink: 0, position: "sticky", left: 0, zIndex: 10,
                bgcolor: "#f8fafc", borderRight: "1px solid", borderColor: "divider",
                display: "flex", alignItems: "center", px: 2,
              }}>
                <Typography variant="caption" fontWeight={700} color="text.secondary">OA</Typography>
              </Box>
              {/* Área de meses */}
              <Box sx={{ width: totalChartW, flexShrink: 0, position: "relative" }}>
                {months.map((m) => (
                  <Box key={m.label} sx={{
                    position: "absolute", left: m.leftPx, width: Math.max(m.widthPx, 0),
                    height: "100%", display: "flex", alignItems: "center",
                    borderRight: "1px dashed", borderColor: "divider", pl: 1,
                  }}>
                    <Typography variant="caption" fontWeight={700} color="text.secondary" noWrap
                      sx={{ fontSize: "0.68rem", textTransform: "capitalize" }}>
                      {m.label}
                    </Typography>
                  </Box>
                ))}
                {/* Indicador de hoje no cabeçalho */}
                {todayPx >= 0 && todayPx <= totalChartW && (
                  <Box sx={{ position: "absolute", left: todayPx, top: 0, bottom: 0, width: 2, bgcolor: "#ef4444", opacity: 0.7, zIndex: 4 }}>
                    <Typography sx={{ position: "absolute", top: 1, left: "50%", transform: "translateX(-50%)", fontSize: "0.5rem", color: "#ef4444", lineHeight: 1 }}>▼</Typography>
                  </Box>
                )}
              </Box>
            </Box>

            {/* ── Grupos ── */}
            {Object.entries(grupos).map(([grupo, items]) => {
              const expandido = !colapsados.has(grupo);

              // Barra de resumo do grupo
              const grupoTs = items.flatMap((oa) => [
                ...oa.etapas.filter((e) => e.deadlinePrevisto).map((e) => new Date(e.deadlinePrevisto!).getTime()),
                ...(oa.deadlineFinal ? [new Date(oa.deadlineFinal).getTime()] : []),
              ]);
              const grupoStartPx = grupoTs.length > 0 ? toPx(new Date(Math.min(...grupoTs))) : null;
              const grupoEndPx   = grupoTs.length > 0 ? toPx(new Date(Math.max(...grupoTs))) : null;
              const grupoW       = grupoStartPx !== null && grupoEndPx !== null ? Math.max(grupoEndPx - grupoStartPx, 2) : 0;

              return (
                <Box key={grupo}>
                  {/* Cabeçalho do grupo */}
                  <Box sx={{ display: "flex", height: GROUP_H, borderBottom: "1px solid", borderColor: "divider", cursor: "pointer" }}
                    onClick={() => toggleGrupo(grupo)}>
                    {/* Label (sticky) */}
                    <Box sx={{
                      width: LABEL_W, flexShrink: 0, position: "sticky", left: 0, zIndex: 5,
                      bgcolor: "#f8fafc", borderRight: "1px solid", borderColor: "divider",
                      display: "flex", alignItems: "center", gap: 0.5, px: 1.5,
                      "&:hover": { bgcolor: "#f1f5f9" },
                    }}>
                      <ExpandMoreIcon sx={{
                        fontSize: "0.9rem", color: "text.disabled", flexShrink: 0,
                        transition: "transform 0.2s", transform: expandido ? "rotate(180deg)" : "rotate(0deg)",
                      }} />
                      <Typography variant="caption" fontWeight={700} color="text.disabled" noWrap
                        sx={{ fontSize: "0.63rem", letterSpacing: "0.05em" }}>
                        {grupo.toUpperCase()}
                      </Typography>
                    </Box>
                    {/* Área de gráfico */}
                    <Box sx={{ width: totalChartW, flexShrink: 0, position: "relative", bgcolor: "#f8fafc", "&:hover": { bgcolor: "#f1f5f9" } }}>
                      <GridLines />
                      <TodayLine />
                      {/* Barra de span do grupo */}
                      {grupoStartPx !== null && grupoW > 0 && (
                        <Box sx={{
                          position: "absolute", left: grupoStartPx, width: grupoW,
                          top: "50%", transform: "translateY(-50%)",
                          height: 8, borderRadius: 4, bgcolor: "#cbd5e1", opacity: 0.8,
                        }} />
                      )}
                    </Box>
                  </Box>

                  {/* Linhas de OA */}
                  {expandido && items.map((oa) => {
                    const etapasComDL = oa.etapas
                      .filter((e) => e.deadlinePrevisto)
                      .sort((a, b) => a.ordem - b.ordem);
                    const sc = STATUS_CONFIG[oa.status];
                    const tc = TIPO_CONFIG[oa.tipo];

                    const barStartD = etapasComDL[0]?.deadlinePrevisto
                      ? new Date(etapasComDL[0].deadlinePrevisto)
                      : oa.deadlineFinal ? new Date(oa.deadlineFinal) : null;
                    const barEndD = oa.deadlineFinal
                      ? new Date(oa.deadlineFinal)
                      : etapasComDL.length > 0
                        ? new Date(etapasComDL[etapasComDL.length - 1]!.deadlinePrevisto!)
                        : null;
                    const barLeftPx  = barStartD ? toPx(barStartD) : null;
                    const barRightPx = barEndD   ? toPx(barEndD)   : null;
                    const barWidthPx = barLeftPx !== null && barRightPx !== null
                      ? Math.max(2, barRightPx - barLeftPx) : 0;

                    const etapaAtiva = oa.etapas.find((e) => e.status === "EM_ANDAMENTO")
                      ?? oa.etapas.find((e) => e.status === "PENDENTE");
                    const resp = etapaAtiva?.responsavel;

                    return (
                      <Box key={oa.id} sx={{ display: "flex", height: ROW_H, borderBottom: "1px solid", borderColor: "divider", "&:hover": { bgcolor: "action.hover" } }}>
                        {/* Label (sticky) */}
                        <Box
                          onClick={() => onSelect(oa.id)}
                          sx={{
                            width: LABEL_W, flexShrink: 0, position: "sticky", left: 0, zIndex: 5,
                            bgcolor: "background.paper", borderRight: "1px solid", borderColor: "divider",
                            display: "flex", alignItems: "center", gap: 1, px: 1.5,
                            cursor: "pointer", "&:hover": { bgcolor: "#f0f7ff" },
                          }}>
                          <Typography sx={{ fontFamily: "monospace", fontWeight: 700, fontSize: "0.72rem", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                            {oa.codigo}
                          </Typography>
                          <Chip label={tc.label} size="small"
                            sx={{ height: 16, fontSize: "0.58rem", flexShrink: 0, bgcolor: `${tc.color}18`, color: tc.color }} />
                        </Box>

                        {/* Área do gráfico */}
                        <Box sx={{ width: totalChartW, flexShrink: 0, position: "relative" }}>
                          <GridLines />
                          <TodayLine />

                          {/* Barra do OA */}
                          {barLeftPx !== null && barWidthPx > 0 && (
                            <Tooltip placement="top" arrow
                              title={
                                <Box sx={{ py: 0.25 }}>
                                  <Typography sx={{ fontSize: "0.78rem", fontWeight: 700, color: "#1e293b" }}>{oa.codigo}</Typography>
                                  {oa.titulo && <Typography sx={{ fontSize: "0.7rem", color: "#475569" }} noWrap>{oa.titulo}</Typography>}
                                  <Typography sx={{ fontSize: "0.72rem", color: "#64748b", mt: 0.5 }}>Progresso: {oa.progressoPct}%</Typography>
                                  {barEndD && <Typography sx={{ fontSize: "0.72rem", color: "#64748b" }}>Entrega: {fmtData(barEndD.toISOString())}</Typography>}
                                  {etapaAtiva && <Typography sx={{ fontSize: "0.72rem", color: "#64748b" }}>Etapa: {etapaAtiva.etapaDef.nome}{resp ? ` (${resp.nome})` : ""}</Typography>}
                                </Box>
                              }
                              componentsProps={{
                                tooltip: { sx: { bgcolor: "white", color: "#1e293b", border: "1px solid #e2e8f0", boxShadow: "0 4px 12px rgba(0,0,0,0.12)", borderRadius: 1.5, px: 1.5, py: 1, maxWidth: 260 } },
                                arrow:   { sx: { color: "white", "&::before": { border: "1px solid #e2e8f0" } } },
                              }}
                            >
                              <Box
                                onClick={() => onSelect(oa.id)}
                                sx={{
                                  position: "absolute", left: barLeftPx, width: barWidthPx,
                                  top: "50%", transform: "translateY(-50%)",
                                  height: 20, borderRadius: 1.5,
                                  bgcolor: sc.bg, border: `1.5px solid ${sc.color}55`,
                                  overflow: "hidden", cursor: "pointer", zIndex: 2,
                                  transition: "border-color 0.15s, box-shadow 0.15s",
                                  "&:hover": { borderColor: sc.color, boxShadow: `0 2px 8px ${sc.color}40` },
                                }}>
                                {/* Progresso fill */}
                                <Box sx={{
                                  position: "absolute", left: 0, top: 0, bottom: 0,
                                  width: `${oa.progressoPct}%`, bgcolor: sc.color, opacity: 0.5,
                                  transition: "width 0.3s",
                                }} />
                                {/* % dentro da barra (se couber) */}
                                {barWidthPx > 42 && (
                                  <Box sx={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", px: 0.75 }}>
                                    <Typography sx={{ fontSize: "0.6rem", fontWeight: 800, color: sc.color, whiteSpace: "nowrap", zIndex: 1, textShadow: "0 0 4px #fff" }}>
                                      {oa.progressoPct}%
                                    </Typography>
                                  </Box>
                                )}
                              </Box>
                            </Tooltip>
                          )}

                          {/* Marcadores de etapa */}
                          {etapasComDL.map((e) => {
                            const xPx   = toPx(new Date(e.deadlinePrevisto!));
                            const color = ETAPA_STATUS_COLOR[e.status] ?? "#94a3b8";
                            const atras = e.status !== "CONCLUIDA" && new Date(e.deadlinePrevisto!) < hoje;
                            return (
                              <Tooltip key={e.id} placement="top" arrow
                                title={
                                  <Box sx={{ py: 0.25 }}>
                                    <Typography sx={{ fontSize: "0.78rem", fontWeight: 700, color: "#1e293b", lineHeight: 1.4 }}>
                                      {e.etapaDef.nome}
                                    </Typography>
                                    <Box sx={{ display: "flex", alignItems: "center", gap: 0.75, mt: 0.5 }}>
                                      <Box sx={{ width: 8, height: 8, borderRadius: "50%", bgcolor: color, flexShrink: 0 }} />
                                      <Typography sx={{ fontSize: "0.72rem", color: "#475569" }}>{ETAPA_STATUS_LABEL[e.status]}</Typography>
                                    </Box>
                                    <Typography sx={{ fontSize: "0.72rem", color: "#64748b", mt: 0.25 }}>Deadline: {fmtData(e.deadlinePrevisto)}</Typography>
                                    {e.responsavel && <Typography sx={{ fontSize: "0.72rem", color: "#64748b" }}>{e.responsavel.nome}</Typography>}
                                    {atras && <Typography sx={{ fontSize: "0.72rem", color: "#ef4444", fontWeight: 600, mt: 0.25 }}>⚠ Atrasado</Typography>}
                                  </Box>
                                }
                                componentsProps={{
                                  tooltip: { sx: { bgcolor: "white", color: "#1e293b", border: "1px solid #e2e8f0", boxShadow: "0 4px 12px rgba(0,0,0,0.12)", borderRadius: 1.5, px: 1.5, py: 1, maxWidth: 220 } },
                                  arrow:   { sx: { color: "white", "&::before": { border: "1px solid #e2e8f0" } } },
                                }}
                              >
                                <Box sx={{
                                  position: "absolute", left: xPx, top: "50%",
                                  transform: "translate(-50%, -50%)",
                                  width: 11, height: 11, borderRadius: "50%",
                                  bgcolor: color,
                                  border: `2px solid ${atras ? "#ef4444" : "white"}`,
                                  boxShadow: "0 1px 4px rgba(0,0,0,0.3)",
                                  zIndex: 4, cursor: "default",
                                }} />
                              </Tooltip>
                            );
                          })}

                          {/* Avatar do responsável atual (à direita da barra) */}
                          {resp && barRightPx !== null && barWidthPx > 0 && (
                            <Tooltip title={`${etapaAtiva?.etapaDef.nome}: ${resp.nome}`} placement="top" arrow>
                              <Avatar sx={{
                                position: "absolute", left: barRightPx + 5, top: "50%", transform: "translateY(-50%)",
                                width: 20, height: 20, fontSize: "0.58rem", fontWeight: 700,
                                bgcolor: "#e0e7ff", color: "#4338ca", zIndex: 4, cursor: "default",
                              }}>
                                {resp.nome.charAt(0).toUpperCase()}
                              </Avatar>
                            </Tooltip>
                          )}

                          {/* OA sem datas */}
                          {barLeftPx === null && (
                            <Box sx={{ position: "absolute", left: 8, top: "50%", transform: "translateY(-50%)" }}>
                              <Typography variant="caption" color="text.disabled" sx={{ fontSize: "0.63rem" }}>Sem deadline</Typography>
                            </Box>
                          )}
                        </Box>
                      </Box>
                    );
                  })}
                </Box>
              );
            })}
          </Box>
        </Box>

        {/* ── Legenda ── */}
        <Box sx={{
          px: 2.5, py: 1.5, borderTop: "1px solid", borderColor: "divider",
          display: "flex", gap: 3, flexWrap: "wrap", alignItems: "center", bgcolor: "#fafafa",
        }}>
          <Typography variant="caption" color="text.disabled" fontWeight={700} sx={{ mr: 0.5 }}>Marcadores de etapa:</Typography>
          {Object.entries(ETAPA_STATUS_COLOR).map(([status, color]) => (
            <Box key={status} sx={{ display: "flex", alignItems: "center", gap: 0.75 }}>
              <Box sx={{ width: 10, height: 10, borderRadius: "50%", bgcolor: color, border: "2px solid white", boxShadow: "0 1px 3px rgba(0,0,0,0.2)" }} />
              <Typography variant="caption" color="text.secondary">{ETAPA_STATUS_LABEL[status]}</Typography>
            </Box>
          ))}
          <Box sx={{ display: "flex", alignItems: "center", gap: 0.75, ml: "auto" }}>
            <Box sx={{ width: 2, height: 14, bgcolor: "#ef4444", opacity: 0.7, borderRadius: 1 }} />
            <Typography variant="caption" color="text.secondary">Hoje</Typography>
          </Box>
        </Box>
      </Card>
    </Box>
  );
}

// ─── Visão Por Responsável ────────────────────────────────────────────────────

type OAResp   = NonNullable<ReturnType<typeof useOAsByCurso>["data"]>[0];
type EtapaItem = OAResp["etapas"][0];

interface GrupoItem {
  oa:           OAResp;
  etapa:        EtapaItem;   // etapa relevante para este responsável
  isSecundario: boolean;
}

interface GrupoResponsavel {
  id:                  string;
  nome:                string;
  fotoUrl:             string | null;
  items:               GrupoItem[];
  deadlineMaisProximo: Date | null;
  atrasados:           number;
}

function iniciais(nome: string): string {
  return nome.split(" ").slice(0, 2).map((p) => p[0]?.toUpperCase() ?? "").join("");
}

const ETAPA_STATUS_BADGE: Record<string, { label: string; color: string; bg: string }> = {
  EM_ANDAMENTO: { label: "Em andamento", color: "#f59e0b", bg: "#fffbeb" },
  PENDENTE:     { label: "Pendente",     color: "#64748b", bg: "#f8fafc" },
  BLOQUEADA:    { label: "Bloqueado",    color: "#ef4444", bg: "#fff5f5" },
  CONCLUIDA:    { label: "Concluída",    color: "#10b981", bg: "#f0fdf4" },
};

function ResponsavelView({ oas, onSelect }: { oas: OAResp[]; onSelect: (id: string) => void }) {
  const [expandidos, setExpandidos] = useState<Set<string>>(new Set());

  function toggleGrupo(id: string) {
    setExpandidos((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  const gruposMap = new Map<string, GrupoResponsavel>();

  function ensureGrupo(id: string, nome: string, fotoUrl: string | null): GrupoResponsavel {
    if (!gruposMap.has(id)) gruposMap.set(id, { id, nome, fotoUrl, items: [], deadlineMaisProximo: null, atrasados: 0 });
    return gruposMap.get(id)!;
  }

  function addItem(grupo: GrupoResponsavel, oa: OAResp, etapa: EtapaItem, isSecundario: boolean) {
    // Um OA aparece no máximo 1× por grupo (a primeira etapa relevante para esse responsável)
    if (grupo.items.some((i) => i.oa.id === oa.id)) return;
    grupo.items.push({ oa, etapa, isSecundario });
    if (oa.status !== "CONCLUIDO" && etapa.deadlinePrevisto) {
      const dl = new Date(etapa.deadlinePrevisto);
      dl.setHours(0, 0, 0, 0);
      if (!grupo.deadlineMaisProximo || dl < grupo.deadlineMaisProximo) grupo.deadlineMaisProximo = dl;
      if (dl < inicioHoje && etapa.status !== "CONCLUIDA") grupo.atrasados++;
    }
  }

  for (const oa of oas) {
    // Todas as etapas não concluídas, em ordem
    const etapasAtivas = oa.etapas.filter((e) => e.status !== "CONCLUIDA");

    // Mapeia responsável → primeira etapa relevante para ele
    const visto = new Map<string, { etapa: EtapaItem; isSecundario: boolean }>();
    for (const etapa of etapasAtivas) {
      if (etapa.responsavel && !visto.has(etapa.responsavel.id)) {
        visto.set(etapa.responsavel.id, { etapa, isSecundario: false });
      }
      if (etapa.responsavelSecundario && !visto.has(etapa.responsavelSecundario.id)) {
        visto.set(etapa.responsavelSecundario.id, { etapa, isSecundario: true });
      }
    }

    if (visto.size === 0) {
      // Nenhum responsável em qualquer etapa ativa → "Não atribuído"
      const etapa = etapasAtivas[0];
      if (etapa) addItem(ensureGrupo("unassigned", "Não atribuído", null), oa, etapa, false);
    } else {
      for (const [respId, { etapa, isSecundario }] of visto) {
        const resp = etapa.responsavel?.id === respId ? etapa.responsavel : etapa.responsavelSecundario;
        if (resp) addItem(ensureGrupo(resp.id, resp.nome, resp.fotoUrl), oa, etapa, isSecundario);
      }
    }
  }

  // Ordena: atribuídos por nome, "Não atribuído" por último
  const grupos = Array.from(gruposMap.values()).sort((a, b) => {
    if (a.id === "unassigned") return 1;
    if (b.id === "unassigned") return -1;
    return a.nome.localeCompare(b.nome);
  });

  if (grupos.length === 0) {
    return (
      <Card><CardContent sx={{ p: 6, textAlign: "center" }}>
        <Typography color="text.secondary">Nenhum OA encontrado.</Typography>
      </CardContent></Card>
    );
  }

  return (
    <Box sx={{ display: "flex", flexDirection: "column", gap: 3 }}>
      {grupos.map((grupo) => {
        const dlStr      = grupo.deadlineMaisProximo?.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "2-digit" }) ?? null;
        const dlAtrasado = grupo.deadlineMaisProximo ? grupo.deadlineMaisProximo < inicioHoje : false;

        // Breakdown por status da etapa relevante
        const byEtapaStatus = grupo.items.reduce<Record<string, number>>(
          (acc, { etapa }) => { acc[etapa.status] = (acc[etapa.status] ?? 0) + 1; return acc; },
          {},
        );

        const expandido = expandidos.has(grupo.id);

        return (
          <Box key={grupo.id}>
            {/* ── Cabeçalho do grupo (clicável) ── */}
            <Card
              onClick={() => toggleGrupo(grupo.id)}
              sx={{ mb: expandido ? 1.5 : 0, borderRadius: 2, boxShadow: "0 1px 4px rgba(0,0,0,0.06)", cursor: "pointer",
                "&:hover": { boxShadow: "0 2px 8px rgba(0,0,0,0.10)" }, transition: "box-shadow 0.15s" }}
            >
              <CardContent sx={{ p: "12px 16px !important" }}>
                <Box sx={{ display: "flex", alignItems: "center", gap: 2, flexWrap: "wrap" }}>
                  <Avatar
                    src={grupo.fotoUrl ?? undefined}
                    sx={{ width: 44, height: 44, fontWeight: 700, fontSize: "1rem",
                      bgcolor: grupo.id === "unassigned" ? "#94a3b8" : "#2b7cee" }}
                  >
                    {grupo.fotoUrl ? undefined : iniciais(grupo.nome)}
                  </Avatar>

                  <Box sx={{ flex: 1, minWidth: 0 }}>
                    <Typography sx={{ fontWeight: 700, fontSize: "0.95rem", lineHeight: 1.2 }}>
                      {grupo.nome}
                    </Typography>
                    <Box sx={{ display: "flex", gap: 1.5, mt: 0.5, flexWrap: "wrap" }}>
                      {(["EM_ANDAMENTO", "PENDENTE", "BLOQUEADA"] as const)
                        .filter((s) => byEtapaStatus[s])
                        .map((s) => (
                          <Box key={s} sx={{ display: "flex", alignItems: "center", gap: 0.5 }}>
                            <Box sx={{ width: 7, height: 7, borderRadius: "50%", bgcolor: ETAPA_STATUS_BADGE[s].color }} />
                            <Typography variant="caption" color="text.secondary">
                              {byEtapaStatus[s]} {ETAPA_STATUS_BADGE[s].label}
                            </Typography>
                          </Box>
                        ))}
                    </Box>
                  </Box>

                  <Box sx={{ display: "flex", gap: 1, alignItems: "center", flexWrap: "wrap" }}>
                    <Chip
                      label={`${grupo.items.length} OA${grupo.items.length !== 1 ? "s" : ""}`}
                      size="small"
                      sx={{ fontWeight: 700, bgcolor: "#f1f5f9", color: "#475569", fontSize: "0.72rem" }}
                    />
                    {dlStr && (
                      <Tooltip title="Deadline mais próximo">
                        <Chip
                          icon={dlAtrasado ? <WarningAmberIcon sx={{ fontSize: "14px !important", color: "#ef4444 !important" }} /> : undefined}
                          label={dlStr} size="small"
                          sx={{ fontWeight: 700, fontSize: "0.72rem",
                            bgcolor: dlAtrasado ? "#fff5f5" : "#f0fdf4",
                            color:   dlAtrasado ? "#ef4444" : "#10b981",
                            border:  `1px solid ${dlAtrasado ? "#fecaca" : "#bbf7d0"}` }}
                        />
                      </Tooltip>
                    )}
                    {grupo.atrasados > 0 && (
                      <Chip
                        label={`${grupo.atrasados} atrasado${grupo.atrasados !== 1 ? "s" : ""}`}
                        size="small"
                        sx={{ fontWeight: 700, fontSize: "0.72rem", bgcolor: "#fff5f5", color: "#ef4444", border: "1px solid #fecaca" }}
                      />
                    )}
                    <ExpandMoreIcon
                      sx={{ color: "text.secondary", fontSize: "1.2rem", transition: "transform 0.2s",
                        transform: expandido ? "rotate(180deg)" : "rotate(0deg)" }}
                    />
                  </Box>
                </Box>
              </CardContent>
            </Card>

            {/* ── Cards dos OAs (colapsável) ── */}
            {expandido && <Box sx={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))", gap: 1.5, pl: 1 }}>
              {grupo.items.map(({ oa, etapa, isSecundario }) => {
                const tc      = TIPO_CONFIG[oa.tipo];
                const eBadge  = ETAPA_STATUS_BADGE[etapa.status] ?? ETAPA_STATUS_BADGE.PENDENTE;
                const dl      = etapa.deadlinePrevisto ?? oa.deadlineFinal;
                const dlDate  = dl ? new Date(dl) : null;
                const dlAtras = dlDate ? dlDate < inicioHoje && etapa.status !== "CONCLUIDA" : false;

                return (
                  <Card
                    key={oa.id}
                    onClick={() => onSelect(oa.id)}
                    sx={{
                      borderRadius: 2,
                      boxShadow: "0 1px 4px rgba(0,0,0,0.07)",
                      borderLeft: `3px solid ${eBadge.color}`,
                      cursor: "pointer",
                      "&:hover": { boxShadow: "0 4px 14px rgba(0,0,0,0.11)" },
                      transition: "box-shadow 0.15s",
                    }}
                  >
                    <CardContent sx={{ p: "10px 14px !important" }}>
                      {/* Linha 1: código + tipo */}
                      <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", mb: 0.75 }}>
                        <Typography sx={{ fontFamily: "monospace", fontWeight: 700, fontSize: "0.8rem" }}>
                          {oa.codigo}
                        </Typography>
                        <Box sx={{ display: "flex", gap: 0.5 }}>
                          {isSecundario && (
                            <Chip label="2°" size="small"
                              sx={{ height: 14, fontSize: "0.55rem", bgcolor: "#e0e7ff", color: "#3730a3", fontWeight: 700 }} />
                          )}
                          <Chip label={tc.label} size="small"
                            sx={{ height: 16, fontSize: "0.6rem", bgcolor: `${tc.color}18`, color: tc.color }} />
                        </Box>
                      </Box>

                      {/* Linha 2: etapa + status */}
                      <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", mb: 0.75 }}>
                        <Typography variant="caption" color="text.secondary" noWrap sx={{ flex: 1, mr: 0.5 }}>
                          {etapa.etapaDef.nome}
                        </Typography>
                        <Chip label={eBadge.label} size="small"
                          sx={{ height: 14, fontSize: "0.55rem", bgcolor: eBadge.bg, color: eBadge.color, fontWeight: 600, flexShrink: 0 }} />
                      </Box>

                      {/* Linha 3: progresso */}
                      <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 0.75 }}>
                        <LinearProgress
                          variant="determinate" value={oa.progressoPct}
                          sx={{ flex: 1, height: 4, borderRadius: 2,
                            "& .MuiLinearProgress-bar": { bgcolor: eBadge.color } }}
                        />
                        <Typography variant="caption" sx={{ fontSize: "0.65rem", color: "text.disabled", minWidth: 24 }}>
                          {oa.progressoPct}%
                        </Typography>
                      </Box>

                      {/* Linha 4: deadline da etapa */}
                      {dl && (
                        <Box sx={{ display: "flex", alignItems: "center", gap: 0.5 }}>
                          {dlAtras && <WarningAmberIcon sx={{ fontSize: 12, color: "#ef4444" }} />}
                          <Typography variant="caption"
                            sx={{ fontSize: "0.68rem", color: dlAtras ? "#ef4444" : "text.disabled", fontWeight: dlAtras ? 700 : 400 }}>
                            DL: {dlDate!.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "2-digit" })}
                          </Typography>
                        </Box>
                      )}
                    </CardContent>
                  </Card>
                );
              })}
            </Box>}
          </Box>
        );
      })}
    </Box>
  );
}

// ─── OA Drawer ────────────────────────────────────────────────────────────────

type OADrawerOA = NonNullable<ReturnType<typeof useOAsByCurso>["data"]>[0];
type CursoMembro = { usuarioId: string; papel: string; usuario: { id: string; nome: string; fotoUrl: string | null } };

function OADrawer({
  oa,
  membros,
  onClose,
}: {
  oa: OADrawerOA;
  membros: CursoMembro[];
  onClose: () => void;
}) {
  const [tab, setTab] = useState(0);
  const tc = TIPO_CONFIG[oa.tipo];
  const sc = STATUS_CONFIG[oa.status];
  const etapaAtual = oa.etapas.find((e) => e.status !== "CONCLUIDA");

  return (
    <Drawer
      anchor="right"
      open
      onClose={onClose}
      PaperProps={{ sx: { width: { xs: "100vw", sm: 700 }, display: "flex", flexDirection: "column" } }}
    >
      {/* ── Header ── */}
      <Box sx={{
        px: 3, py: 2, flexShrink: 0,
        borderBottom: "1px solid", borderColor: "divider",
        display: "flex", alignItems: "center", gap: 1.5,
      }}>
        <Typography sx={{ fontFamily: "monospace", fontWeight: 800, fontSize: "0.95rem" }}>
          {oa.codigo}
        </Typography>
        <Chip label={tc.label} size="small"
          sx={{ height: 20, fontSize: "0.7rem", bgcolor: `${tc.color}18`, color: tc.color, fontWeight: 600 }} />
        <Chip label={sc.label} size="small"
          sx={{ height: 20, fontSize: "0.7rem", bgcolor: sc.bg, color: sc.color, fontWeight: 600 }} />
        <Box sx={{ flex: 1 }} />
        <Tooltip title="Abrir página completa">
          <IconButton component={Link} to={`/oas/${oa.id}`} size="small" target="_blank">
            <OpenInNewIcon sx={{ fontSize: 18 }} />
          </IconButton>
        </Tooltip>
        <IconButton size="small" onClick={onClose} aria-label="Fechar">
          <CloseIcon sx={{ fontSize: 18 }} />
        </IconButton>
      </Box>

      {/* ── Info básica ── */}
      <Box sx={{ px: 3, py: 1.5, flexShrink: 0, borderBottom: "1px solid", borderColor: "divider" }}>
        {oa.titulo && (
          <Typography variant="body2" fontWeight={600} sx={{ mb: 0.5 }}>{oa.titulo}</Typography>
        )}
        <Typography variant="caption" color="text.secondary">
          U{oa.capitulo.unidade.numero} · {oa.capitulo.unidade.nome}
          {" › "}
          C{oa.capitulo.numero} · {oa.capitulo.nome}
        </Typography>
        <Box sx={{ display: "flex", gap: 3, mt: 1, flexWrap: "wrap" }}>
          <Box>
            <Typography variant="caption" color="text.disabled" sx={{ display: "block", mb: 0.25 }}>Etapa atual</Typography>
            <Typography variant="caption" color="text.primary" fontWeight={600}>
              {etapaAtual?.etapaDef.nome ?? "Concluído"}
            </Typography>
          </Box>
          <Box>
            <Typography variant="caption" color="text.disabled" sx={{ display: "block", mb: 0.25 }}>Responsável</Typography>
            <Typography variant="caption" color={etapaAtual?.responsavel ? "text.primary" : "text.disabled"} fontWeight={600}>
              {etapaAtual?.responsavel?.nome ?? "Não atribuído"}
            </Typography>
          </Box>
          <Box>
            <Typography variant="caption" color="text.disabled" sx={{ display: "block", mb: 0.25 }}>Deadline final</Typography>
            <Typography variant="caption"
              sx={{ color: isAtrasado(oa.deadlineFinal, oa.status === "CONCLUIDO") ? "#ef4444" : "text.primary", fontWeight: 600 }}>
              {fmtData(oa.deadlineFinal)}
            </Typography>
          </Box>
          <Box>
            <Typography variant="caption" color="text.disabled" sx={{ display: "block", mb: 0.25 }}>Progresso</Typography>
            <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
              <LinearProgress variant="determinate" value={oa.progressoPct}
                sx={{ width: 80, height: 5, borderRadius: 3 }} />
              <Typography variant="caption" fontWeight={600}>{oa.progressoPct}%</Typography>
            </Box>
          </Box>
        </Box>
        {(oa.linkObjeto || oa.linkObjetoFinal) && (
          <Box sx={{ display: "flex", gap: 2, mt: 1, flexWrap: "wrap" }}>
            {oa.linkObjeto && (
              <Typography variant="caption">
                <Box component="a" href={oa.linkObjeto} target="_blank" rel="noreferrer"
                  sx={{ color: "primary.main", textDecoration: "none", "&:hover": { textDecoration: "underline" } }}>
                  Link do objeto
                </Box>
              </Typography>
            )}
            {oa.linkObjetoFinal && (
              <Typography variant="caption">
                <Box component="a" href={oa.linkObjetoFinal} target="_blank" rel="noreferrer"
                  sx={{ color: "primary.main", textDecoration: "none", "&:hover": { textDecoration: "underline" } }}>
                  Link final
                </Box>
              </Typography>
            )}
          </Box>
        )}
      </Box>

      {/* ── Tabs ── */}
      <Tabs
        value={tab}
        onChange={(_, v) => setTab(v)}
        sx={{ px: 3, borderBottom: "1px solid", borderColor: "divider", flexShrink: 0, minHeight: 44 }}
      >
        <Tab label="Pipeline"    sx={{ minHeight: 44, fontWeight: 600, fontSize: "0.825rem" }} />
        <Tab label="Comentários" sx={{ minHeight: 44, fontWeight: 600, fontSize: "0.825rem" }} />
        <Tab label="Histórico"   sx={{ minHeight: 44, fontWeight: 600, fontSize: "0.825rem" }} />
      </Tabs>

      {/* ── Tab content ── */}
      <Box sx={{ flex: 1, overflowY: "auto" }}>
        {tab === 0 && <PipelinePanel oa={oa} />}
        {tab === 1 && <ComentariosPanel oaId={oa.id} membros={membros} />}
        {tab === 2 && <HistoricoPanel oaId={oa.id} />}
      </Box>
    </Drawer>
  );
}

// ─── Pipeline Panel ───────────────────────────────────────────────────────────

function PipelinePanel({ oa }: { oa: OADrawerOA }) {
  return (
    <Box sx={{ p: 3 }}>
      {oa.etapas.map((etapa, idx) => {
        const color  = ETAPA_STATUS_COLOR[etapa.status] ?? "#cbd5e1";
        const label  = ETAPA_STATUS_LABEL[etapa.status] ?? etapa.status;
        const atrasado = !["CONCLUIDA"].includes(etapa.status) && isAtrasado(etapa.deadlinePrevisto);
        const concluida = etapa.status === "CONCLUIDA";
        return (
          <Box key={etapa.id}>
            {idx > 0 && (
              <Box sx={{ ml: 1.75, width: 2, height: 16, bgcolor: "divider" }} />
            )}
            <Box sx={{
              display: "flex", alignItems: "flex-start", gap: 2,
              p: 1.5, borderRadius: 2,
              bgcolor: etapa.status === "EM_ANDAMENTO" ? "#fffbeb" : "transparent",
              border: etapa.status === "EM_ANDAMENTO" ? "1px solid #fef3c7" : "1px solid transparent",
            }}>
              {/* Indicador de status */}
              <Box sx={{
                width: 16, height: 16, borderRadius: "50%", flexShrink: 0, mt: 0.25,
                bgcolor: color,
                boxShadow: concluida ? "none" : `0 0 0 3px ${color}30`,
              }} />

              <Box sx={{ flex: 1, minWidth: 0 }}>
                <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 0.5, flexWrap: "wrap" }}>
                  <Typography variant="body2" fontWeight={600} sx={{ opacity: concluida ? 0.6 : 1 }}>
                    {etapa.etapaDef.nome}
                  </Typography>
                  <Chip label={label} size="small"
                    sx={{ height: 18, fontSize: "0.65rem", bgcolor: `${color}18`, color }} />
                  {atrasado && (
                    <Chip label="Atrasada" size="small"
                      sx={{ height: 18, fontSize: "0.65rem", bgcolor: "#fef2f2", color: "#ef4444", fontWeight: 700 }} />
                  )}
                  {etapa.etapaDef.temArtefato && (
                    <Chip label="Entregável" size="small"
                      sx={{ height: 18, fontSize: "0.65rem", bgcolor: "#eff6ff", color: "#2b7cee" }} />
                  )}
                </Box>

                <Box sx={{ display: "flex", gap: 3, flexWrap: "wrap" }}>
                  <Box>
                    <Typography variant="caption" color="text.disabled">Responsável</Typography>
                    <Typography variant="caption" color={etapa.responsavel ? "text.primary" : "text.disabled"} sx={{ display: "block", fontWeight: 500 }}>
                      {etapa.responsavel?.nome ?? "—"}
                    </Typography>
                  </Box>
                  {etapa.responsavelSecundario && (
                    <Box>
                      <Typography variant="caption" color="text.disabled">Secundário</Typography>
                      <Typography variant="caption" color="text.primary" sx={{ display: "block", fontWeight: 500 }}>
                        {etapa.responsavelSecundario.nome}
                      </Typography>
                    </Box>
                  )}
                  <Box>
                    <Typography variant="caption" color="text.disabled">Deadline previsto</Typography>
                    <Typography variant="caption"
                      sx={{ display: "block", fontWeight: 500, color: atrasado ? "#ef4444" : "text.primary" }}>
                      {fmtData(etapa.deadlinePrevisto)}
                    </Typography>
                  </Box>
                  {etapa.deadlineReal && (
                    <Box>
                      <Typography variant="caption" color="text.disabled">Concluída em</Typography>
                      <Typography variant="caption" color="#10b981" sx={{ display: "block", fontWeight: 500 }}>
                        {fmtData(etapa.deadlineReal)}
                      </Typography>
                    </Box>
                  )}
                </Box>
              </Box>
            </Box>
          </Box>
        );
      })}
    </Box>
  );
}

// ─── Comentários Panel ────────────────────────────────────────────────────────

function ComentariosPanel({ oaId }: { oaId: string; membros?: CursoMembro[] }) {
  const user                             = useAuthStore((s) => s.user);
  const { data: comentarios = [], isLoading } = useComentariosOA(oaId);
  const { mutate: adicionar, isPending: enviando } = useAdicionarComentario(oaId);
  const { mutate: excluir }              = useExcluirComentario(oaId);
  const [texto, setTexto]                = useState("");
  const textareaRef                      = useRef<HTMLTextAreaElement | null>(null);
  const isAdmin                          = user?.papelGlobal === "ADMIN";

  const enviar = () => {
    const t = texto.trim();
    if (!t) return;
    adicionar({ texto: t }, { onSuccess: () => setTexto("") });
  };

  if (isLoading) {
    return (
      <Box sx={{ display: "flex", justifyContent: "center", py: 6 }}>
        <CircularProgress size={24} />
      </Box>
    );
  }

  return (
    <Box sx={{ display: "flex", flexDirection: "column", height: "100%" }}>
      {/* Lista */}
      <Box sx={{ flex: 1, overflowY: "auto", px: 3, pt: 2, pb: 1 }}>
        {comentarios.length === 0 ? (
          <Typography variant="body2" color="text.disabled" sx={{ textAlign: "center", py: 4 }}>
            Nenhum comentário ainda.
          </Typography>
        ) : (
          comentarios.map((c) => {
            const isOwn  = c.autor.id === user?.id;
            const canDel = isOwn || isAdmin;
            const initials = c.autor.nome?.[0]?.toUpperCase() ?? "?";
            return (
              <Box key={c.id} sx={{ display: "flex", gap: 1.5, mb: 2, alignItems: "flex-start" }}>
                <Avatar sx={{ width: 30, height: 30, fontSize: "0.75rem", bgcolor: "primary.main", flexShrink: 0 }}>
                  {initials}
                </Avatar>
                <Box sx={{ flex: 1, minWidth: 0 }}>
                  <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 0.25 }}>
                    <Typography variant="caption" fontWeight={700}>{c.autor.nome}</Typography>
                    <Typography variant="caption" color="text.disabled">
                      {new Date(c.createdAt).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}
                    </Typography>
                    {canDel && (
                      <IconButton size="small" sx={{ ml: "auto", p: 0.25 }} onClick={() => excluir(c.id)}>
                        <DeleteOutlineIcon sx={{ fontSize: 14, color: "text.disabled" }} />
                      </IconButton>
                    )}
                  </Box>
                  <Typography variant="body2" sx={{ whiteSpace: "pre-wrap", lineHeight: 1.6 }}>
                    {c.texto.split(/(@\w[\w\u00C0-\u017F]*)/).map((part, i) =>
                      part.startsWith("@") ? (
                        <Box component="span" key={i} sx={{ color: "primary.main", fontWeight: 600 }}>{part}</Box>
                      ) : part
                    )}
                  </Typography>
                </Box>
              </Box>
            );
          })
        )}
      </Box>

      <Divider />

      {/* Input */}
      <Box sx={{ px: 3, py: 2, display: "flex", gap: 1.5, alignItems: "flex-end", flexShrink: 0 }}>
        <TextField
          multiline
          maxRows={4}
          fullWidth
          size="small"
          placeholder="Escreva um comentário..."
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
          inputRef={textareaRef}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); enviar(); }
          }}
          sx={{ "& .MuiOutlinedInput-root": { borderRadius: 2 } }}
        />
        <IconButton
          color="primary"
          disabled={!texto.trim() || enviando}
          onClick={enviar}
          sx={{ flexShrink: 0 }}
        >
          {enviando ? <CircularProgress size={18} /> : <SendIcon sx={{ fontSize: 20 }} />}
        </IconButton>
      </Box>
    </Box>
  );
}

// ─── Histórico Panel ──────────────────────────────────────────────────────────

function HistoricoPanel({ oaId }: { oaId: string }) {
  const { data: logs = [], isLoading } = useAuditLogOA(oaId);

  if (isLoading) {
    return (
      <Box sx={{ display: "flex", justifyContent: "center", py: 6 }}>
        <CircularProgress size={24} />
      </Box>
    );
  }

  if (logs.length === 0) {
    return (
      <Typography variant="body2" color="text.disabled" sx={{ textAlign: "center", py: 4 }}>
        Nenhum registro de histórico.
      </Typography>
    );
  }

  return (
    <Box sx={{ px: 3, py: 2 }}>
      {logs.map((log) => (
        <Box key={log.id} sx={{ display: "flex", gap: 2, mb: 2, alignItems: "flex-start" }}>
          <Box sx={{ width: 8, height: 8, borderRadius: "50%", bgcolor: "primary.main", mt: 0.75, flexShrink: 0 }} />
          <Box sx={{ flex: 1 }}>
            <Typography variant="caption" color="text.secondary" sx={{ display: "block", mb: 0.25 }}>
              {new Date(log.createdAt).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", year: "2-digit", hour: "2-digit", minute: "2-digit" })}
              {log.usuario && (
                <Box component="span" sx={{ ml: 1, fontWeight: 700, color: "text.primary" }}>· {log.usuario.nome}</Box>
              )}
            </Typography>
            <Typography variant="body2" color="text.primary">
              {log.acao}
            </Typography>
          </Box>
        </Box>
      ))}
    </Box>
  );
}
