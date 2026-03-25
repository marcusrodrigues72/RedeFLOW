import { createFileRoute, Link } from "@tanstack/react-router";
import {
  Box, Typography, Chip, Button, Card, CardContent, TextField, InputAdornment,
  Select, MenuItem, FormControl, Skeleton, Alert, LinearProgress,
  Table, TableHead, TableRow, TableCell, TableBody, ToggleButtonGroup, ToggleButton,
} from "@mui/material";
import ArrowBackIcon    from "@mui/icons-material/ArrowBack";
import SearchIcon       from "@mui/icons-material/Search";
import TableRowsIcon    from "@mui/icons-material/TableRows";
import ViewKanbanIcon   from "@mui/icons-material/ViewKanban";
import { useState } from "react";
import { useOAsByCurso, useCurso, useAtualizarEtapaGeral } from "@/lib/api/cursos";
import type { StatusOA, TipoOA, StatusEtapa } from "shared";

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
  VIDEO:      { label: "Vídeo",         color: "#2b7cee" },
  SLIDE:      { label: "Slide",         color: "#7c3aed" },
  QUIZ:       { label: "Quiz",          color: "#0891b2" },
  EBOOK:      { label: "E-book",        color: "#059669" },
  PLANO_AULA: { label: "Plano de Aula", color: "#d97706" },
  TAREFA:     { label: "Tarefa",        color: "#dc2626" },
};

// Mapeamento StatusOA → StatusEtapa para atualização via drag
const OA_TO_ETAPA: Record<StatusOA, StatusEtapa> = {
  PENDENTE:     "PENDENTE",
  EM_ANDAMENTO: "EM_ANDAMENTO",
  BLOQUEADO:    "BLOQUEADA",
  CONCLUIDO:    "CONCLUIDA",
};

function OAsPage() {
  const { cursoId }                             = Route.useParams();
  const { data: curso }                         = useCurso(cursoId);
  const [search,         setSearch]             = useState("");
  const [filtroStatus,   setFiltroStatus]       = useState("");
  const [filtroTipo,     setFiltroTipo]         = useState("");
  const [filtroUnidade,  setFiltroUnidade]      = useState("");
  const [visao,          setVisao]              = useState<"lista" | "kanban">("lista");
  const { mutate: atualizarEtapa }              = useAtualizarEtapaGeral();

  const { data: oas = [], isLoading, isError } = useOAsByCurso(cursoId, {
    status: filtroStatus || undefined,
    tipo:   filtroTipo   || undefined,
  });

  const unidades = Array.from(
    new Map(oas.map((oa) => [oa.capitulo.unidade.numero, oa.capitulo.unidade])).values()
  ).sort((a, b) => a.numero - b.numero);

  const oasFiltrados = oas.filter((oa) =>
    (!search || oa.codigo.toLowerCase().includes(search.toLowerCase())) &&
    (!filtroUnidade || String(oa.capitulo.unidade.numero) === filtroUnidade)
  );

  const grupos = oasFiltrados.reduce<Record<string, typeof oasFiltrados>>((acc, oa) => {
    const key = `U${oa.capitulo.unidade.numero} — ${oa.capitulo.unidade.nome} / C${oa.capitulo.numero} — ${oa.capitulo.nome}`;
    acc[key] = acc[key] ?? [];
    acc[key]!.push(oa);
    return acc;
  }, {});

  // Handler inline status
  const handleStatusChange = (oa: (typeof oas)[0], novoStatus: StatusOA) => {
    const etapaAtual = oa.etapas.find((e) => e.status !== "CONCLUIDA");
    if (!etapaAtual) return;
    atualizarEtapa({ oaId: oa.id, etapaId: etapaAtual.id, data: { status: OA_TO_ETAPA[novoStatus] } });
  };

  return (
    <Box>
      <Box sx={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", mb: 3 }}>
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
        <ToggleButtonGroup
          value={visao} exclusive size="small"
          onChange={(_, v) => { if (v) setVisao(v); }}
        >
          <ToggleButton value="lista"  aria-label="Lista">
            <TableRowsIcon  sx={{ fontSize: 18 }} />
          </ToggleButton>
          <ToggleButton value="kanban" aria-label="Kanban">
            <ViewKanbanIcon sx={{ fontSize: 18 }} />
          </ToggleButton>
        </ToggleButtonGroup>
      </Box>

      {/* Filtros */}
      <Box sx={{ display: "flex", gap: 2, mb: 3, flexWrap: "wrap" }}>
        <TextField
          placeholder="Buscar por código..." size="small" value={search}
          onChange={(e) => setSearch(e.target.value)} sx={{ minWidth: 220 }}
          slotProps={{ input: { startAdornment: <InputAdornment position="start"><SearchIcon sx={{ fontSize: 18, color: "text.disabled" }} /></InputAdornment> } }}
        />
        <FormControl size="small" sx={{ minWidth: 150 }}>
          <Select value={filtroStatus} onChange={(e) => setFiltroStatus(e.target.value)} displayEmpty>
            <MenuItem value="">Todos os status</MenuItem>
            {(Object.keys(STATUS_CONFIG) as StatusOA[]).map((s) => (
              <MenuItem key={s} value={s}>{STATUS_CONFIG[s].label}</MenuItem>
            ))}
          </Select>
        </FormControl>
        <FormControl size="small" sx={{ minWidth: 160 }}>
          <Select value={filtroTipo} onChange={(e) => setFiltroTipo(e.target.value)} displayEmpty>
            <MenuItem value="">Todos os tipos</MenuItem>
            {(Object.keys(TIPO_CONFIG) as TipoOA[]).map((t) => (
              <MenuItem key={t} value={t}>{TIPO_CONFIG[t].label}</MenuItem>
            ))}
          </Select>
        </FormControl>
        <FormControl size="small" sx={{ minWidth: 180 }}>
          <Select value={filtroUnidade} onChange={(e) => setFiltroUnidade(e.target.value)} displayEmpty>
            <MenuItem value="">Todas as unidades</MenuItem>
            {unidades.map((u) => (
              <MenuItem key={u.numero} value={String(u.numero)}>U{u.numero} — {u.nome}</MenuItem>
            ))}
          </Select>
        </FormControl>
      </Box>

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
        <ListaView grupos={grupos} onStatusChange={handleStatusChange} />
      ) : (
        <KanbanView oas={oasFiltrados} onStatusChange={handleStatusChange} />
      )}
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
}: {
  grupos: Record<string, ReturnType<typeof useOAsByCurso>["data"]>;
  onStatusChange: (oa: any, status: StatusOA) => void;
}) {
  return (
    <>
      {Object.entries(grupos).map(([grupo, items]) => (
        <Box key={grupo} sx={{ mb: 3 }}>
          <Typography variant="caption" sx={{ fontWeight: 700, color: "text.disabled", letterSpacing: "0.06em", mb: 1, display: "block" }}>
            {grupo.toUpperCase()}
          </Typography>
          <Card>
            <CardContent sx={{ p: 0, pb: "0 !important" }}>
              <Table size="small">
                <TableHead>
                  <TableRow sx={{ bgcolor: "#f8fafc" }}>
                    {["Código", "Tipo", "Progresso", "Status", "Etapa Atual", "Responsável", "DL Etapa", "DL Final", ""].map((h) => (
                      <TableCell key={h} sx={{ fontWeight: 700, fontSize: "0.75rem", color: "text.secondary", py: 1.5, whiteSpace: "nowrap" }}>{h}</TableCell>
                    ))}
                  </TableRow>
                </TableHead>
                <TableBody>
                  {items!.map((oa) => {
                    const etapaAtual = oa.etapas.find((e) => e.status === "EM_ANDAMENTO" || e.status === "PENDENTE");
                    const concluida  = oa.status === "CONCLUIDO";
                    const tc = TIPO_CONFIG[oa.tipo];
                    return (
                      <TableRow key={oa.id} sx={{ "&:hover": { bgcolor: "action.hover" } }}>
                        <TableCell sx={{ py: 1.5, fontFamily: "monospace", fontWeight: 600, fontSize: "0.8rem" }}>
                          {oa.codigo}
                        </TableCell>
                        <TableCell>
                          <Chip label={tc.label} size="small"
                            sx={{ bgcolor: `${tc.color}18`, color: tc.color, fontWeight: 600, fontSize: "0.7rem" }} />
                        </TableCell>
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
                          <Button component={Link} to={`/oas/${oa.id}`} size="small" variant="outlined"
                            sx={{ fontSize: "0.7rem", py: 0.25 }}>
                            Detalhes
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </Box>
      ))}
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

/** Deriva o status efetivo de um OA a partir das suas etapas, sem depender do campo denormalizado `oa.status`. */
function effectiveStatus(oa: NonNullable<ReturnType<typeof useOAsByCurso>["data"]>[0]): StatusOA {
  if (oa.etapas.length === 0) return "PENDENTE";
  if (oa.etapas.every((e) => e.status === "CONCLUIDA")) return "CONCLUIDO";
  if (oa.etapas.some((e) => e.status === "BLOQUEADA"))  return "BLOQUEADO";
  if (oa.etapas.some((e) => e.status === "EM_ANDAMENTO")) return "EM_ANDAMENTO";
  return "PENDENTE";
}

function KanbanView({
  oas,
  onStatusChange,
}: {
  oas: ReturnType<typeof useOAsByCurso>["data"];
  onStatusChange: (oa: any, status: StatusOA) => void;
}) {
  const [overCol, setOverCol] = useState<StatusOA | null>(null);

  return (
    <Box sx={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 2, alignItems: "start" }}>
      {KANBAN_COLS.map((col) => {
        const colOAs = oas!.filter((oa) => effectiveStatus(oa) === col.status);
        const isOver = overCol === col.status;
        return (
          <Box
            key={col.status}
            onDragOver={(e) => { e.preventDefault(); e.dataTransfer.dropEffect = "move"; setOverCol(col.status); }}
            onDragLeave={(e) => {
              // Só limpa se o cursor saiu de fato da coluna (não apenas entrou num filho)
              if (!e.currentTarget.contains(e.relatedTarget as Node)) setOverCol(null);
            }}
            onDrop={(e) => {
              e.preventDefault();
              setOverCol(null);
              const oaId = e.dataTransfer.getData("text/plain");
              const oa   = oas!.find((o) => o.id === oaId);
              if (oa && effectiveStatus(oa) !== col.status) onStatusChange(oa, col.status);
            }}
            sx={{
              borderRadius: 3, border: "2px dashed",
              borderColor: isOver ? col.color : "transparent",
              transition: "border-color 0.15s",
              bgcolor: isOver ? `${col.color}08` : "transparent",
            }}
          >
            {/* Cabeçalho da coluna */}
            <Box sx={{ display: "flex", alignItems: "center", gap: 1, px: 1, py: 1.5 }}>
              <Box sx={{ width: 8, height: 8, borderRadius: "50%", bgcolor: col.color }} />
              <Typography variant="caption" sx={{ fontWeight: 700, color: "text.secondary", letterSpacing: "0.05em" }}>
                {col.label.toUpperCase()}
              </Typography>
              <Chip label={colOAs.length} size="small"
                sx={{ height: 18, fontSize: "0.65rem", bgcolor: col.bg, color: col.color, ml: "auto" }} />
            </Box>

            {/* Cards */}
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
                        <Button component={Link} to={`/oas/${oa.id}`} size="small"
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
