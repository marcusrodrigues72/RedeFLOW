import { createFileRoute } from "@tanstack/react-router";
import {
  Box, Typography, Card, CardContent, Avatar, Chip,
  Skeleton, Alert, Tooltip, ToggleButton, ToggleButtonGroup,
  TextField, InputAdornment, Table, TableBody, TableCell,
  TableContainer, TableHead, TableRow, TableSortLabel,
  LinearProgress,
} from "@mui/material";
import PeopleAltIcon      from "@mui/icons-material/PeopleAlt";
import CalendarMonthIcon  from "@mui/icons-material/CalendarMonth";
import WarningAmberIcon   from "@mui/icons-material/WarningAmber";
import AccessTimeIcon     from "@mui/icons-material/AccessTime";
import SearchIcon         from "@mui/icons-material/Search";
import { useState, useMemo } from "react";
import type { ResponsavelAlocacao, EtapaAlocacao } from "shared";
import { useAlocacao }    from "@/lib/api/relatorios";

export const Route = createFileRoute("/_authed/alocacao")({
  component: AlocacaoPage,
});

// ─── Helpers de data ──────────────────────────────────────────────────────────

const hoje = () => {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
};

function inicioSemana(d: Date): Date {
  const r = new Date(d);
  const dia = r.getDay();
  r.setDate(r.getDate() - (dia === 0 ? 6 : dia - 1));
  r.setHours(0, 0, 0, 0);
  return r;
}

function addDays(d: Date, n: number): Date {
  const r = new Date(d);
  r.setDate(r.getDate() + n);
  return r;
}

function addMonths(d: Date, n: number): Date {
  const r = new Date(d);
  r.setMonth(r.getMonth() + n);
  return r;
}

function fmtDia(d: Date) {
  return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
}

function fmtMes(d: Date) {
  return d.toLocaleDateString("pt-BR", { month: "short", year: "2-digit" });
}

function initials(nome: string) {
  return nome.split(" ").slice(0, 2).map((n) => n[0]).join("").toUpperCase();
}

const PAPEL_LABEL: Record<string, string> = {
  CONTEUDISTA:           "Conteudista",
  DESIGNER_INSTRUCIONAL: "Designer Instrucional",
  PROFESSOR_ATOR:        "Prof. Ator",
  PROFESSOR_TECNICO:     "Revisor Técnico",
  ACESSIBILIDADE:        "Acessibilidade",
  PRODUTOR_FINAL:        "Produtor Final",
  VALIDADOR_FINAL:       "Validador Final",
  COORDENADOR_PRODUCAO:  "Coord. Produção",
};

const PAPEL_CORES: Record<string, { bg: string; border: string; text: string }> = {
  CONTEUDISTA:           { bg: "#eff6ff", border: "#93c5fd", text: "#1d4ed8" },
  DESIGNER_INSTRUCIONAL: { bg: "#faf5ff", border: "#c4b5fd", text: "#6d28d9" },
  PROFESSOR_ATOR:        { bg: "#fff7ed", border: "#fdba74", text: "#c2410c" },
  PROFESSOR_TECNICO:     { bg: "#f0fdf4", border: "#86efac", text: "#15803d" },
  ACESSIBILIDADE:        { bg: "#fefce8", border: "#fde047", text: "#a16207" },
  PRODUTOR_FINAL:        { bg: "#f0f9ff", border: "#7dd3fc", text: "#0369a1" },
  VALIDADOR_FINAL:       { bg: "#fff1f2", border: "#fda4af", text: "#be123c" },
  COORDENADOR_PRODUCAO:  { bg: "#f8fafc", border: "#94a3b8", text: "#475569" },
};

// ─── Dados derivados por pessoa ───────────────────────────────────────────────

interface PessoaComputada extends ResponsavelAlocacao {
  atrasados: number;
  papeis:    string[];
  cursos:    string[];
  cargaPct:  number;
}

function computarPessoas(pessoas: ResponsavelAlocacao[], maxTotal: number): PessoaComputada[] {
  const agora = hoje();
  return pessoas.map((p) => {
    const atrasados = p.etapas.filter(
      (e) => e.deadlinePrevisto && new Date(e.deadlinePrevisto) < agora
    ).length;
    const papeis = [...new Set(p.etapas.map((e) => e.papel))];
    const cursos = [...new Set(p.etapas.map((e) => e.cursoCodigo))];
    const total  = p.emAndamento + p.pendente;
    const cargaPct = maxTotal > 0 ? Math.round((total / maxTotal) * 100) : 0;
    return { ...p, atrasados, papeis, cursos, cargaPct };
  });
}

type SortKey = "nome" | "emAndamento" | "pendente" | "cargaPct" | "atrasados";

// ─── Página ───────────────────────────────────────────────────────────────────

function AlocacaoPage() {
  const { data, isLoading, isError } = useAlocacao();
  const [view, setView]               = useState<"semana" | "mes">("semana");
  const [busca, setBusca]             = useState("");
  const [filtroPapel, setFiltroPapel] = useState<string>("TODOS");
  const [sortKey, setSortKey]         = useState<SortKey>("cargaPct");
  const [sortDir, setSortDir]         = useState<"asc" | "desc">("desc");

  const porResponsavel = data?.porResponsavel ?? [];
  const porPapel       = data?.porPapel       ?? [];

  const maxTotal = Math.max(...porResponsavel.map((p) => p.emAndamento + p.pendente), 1);

  const pessoas = useMemo(
    () => computarPessoas(porResponsavel, maxTotal),
    [porResponsavel, maxTotal]
  );

  // KPIs
  const totalAtivos      = pessoas.length;
  const sobrecarregados  = pessoas.filter((p) => p.cargaPct >= 80).length;
  const comAtrasados     = pessoas.filter((p) => p.atrasados > 0).length;
  const mediaCargas      = totalAtivos > 0
    ? Math.round(pessoas.reduce((s, p) => s + p.cargaPct, 0) / totalAtivos)
    : 0;

  // Papéis únicos para filtro
  const papeisDisponiveis = [...new Set(pessoas.flatMap((p) => p.papeis))];

  // Filtro + ordenação
  const pessoasFiltradas = useMemo(() => {
    let lista = pessoas.filter((p) => {
      const matchBusca = !busca || p.nome.toLowerCase().includes(busca.toLowerCase())
        || p.email.toLowerCase().includes(busca.toLowerCase());
      const matchPapel = filtroPapel === "TODOS" || p.papeis.includes(filtroPapel);
      return matchBusca && matchPapel;
    });
    lista = [...lista].sort((a, b) => {
      const av = a[sortKey];
      const bv = b[sortKey];
      if (typeof av === "string" && typeof bv === "string")
        return sortDir === "asc" ? av.localeCompare(bv) : bv.localeCompare(av);
      return sortDir === "asc" ? (av as number) - (bv as number) : (bv as number) - (av as number);
    });
    return lista;
  }, [pessoas, busca, filtroPapel, sortKey, sortDir]);

  const handleSort = (key: SortKey) => {
    if (sortKey === key) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else { setSortKey(key); setSortDir("desc"); }
  };

  if (isError) return <Alert severity="error">Erro ao carregar dados de alocação.</Alert>;

  return (
    <Box>
      <Typography sx={{ fontSize: "1.375rem", fontWeight: 800, mb: 0.5 }}>Alocação do Time</Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
        Capacidade e carga de trabalho por profissional — use para decisões de alocação em novos projetos
      </Typography>

      {/* ── KPIs ─────────────────────────────────────────────────────────────── */}
      <Box sx={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 2, mb: 3 }}>
        <KpiCard
          label="Profissionais ativos"
          value={isLoading ? "—" : String(totalAtivos)}
          icon={<PeopleAltIcon sx={{ fontSize: 20 }} />}
          cor="#2b7cee" bg="#eff6ff"
        />
        <KpiCard
          label="Em sobrecarga (≥80%)"
          value={isLoading ? "—" : String(sobrecarregados)}
          icon={<WarningAmberIcon sx={{ fontSize: 20 }} />}
          cor={sobrecarregados > 0 ? "#ef4444" : "#10b981"}
          bg={sobrecarregados > 0 ? "#fff5f5" : "#f0fdf4"}
        />
        <KpiCard
          label="Com itens atrasados"
          value={isLoading ? "—" : String(comAtrasados)}
          icon={<AccessTimeIcon sx={{ fontSize: 20 }} />}
          cor={comAtrasados > 0 ? "#f59e0b" : "#10b981"}
          bg={comAtrasados > 0 ? "#fffbeb" : "#f0fdf4"}
        />
        <KpiCard
          label="Carga média do time"
          value={isLoading ? "—" : `${mediaCargas}%`}
          icon={<CalendarMonthIcon sx={{ fontSize: 20 }} />}
          cor={mediaCargas >= 80 ? "#ef4444" : mediaCargas >= 50 ? "#f59e0b" : "#10b981"}
          bg={mediaCargas >= 80 ? "#fff5f5" : mediaCargas >= 50 ? "#fffbeb" : "#f0fdf4"}
        />
      </Box>

      {/* ── Tabela de capacidade ──────────────────────────────────────────────── */}
      <Card sx={{ mb: 3 }}>
        <CardContent sx={{ p: 0, pb: "0 !important" }}>
          {/* Header + filtros */}
          <Box sx={{ px: 3, py: 2, display: "flex", alignItems: "center", justifyContent: "space-between",
            borderBottom: "1px solid", borderColor: "divider", gap: 2, flexWrap: "wrap" }}>
            <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
              <PeopleAltIcon sx={{ fontSize: 18, color: "text.secondary" }} />
              <Typography variant="h6" sx={{ fontWeight: 700, fontSize: "0.95rem" }}>
                Capacidade por Profissional
              </Typography>
            </Box>
            <Box sx={{ display: "flex", gap: 1.5, alignItems: "center", flexWrap: "wrap" }}>
              <TextField
                size="small" placeholder="Buscar profissional…"
                value={busca} onChange={(e) => setBusca(e.target.value)}
                sx={{ width: 220 }}
                slotProps={{
                  input: {
                    startAdornment: (
                      <InputAdornment position="start">
                        <SearchIcon sx={{ fontSize: 16, color: "text.disabled" }} />
                      </InputAdornment>
                    ),
                  },
                }}
              />
              {["TODOS", ...papeisDisponiveis].map((p) => (
                <Chip
                  key={p}
                  label={p === "TODOS" ? "Todos" : (PAPEL_LABEL[p] ?? p)}
                  size="small"
                  onClick={() => setFiltroPapel(p)}
                  variant={filtroPapel === p ? "filled" : "outlined"}
                  sx={{
                    fontWeight: 600,
                    bgcolor: filtroPapel === p ? "primary.main" : "transparent",
                    color:   filtroPapel === p ? "white" : "text.secondary",
                    borderColor: filtroPapel === p ? "primary.main" : "divider",
                    "&:hover": { bgcolor: filtroPapel === p ? "primary.dark" : "action.hover" },
                  }}
                />
              ))}
            </Box>
          </Box>

          {/* Tabela */}
          {isLoading ? (
            <Box sx={{ p: 3, display: "flex", flexDirection: "column", gap: 1.5 }}>
              {[1,2,3,4,5].map((i) => <Skeleton key={i} height={52} sx={{ borderRadius: 1 }} />)}
            </Box>
          ) : pessoasFiltradas.length === 0 ? (
            <Box sx={{ p: 5, textAlign: "center" }}>
              <Typography color="text.secondary" variant="body2">Nenhum profissional encontrado.</Typography>
            </Box>
          ) : (
            <TableContainer>
              <Table size="small">
                <TableHead>
                  <TableRow sx={{ bgcolor: "#f8fafc" }}>
                    <TableCell sx={{ fontWeight: 700, fontSize: "0.75rem", color: "text.secondary", pl: 3 }}>
                      <TableSortLabel
                        active={sortKey === "nome"} direction={sortKey === "nome" ? sortDir : "asc"}
                        onClick={() => handleSort("nome")}
                      >PROFISSIONAL</TableSortLabel>
                    </TableCell>
                    <TableCell sx={{ fontWeight: 700, fontSize: "0.75rem", color: "text.secondary" }}>
                      PAPÉIS
                    </TableCell>
                    <TableCell align="center" sx={{ fontWeight: 700, fontSize: "0.75rem", color: "text.secondary" }}>
                      <TableSortLabel
                        active={sortKey === "emAndamento"} direction={sortKey === "emAndamento" ? sortDir : "asc"}
                        onClick={() => handleSort("emAndamento")}
                      >ATIVOS</TableSortLabel>
                    </TableCell>
                    <TableCell align="center" sx={{ fontWeight: 700, fontSize: "0.75rem", color: "text.secondary" }}>
                      <TableSortLabel
                        active={sortKey === "pendente"} direction={sortKey === "pendente" ? sortDir : "asc"}
                        onClick={() => handleSort("pendente")}
                      >PENDENTES</TableSortLabel>
                    </TableCell>
                    <TableCell sx={{ fontWeight: 700, fontSize: "0.75rem", color: "text.secondary", minWidth: 140 }}>
                      <TableSortLabel
                        active={sortKey === "cargaPct"} direction={sortKey === "cargaPct" ? sortDir : "asc"}
                        onClick={() => handleSort("cargaPct")}
                      >CARGA</TableSortLabel>
                    </TableCell>
                    <TableCell align="center" sx={{ fontWeight: 700, fontSize: "0.75rem", color: "text.secondary" }}>
                      <TableSortLabel
                        active={sortKey === "atrasados"} direction={sortKey === "atrasados" ? sortDir : "asc"}
                        onClick={() => handleSort("atrasados")}
                      >ATRASADOS</TableSortLabel>
                    </TableCell>
                    <TableCell sx={{ fontWeight: 700, fontSize: "0.75rem", color: "text.secondary", pr: 3 }}>
                      CURSOS
                    </TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {pessoasFiltradas.map((p) => {
                    const corCarga = p.cargaPct >= 80 ? "#ef4444" : p.cargaPct >= 50 ? "#f59e0b" : "#10b981";
                    return (
                      <TableRow key={p.usuarioId}
                        sx={{ "&:hover": { bgcolor: "action.hover" }, "&:last-child td": { border: 0 } }}>

                        {/* Profissional */}
                        <TableCell sx={{ pl: 3, py: 1.5 }}>
                          <Box sx={{ display: "flex", alignItems: "center", gap: 1.5 }}>
                            <Avatar sx={{ width: 34, height: 34, fontSize: "0.75rem", fontWeight: 700,
                              bgcolor: p.emAndamento > 0 ? "primary.main" : "#94a3b8", flexShrink: 0 }}>
                              {p.fotoUrl
                                ? <img src={p.fotoUrl} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                                : initials(p.nome)}
                            </Avatar>
                            <Box sx={{ minWidth: 0 }}>
                              <Typography variant="body2" fontWeight={600} noWrap>{p.nome}</Typography>
                              <Typography variant="caption" color="text.disabled" noWrap sx={{ display: "block" }}>{p.email}</Typography>
                            </Box>
                          </Box>
                        </TableCell>

                        {/* Papéis */}
                        <TableCell>
                          <Box sx={{ display: "flex", gap: 0.5, flexWrap: "wrap" }}>
                            {p.papeis.map((papel) => {
                              const cor = PAPEL_CORES[papel] ?? { bg: "#f8fafc", border: "#e2e8f0", text: "#475569" };
                              return (
                                <Chip key={papel}
                                  label={PAPEL_LABEL[papel] ?? papel}
                                  size="small"
                                  sx={{ height: 18, fontSize: "0.6rem", fontWeight: 600,
                                    bgcolor: cor.bg, color: cor.text, border: `1px solid ${cor.border}` }}
                                />
                              );
                            })}
                          </Box>
                        </TableCell>

                        {/* Ativos */}
                        <TableCell align="center">
                          {p.emAndamento > 0
                            ? <Chip label={p.emAndamento} size="small"
                                sx={{ height: 20, fontSize: "0.7rem", fontWeight: 700, bgcolor: "#eff6ff", color: "#2b7cee" }} />
                            : <Typography variant="caption" color="text.disabled">—</Typography>
                          }
                        </TableCell>

                        {/* Pendentes */}
                        <TableCell align="center">
                          {p.pendente > 0
                            ? <Typography variant="body2" fontWeight={600} color="text.secondary">{p.pendente}</Typography>
                            : <Typography variant="caption" color="text.disabled">—</Typography>
                          }
                        </TableCell>

                        {/* Carga */}
                        <TableCell sx={{ minWidth: 140 }}>
                          <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                            <Box sx={{ flex: 1 }}>
                              <LinearProgress
                                variant="determinate"
                                value={Math.min(p.cargaPct, 100)}
                                sx={{
                                  height: 6, borderRadius: 3,
                                  bgcolor: "#f1f5f9",
                                  "& .MuiLinearProgress-bar": { bgcolor: corCarga, borderRadius: 3 },
                                }}
                              />
                            </Box>
                            <Typography variant="caption" fontWeight={700} sx={{ color: corCarga, minWidth: 32, textAlign: "right" }}>
                              {p.cargaPct}%
                            </Typography>
                          </Box>
                        </TableCell>

                        {/* Atrasados */}
                        <TableCell align="center">
                          {p.atrasados > 0
                            ? <Chip label={p.atrasados} size="small"
                                sx={{ height: 20, fontSize: "0.7rem", fontWeight: 700, bgcolor: "#fff5f5", color: "#ef4444" }} />
                            : <Typography variant="caption" color="text.disabled">—</Typography>
                          }
                        </TableCell>

                        {/* Cursos */}
                        <TableCell sx={{ pr: 3 }}>
                          <Tooltip title={p.cursos.join(", ")} disableHoverListener={p.cursos.length <= 2}>
                            <Box sx={{ display: "flex", gap: 0.5, flexWrap: "nowrap", alignItems: "center" }}>
                              {p.cursos.slice(0, 2).map((c) => (
                                <Typography key={c} variant="caption"
                                  sx={{ bgcolor: "#f1f5f9", borderRadius: 1, px: 0.75, py: 0.25,
                                    fontFamily: "monospace", fontSize: "0.6rem", fontWeight: 600,
                                    color: "text.secondary", whiteSpace: "nowrap" }}>
                                  {c}
                                </Typography>
                              ))}
                              {p.cursos.length > 2 && (
                                <Typography variant="caption" color="text.disabled" sx={{ fontSize: "0.65rem" }}>
                                  +{p.cursos.length - 2}
                                </Typography>
                              )}
                            </Box>
                          </Tooltip>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </TableContainer>
          )}

          {/* Legenda de carga */}
          {!isLoading && pessoasFiltradas.length > 0 && (
            <Box sx={{ px: 3, py: 1.5, borderTop: "1px solid", borderColor: "divider",
              display: "flex", gap: 3, alignItems: "center" }}>
              <Typography variant="caption" color="text.disabled" sx={{ fontWeight: 600 }}>CARGA:</Typography>
              {[
                { cor: "#10b981", label: "< 50% — Disponível" },
                { cor: "#f59e0b", label: "50-79% — Ocupado" },
                { cor: "#ef4444", label: "≥ 80% — Sobrecarregado" },
              ].map((l) => (
                <Box key={l.label} sx={{ display: "flex", alignItems: "center", gap: 0.75 }}>
                  <Box sx={{ width: 10, height: 10, borderRadius: "50%", bgcolor: l.cor }} />
                  <Typography variant="caption" color="text.secondary">{l.label}</Typography>
                </Box>
              ))}
            </Box>
          )}
        </CardContent>
      </Card>

      {/* ── Carga por Papel ───────────────────────────────────────────────────── */}
      <Card sx={{ mb: 3 }}>
        <CardContent sx={{ p: 0, pb: "0 !important" }}>
          <Box sx={{ px: 3, py: 2, borderBottom: "1px solid", borderColor: "divider" }}>
            <Typography variant="h6" sx={{ fontWeight: 700, fontSize: "0.95rem" }}>Distribuição por Papel</Typography>
          </Box>
          {isLoading ? (
            <Box sx={{ p: 3, display: "flex", flexDirection: "column", gap: 2 }}>
              {[1,2,3].map((i) => <Skeleton key={i} height={36} sx={{ borderRadius: 1 }} />)}
            </Box>
          ) : porPapel.length === 0 ? (
            <Box sx={{ p: 5, textAlign: "center" }}>
              <Typography color="text.secondary" variant="body2">Nenhuma etapa ativa atribuída.</Typography>
            </Box>
          ) : (
            <Box sx={{ p: 3, display: "flex", flexDirection: "column", gap: 2.5 }}>
              {(() => {
                const maxCarga = Math.max(...porPapel.map((p) => p.emAndamento + p.pendente), 1);
                return porPapel.map((p) => {
                  const total = p.emAndamento + p.pendente;
                  const pct   = Math.round((total / maxCarga) * 100);
                  const cor   = pct >= 80 ? "#ef4444" : pct >= 50 ? "#f59e0b" : "#10b981";
                  const cores = PAPEL_CORES[p.papel] ?? PAPEL_CORES.CONTEUDISTA!;
                  return (
                    <Box key={p.papel}>
                      <Box sx={{ display: "flex", justifyContent: "space-between", mb: 0.75, alignItems: "center" }}>
                        <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                          <Box sx={{ width: 10, height: 10, borderRadius: "50%", bgcolor: cores.border }} />
                          <Typography variant="body2" fontWeight={600}>{p.label}</Typography>
                        </Box>
                        <Box sx={{ display: "flex", alignItems: "center", gap: 1.5 }}>
                          <Typography variant="caption" color="text.secondary">
                            {p.emAndamento > 0 && <span style={{ color: "#2b7cee", fontWeight: 700 }}>{p.emAndamento} ativos</span>}
                            {p.emAndamento > 0 && p.pendente > 0 && " · "}
                            {p.pendente > 0 && `${p.pendente} pendentes`}
                          </Typography>
                          <Typography variant="body2" fontWeight={800} sx={{ color: cor, minWidth: 36, textAlign: "right" }}>
                            {pct}%
                          </Typography>
                        </Box>
                      </Box>
                      <Box sx={{ height: 8, borderRadius: 4, bgcolor: "#f1f5f9", overflow: "hidden", display: "flex" }}>
                        <Box sx={{ width: `${(p.emAndamento / maxCarga) * 100}%`, bgcolor: "#2b7cee", transition: "width 0.4s" }} />
                        <Box sx={{ width: `${(p.pendente / maxCarga) * 100}%`, bgcolor: "#bfdbfe", transition: "width 0.4s" }} />
                      </Box>
                    </Box>
                  );
                });
              })()}
              <Box sx={{ display: "flex", gap: 2, pt: 0.5 }}>
                {[{ color: "#2b7cee", label: "Em andamento" }, { color: "#bfdbfe", label: "Pendente" }].map((l) => (
                  <Box key={l.label} sx={{ display: "flex", alignItems: "center", gap: 0.5 }}>
                    <Box sx={{ width: 10, height: 10, borderRadius: 2, bgcolor: l.color }} />
                    <Typography variant="caption" color="text.secondary">{l.label}</Typography>
                  </Box>
                ))}
              </Box>
            </Box>
          )}
        </CardContent>
      </Card>

      {/* ── Timeline de Alocação ─────────────────────────────────────────────── */}
      <Card>
        <CardContent sx={{ p: 0, pb: "0 !important" }}>
          <Box sx={{ px: 3, py: 2, display: "flex", alignItems: "center", justifyContent: "space-between",
            borderBottom: "1px solid", borderColor: "divider" }}>
            <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
              <CalendarMonthIcon sx={{ fontSize: 18, color: "text.secondary" }} />
              <Typography variant="h6" sx={{ fontWeight: 700, fontSize: "0.95rem" }}>Agenda de Etapas</Typography>
            </Box>
            <ToggleButtonGroup value={view} exclusive onChange={(_, v) => v && setView(v)} size="small">
              <ToggleButton value="semana" sx={{ px: 2, py: 0.5, fontSize: "0.75rem", fontWeight: 600 }}>Semana</ToggleButton>
              <ToggleButton value="mes"    sx={{ px: 2, py: 0.5, fontSize: "0.75rem", fontWeight: 600 }}>Mês</ToggleButton>
            </ToggleButtonGroup>
          </Box>

          {isLoading ? (
            <Box sx={{ p: 3, display: "flex", flexDirection: "column", gap: 1.5 }}>
              {[1,2,3,4].map((i) => <Skeleton key={i} height={64} sx={{ borderRadius: 1 }} />)}
            </Box>
          ) : porResponsavel.length === 0 ? (
            <Box sx={{ p: 5, textAlign: "center" }}>
              <Typography color="text.secondary" variant="body2">Nenhuma etapa ativa atribuída.</Typography>
            </Box>
          ) : (
            <AgendaTimeline pessoas={porResponsavel} view={view} />
          )}
        </CardContent>
      </Card>
    </Box>
  );
}

// ─── KPI Card ─────────────────────────────────────────────────────────────────

function KpiCard({ label, value, icon, cor, bg }: {
  label: string; value: string; icon: React.ReactNode; cor: string; bg: string;
}) {
  return (
    <Card>
      <CardContent sx={{ p: 2.5, pb: "20px !important" }}>
        <Box sx={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", mb: 1.5 }}>
          <Box sx={{ bgcolor: bg, p: 1, borderRadius: 1.5, display: "flex", color: cor }}>{icon}</Box>
        </Box>
        <Typography sx={{ fontSize: "1.75rem", fontWeight: 800, color: cor, lineHeight: 1 }}>{value}</Typography>
        <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5, display: "block" }}>{label}</Typography>
      </CardContent>
    </Card>
  );
}

// ─── Timeline ─────────────────────────────────────────────────────────────────

function AgendaTimeline({ pessoas, view }: { pessoas: ResponsavelAlocacao[]; view: "semana" | "mes" }) {
  const hoje_    = hoje();
  const semAtual = inicioSemana(hoje_);
  const N = 7;
  const colunas: { inicio: Date; fim: Date; label: string; isHoje: boolean }[] = [];

  for (let i = -1; i < N - 1; i++) {
    if (view === "semana") {
      const ini   = addDays(semAtual, i * 7);
      const fim   = addDays(ini, 6);
      const isHoje = ini <= hoje_ && hoje_ <= fim;
      colunas.push({ inicio: ini, fim, label: fmtDia(ini), isHoje });
    } else {
      const ini   = addMonths(new Date(hoje_.getFullYear(), hoje_.getMonth(), 1), i);
      const fim   = addDays(addMonths(ini, 1), -1);
      const isHoje = ini.getFullYear() === hoje_.getFullYear() && ini.getMonth() === hoje_.getMonth();
      colunas.push({ inicio: ini, fim, label: fmtMes(ini), isHoje });
    }
  }

  const limiteInicio = colunas[0]!.inicio;
  const pessoasVisiveis = pessoas.filter((p) =>
    p.etapas.some((e) => !e.deadlinePrevisto || new Date(e.deadlinePrevisto) >= addDays(limiteInicio, -30))
  );

  const COL_W    = 140;
  const PESSOA_W = 200;

  return (
    <Box sx={{ overflowX: "auto" }}>
      <Box sx={{ minWidth: PESSOA_W + COL_W * (N + 1), pb: 2 }}>
        {/* Header */}
        <Box sx={{ display: "flex", borderBottom: "1px solid", borderColor: "divider", bgcolor: "#f8fafc", position: "sticky", top: 0, zIndex: 10 }}>
          <Box sx={{ width: PESSOA_W, flexShrink: 0, px: 3, py: 1.5 }}>
            <Typography variant="caption" fontWeight={700} color="text.secondary">PROFISSIONAL</Typography>
          </Box>
          <Box sx={{ width: COL_W, flexShrink: 0, px: 1, py: 1.5, textAlign: "center",
            borderLeft: "1px solid", borderColor: "divider", bgcolor: "#fff5f5" }}>
            <Typography variant="caption" fontWeight={700} sx={{ color: "#ef4444" }}>ATRASADO</Typography>
          </Box>
          {colunas.map((col, i) => (
            <Box key={i} sx={{
              width: COL_W, flexShrink: 0, px: 1, py: 1.5, textAlign: "center",
              borderLeft: "1px solid", borderColor: "divider",
              bgcolor: col.isHoje ? "#eff6ff" : "transparent",
            }}>
              <Typography variant="caption" fontWeight={col.isHoje ? 800 : 600}
                sx={{ color: col.isHoje ? "primary.main" : "text.secondary" }}>
                {col.label}
              </Typography>
              {col.isHoje && (
                <Typography variant="caption" sx={{ display: "block", color: "primary.main", fontSize: "0.6rem" }}>
                  ATUAL
                </Typography>
              )}
            </Box>
          ))}
        </Box>

        {/* Linhas */}
        {pessoasVisiveis.map((pessoa, pi) => {
          const atrasadas = pessoa.etapas.filter(
            (e) => e.deadlinePrevisto && new Date(e.deadlinePrevisto) < limiteInicio
          );
          return (
            <Box key={pessoa.usuarioId}>
              <Box sx={{ display: "flex", alignItems: "flex-start", minHeight: 64,
                "&:hover": { bgcolor: "action.hover" },
                borderBottom: pi < pessoasVisiveis.length - 1 ? "1px solid" : "none",
                borderColor: "divider" }}>
                <Box sx={{ width: PESSOA_W, flexShrink: 0, px: 2, py: 1.5, display: "flex", alignItems: "flex-start", gap: 1.5 }}>
                  <Avatar sx={{ width: 34, height: 34, fontSize: "0.75rem", fontWeight: 700,
                    bgcolor: pessoa.emAndamento > 0 ? "primary.main" : "#94a3b8", flexShrink: 0, mt: 0.25 }}>
                    {initials(pessoa.nome)}
                  </Avatar>
                  <Box sx={{ minWidth: 0 }}>
                    <Typography variant="body2" fontWeight={600} noWrap>{pessoa.nome}</Typography>
                    <Typography variant="caption" color="text.disabled" noWrap sx={{ display: "block" }}>{pessoa.email}</Typography>
                    <Box sx={{ display: "flex", gap: 0.5, mt: 0.5 }}>
                      {pessoa.emAndamento > 0 && (
                        <Chip label={`${pessoa.emAndamento} ativ.`} size="small"
                          sx={{ height: 16, fontSize: "0.6rem", fontWeight: 700, bgcolor: "#eff6ff", color: "#2b7cee" }} />
                      )}
                      {pessoa.pendente > 0 && (
                        <Chip label={`${pessoa.pendente} pend.`} size="small"
                          sx={{ height: 16, fontSize: "0.6rem", bgcolor: "#f8fafc", color: "#64748b" }} />
                      )}
                    </Box>
                  </Box>
                </Box>
                <Box sx={{ width: COL_W, flexShrink: 0, px: 0.75, py: 1, borderLeft: "1px solid", borderColor: "divider",
                  bgcolor: atrasadas.length > 0 ? "#fff5f5" : "transparent", alignSelf: "stretch",
                  display: "flex", flexDirection: "column", gap: 0.5 }}>
                  {atrasadas.map((e) => <EtapaChip key={e.etapaId} etapa={e} overdue />)}
                </Box>
                {colunas.map((col, ci) => {
                  const etapasCol = pessoa.etapas.filter((e) => {
                    if (!e.deadlinePrevisto) return false;
                    const dl = new Date(e.deadlinePrevisto);
                    return dl >= col.inicio && dl <= col.fim;
                  });
                  return (
                    <Box key={ci} sx={{
                      width: COL_W, flexShrink: 0, px: 0.75, py: 1,
                      borderLeft: "1px solid", borderColor: "divider",
                      bgcolor: col.isHoje ? "#f0f7ff" : "transparent",
                      alignSelf: "stretch", display: "flex", flexDirection: "column", gap: 0.5,
                    }}>
                      {etapasCol.map((e) => <EtapaChip key={e.etapaId} etapa={e} />)}
                    </Box>
                  );
                })}
              </Box>
            </Box>
          );
        })}
      </Box>
    </Box>
  );
}

// ─── Chip de Etapa ────────────────────────────────────────────────────────────

function EtapaChip({ etapa, overdue }: { etapa: EtapaAlocacao; overdue?: boolean }) {
  const cores = overdue
    ? { bg: "#fff1f2", border: "#fda4af", text: "#be123c" }
    : (PAPEL_CORES[etapa.papel] ?? { bg: "#f8fafc", border: "#e2e8f0", text: "#475569" });

  const dlFmt = etapa.deadlinePrevisto
    ? new Date(etapa.deadlinePrevisto).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" })
    : "";

  return (
    <Tooltip
      title={
        <Box>
          <Typography variant="caption" fontWeight={700}>{etapa.oaCodigo}</Typography>
          <Typography variant="caption" sx={{ display: "block" }}>{etapa.etapaNome}</Typography>
          <Typography variant="caption" color="grey.400">{etapa.cursoCodigo}</Typography>
          {dlFmt && <Typography variant="caption" sx={{ display: "block" }}>DL: {dlFmt}</Typography>}
        </Box>
      }
      arrow
    >
      <Box sx={{
        bgcolor: cores.bg, border: `1px solid ${cores.border}`, borderRadius: 1,
        px: 0.75, py: 0.25, cursor: "default",
        borderLeft: `3px solid ${cores.border}`,
      }}>
        <Typography variant="caption" fontWeight={700} sx={{ color: cores.text, fontSize: "0.65rem", display: "block", lineHeight: 1.3 }}>
          {etapa.oaCodigo}
        </Typography>
        <Typography variant="caption" sx={{ color: cores.text + "bb", fontSize: "0.6rem", display: "block", lineHeight: 1.2 }}>
          {etapa.etapaNome}
          {etapa.status === "EM_ANDAMENTO" && " ●"}
        </Typography>
      </Box>
    </Tooltip>
  );
}
