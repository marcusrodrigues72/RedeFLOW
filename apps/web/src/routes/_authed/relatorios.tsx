import { createFileRoute, Link } from "@tanstack/react-router";
import {
  Box, Typography, Card, CardContent, LinearProgress,
  Chip, Skeleton, Alert, Table, TableHead, TableRow,
  TableCell, TableBody, Divider, Collapse, IconButton,
  Tooltip, Select, MenuItem, FormControl, InputLabel,
} from "@mui/material";
import TrendingUpIcon        from "@mui/icons-material/TrendingUp";
import WarningAmberIcon      from "@mui/icons-material/WarningAmber";
import AccountTreeIcon       from "@mui/icons-material/AccountTree";
import ShowChartIcon         from "@mui/icons-material/ShowChart";
import SwapVertIcon          from "@mui/icons-material/SwapVert";
import KeyboardArrowDownIcon from "@mui/icons-material/KeyboardArrowDown";
import KeyboardArrowUpIcon   from "@mui/icons-material/KeyboardArrowUp";
import OpenInNewIcon         from "@mui/icons-material/OpenInNew";
import CheckCircleIcon       from "@mui/icons-material/CheckCircle";
import DownloadIcon          from "@mui/icons-material/Download";
import { useState }          from "react";
import type { ReactNode }    from "react";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip as RTooltip,
  ResponsiveContainer, ReferenceLine,
} from "recharts";
import { useProgressoCursos, usePipelineStatus, useAtrasosResponsavel, useBurndown, useDesvioDeadline, downloadRelatorio } from "@/lib/api/relatorios";
import { useDashboardStats, useCursos } from "@/lib/api/cursos";
import type { StatusOA }     from "shared";

export const Route = createFileRoute("/_authed/relatorios")({
  component: RelatoriosPage,
});

// ─── Config visual ────────────────────────────────────────────────────────────

const STATUS_OA_CONFIG: Record<StatusOA, { label: string; color: string; bg: string }> = {
  PENDENTE:     { label: "Pendente",     color: "#64748b", bg: "#f8fafc" },
  EM_ANDAMENTO: { label: "Em Produção",  color: "#2b7cee", bg: "#eff6ff" },
  BLOQUEADO:    { label: "Bloqueado",    color: "#ef4444", bg: "#fff5f5" },
  CONCLUIDO:    { label: "Concluído",    color: "#10b981", bg: "#f0fdf4" },
};

const STATUS_CURSO_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
  ATIVO:     { label: "Ativo",     color: "#10b981", bg: "#f0fdf4" },
  RASCUNHO:  { label: "Rascunho",  color: "#64748b", bg: "#f8fafc" },
  ARQUIVADO: { label: "Arquivado", color: "#94a3b8", bg: "#f1f5f9" },
};

function fmtData(iso: string | null | undefined) {
  if (!iso) return null;
  return new Date(iso).toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "numeric" });
}

// ─── Página ───────────────────────────────────────────────────────────────────

function RelatoriosPage() {
  const { data: todosCursos = [] }                                              = useCursos();
  const [cursoId, setCursoId]                                                   = useState<string | null>(null);

  const { data: todosProgresso = [], isLoading: loadCursos, isError: errCursos } = useProgressoCursos();
  const { data: pipeline, isLoading: loadPipeline, isError: errPipeline }        = usePipelineStatus(cursoId);
  const { data: atrasos  = [], isLoading: loadAtrasos,  isError: errAtrasos  }   = useAtrasosResponsavel(cursoId);
  const { data: stats,         isLoading: loadStats                           }   = useDashboardStats();
  const { data: desvio,        isLoading: loadDesvio,   isError: errDesvio   }   = useDesvioDeadline(cursoId);

  // Filtra progresso ao curso selecionado (client-side)
  const cursos = cursoId ? todosProgresso.filter((c) => c.id === cursoId) : todosProgresso;

  // KPIs usam a mesma fonte do Dashboard para consistência
  const totalOAs     = stats?.totalOAs    ?? 0;
  const emProducao   = stats?.emProducao  ?? 0;
  const concluidos   = stats?.oasConcluidos ?? 0;
  const totalAtrasos = stats?.oasAtrasados  ?? 0;

  const cursoSelecionado = todosCursos.find((c) => c.id === cursoId);

  return (
    <Box>
      <Box sx={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", mb: 3, flexWrap: "wrap", gap: 2 }}>
        <Box>
          <Typography sx={{ fontSize: "1.375rem", fontWeight: 800, mb: 0.5 }}>Relatórios</Typography>
          <Typography variant="body2" color="text.secondary">
            Visão gerencial da produção de conteúdo
          </Typography>
        </Box>

        {/* ── Filtro global de curso ─────────────────────────────────────────── */}
        <FormControl size="small" sx={{ minWidth: 300 }}>
          <InputLabel>Filtrar por curso</InputLabel>
          <Select
            value={cursoId ?? ""}
            label="Filtrar por curso"
            onChange={(e) => setCursoId(e.target.value || null)}
          >
            <MenuItem value=""><em>Todos os cursos</em></MenuItem>
            {todosCursos.map((c) => (
              <MenuItem key={c.id} value={c.id}>{c.nome}</MenuItem>
            ))}
          </Select>
        </FormControl>
      </Box>

      {cursoSelecionado && (
        <Box sx={{ mb: 2.5, display: "flex", alignItems: "center", gap: 1 }}>
          <Chip
            label={cursoSelecionado.nome}
            onDelete={() => setCursoId(null)}
            color="primary"
            size="small"
            sx={{ fontWeight: 600 }}
          />
          <Typography variant="caption" color="text.secondary">
            Todos os painéis estão filtrados para este curso.
          </Typography>
        </Box>
      )}

      {/* ── KPIs ──────────────────────────────────────────────────────────────── */}
      <Box sx={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 2, mb: 3 }}>
        {loadStats ? (
          Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} height={90} sx={{ borderRadius: 2 }} />)
        ) : (
          <>
            <KpiCard label="Total de OAs"  value={totalOAs}   color="#2b7cee" />
            <KpiCard label="Em Produção"   value={emProducao} color="#f59e0b" />
            <KpiCard label="Concluídos"    value={concluidos} color="#10b981" />
            <KpiCard label="Com Atraso"    value={totalAtrasos} color="#ef4444" sub="etapas atrasadas" />
          </>
        )}
      </Box>

      {/* ── Progresso por Curso ───────────────────────────────────────────────── */}
      <Section title={cursoId ? "Progresso do Curso" : "Progresso por Curso"} icon={<TrendingUpIcon sx={{ fontSize: 18 }} />} mb
        onExport={() => downloadRelatorio("/relatorios/export/progresso", cursoId)}>
        {errCursos ? (
          <Alert severity="error" sx={{ m: 2 }}>Erro ao carregar dados.</Alert>
        ) : loadCursos ? (
          <LoadingRows />
        ) : cursos.length === 0 ? (
          <Empty msg="Nenhum curso encontrado." />
        ) : (
          <Box sx={{ display: "flex", flexDirection: "column" }}>
            {cursos.map((curso, i) => {
              const sc = STATUS_CURSO_CONFIG[curso.status] ?? STATUS_CURSO_CONFIG["RASCUNHO"]!;
              const barColor = curso.progressoPct >= 80 ? "#10b981" : curso.progressoPct >= 40 ? "#f59e0b" : "#2b7cee";
              return (
                <Box key={curso.id}>
                  <Box sx={{ px: 3, py: 2.5 }}>
                    <Box sx={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", mb: 1.5 }}>
                      <Box sx={{ display: "flex", alignItems: "center", gap: 1.5, flexWrap: "wrap" }}>
                        <Chip
                          label={sc.label} size="small"
                          sx={{ height: 18, fontSize: "0.65rem", fontWeight: 700, bgcolor: sc.bg, color: sc.color }}
                        />
                        <Typography variant="body2" fontWeight={700}>{curso.nome}</Typography>
                        <Typography variant="caption" sx={{ fontFamily: "monospace", color: "text.disabled" }}>
                          {curso.codigo}
                        </Typography>
                        {curso.oasAtrasados > 0 && (
                          <Chip
                            icon={<WarningAmberIcon sx={{ fontSize: "0.75rem !important" }} />}
                            label={`${curso.oasAtrasados} atraso${curso.oasAtrasados > 1 ? "s" : ""}`}
                            size="small"
                            sx={{ height: 18, fontSize: "0.65rem", bgcolor: "#fff5f5", color: "#ef4444", fontWeight: 700 }}
                          />
                        )}
                      </Box>
                      <Box sx={{ display: "flex", alignItems: "center", gap: 2, flexShrink: 0 }}>
                        <Box sx={{ textAlign: "right" }}>
                          <Typography variant="body2" fontWeight={800} sx={{ color: barColor, fontSize: "1.1rem" }}>
                            {curso.progressoPct}%
                          </Typography>
                          <Typography variant="caption" color="text.secondary">
                            {curso.oasConcluidos}/{curso.totalOAs} OAs
                          </Typography>
                        </Box>
                        <Tooltip title="Ver curso">
                          <IconButton
                            size="small" component={Link} to={`/cursos/${curso.id}`}
                            sx={{ color: "text.disabled", "&:hover": { color: "primary.main" } }}
                          >
                            <OpenInNewIcon sx={{ fontSize: 16 }} />
                          </IconButton>
                        </Tooltip>
                      </Box>
                    </Box>

                    <LinearProgress
                      variant="determinate" value={curso.progressoPct}
                      sx={{
                        height: 8, borderRadius: 4, bgcolor: "#f1f5f9", mb: 1,
                        "& .MuiLinearProgress-bar": { bgcolor: barColor, borderRadius: 4 },
                      }}
                    />

                    {(curso.dataInicioEstimada || curso.dataFimEstimada) && (
                      <Box sx={{ display: "flex", gap: 3 }}>
                        {curso.dataInicioEstimada && (
                          <Typography variant="caption" color="text.disabled">
                            Início: <strong>{fmtData(curso.dataInicioEstimada)}</strong>
                          </Typography>
                        )}
                        {curso.dataFimEstimada && (
                          <Typography variant="caption" color="text.disabled">
                            Fim estimado: <strong>{fmtData(curso.dataFimEstimada)}</strong>
                          </Typography>
                        )}
                      </Box>
                    )}
                  </Box>
                  {i < cursos.length - 1 && <Divider />}
                </Box>
              );
            })}
          </Box>
        )}
      </Section>

      {/* ── Burndown de OAs ──────────────────────────────────────────────────── */}
      <Section title="Burndown de OAs — Planejado vs. Real" icon={<ShowChartIcon sx={{ fontSize: 18 }} />} mb>
        {!cursoId ? (
          <Box sx={{ p: 4, textAlign: "center" }}>
            <Typography variant="body2" color="text.secondary">
              Selecione um curso no filtro acima para visualizar o burndown.
            </Typography>
          </Box>
        ) : (
          <>
            <Box sx={{ px: 3, pt: 2, pb: 1, display: "flex", gap: 2 }}>
              {[
                { label: "Planejado (ideal)", color: "#94a3b8", dash: true },
                { label: "Realizado",         color: "#2b7cee", dash: false },
              ].map((l) => (
                <Box key={l.label} sx={{ display: "flex", alignItems: "center", gap: 0.75 }}>
                  <Box sx={{ width: 24, height: 2, borderTop: l.dash ? "2px dashed" : "2px solid", borderColor: l.color }} />
                  <Typography variant="caption" color="text.secondary">{l.label}</Typography>
                </Box>
              ))}
            </Box>
            <Divider />
            <BurndownChart cursoId={cursoId} />
          </>
        )}
      </Section>

      {/* ── Desvio Deadline ───────────────────────────────────────────────────── */}
      <Section title="Desvio de Deadline — Previsto vs. Real" icon={<SwapVertIcon sx={{ fontSize: 18 }} />} mb
        onExport={() => downloadRelatorio("/relatorios/export/desvio", cursoId)}>
        {errDesvio ? (
          <Alert severity="error" sx={{ m: 2 }}>Erro ao carregar dados.</Alert>
        ) : loadDesvio ? (
          <LoadingRows n={4} />
        ) : !desvio || desvio.resumo.length === 0 ? (
          <Empty msg="Nenhuma etapa com deadline real registrado ainda." />
        ) : (
          <Box>
            {/* Resumo por etapa */}
            <Table size="small">
              <TableHead>
                <TableRow sx={{ bgcolor: "#f8fafc" }}>
                  {["Etapa", "Total", "No Prazo", "Adiantado", "Atrasado", "Desvio Médio"].map((h) => (
                    <TableCell key={h} sx={{ fontWeight: 700, fontSize: "0.72rem", color: "text.secondary", py: 1.25, whiteSpace: "nowrap" }}>{h}</TableCell>
                  ))}
                </TableRow>
              </TableHead>
              <TableBody>
                {desvio.resumo.map((r) => (
                  <TableRow key={r.etapa} sx={{ "&:hover": { bgcolor: "action.hover" } }}>
                    <TableCell sx={{ py: 1.5, fontWeight: 600, fontSize: "0.82rem" }}>{r.etapa}</TableCell>
                    <TableCell align="center">
                      <Typography variant="caption" fontWeight={700}>{r.total}</Typography>
                    </TableCell>
                    <TableCell align="center">
                      {r.noPrazo > 0
                        ? <Chip label={r.noPrazo} size="small" sx={{ height: 20, fontSize: "0.72rem", fontWeight: 700, bgcolor: "#f0fdf4", color: "#10b981" }} />
                        : <Typography variant="caption" color="text.disabled">—</Typography>}
                    </TableCell>
                    <TableCell align="center">
                      {r.adiantado > 0
                        ? <Chip label={r.adiantado} size="small" sx={{ height: 20, fontSize: "0.72rem", fontWeight: 700, bgcolor: "#eff6ff", color: "#2b7cee" }} />
                        : <Typography variant="caption" color="text.disabled">—</Typography>}
                    </TableCell>
                    <TableCell align="center">
                      {r.atrasado > 0
                        ? <Chip label={r.atrasado} size="small" sx={{ height: 20, fontSize: "0.72rem", fontWeight: 700, bgcolor: "#fff5f5", color: "#ef4444" }} />
                        : <Typography variant="caption" color="text.disabled">—</Typography>}
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2" fontWeight={700}
                        sx={{ color: r.desvioMedio > 5 ? "#ef4444" : r.desvioMedio > 0 ? "#f59e0b" : r.desvioMedio < 0 ? "#2b7cee" : "#10b981" }}>
                        {r.desvioMedio > 0 ? `+${r.desvioMedio}d` : `${r.desvioMedio}d`}
                      </Typography>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Box>
        )}
      </Section>

      {/* ── Grid inferior ─────────────────────────────────────────────────────── */}
      <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", lg: "3fr 2fr" }, gap: 3 }}>

        {/* ── Pipeline por Etapa ──────────────────────────────────────────────── */}
        <Section title="Pipeline por Etapa" icon={<AccountTreeIcon sx={{ fontSize: 18 }} />}
          onExport={() => downloadRelatorio("/relatorios/export/atrasos", cursoId)}>
          {errPipeline ? (
            <Alert severity="error" sx={{ m: 2 }}>Erro ao carregar dados.</Alert>
          ) : loadPipeline ? (
            <LoadingRows n={7} />
          ) : !pipeline || pipeline.porEtapa.length === 0 ? (
            <Empty msg="Nenhuma etapa encontrada." />
          ) : (
            <Box>
              {/* Legenda */}
              <Box sx={{ px: 3, pt: 2, pb: 1, display: "flex", gap: 2, flexWrap: "wrap" }}>
                {[
                  { label: "Em andamento", color: "#2b7cee" },
                  { label: "Pendente",     color: "#94a3b8" },
                  { label: "Bloqueada",    color: "#ef4444" },
                  { label: "Concluída",    color: "#10b981" },
                ].map((l) => (
                  <Box key={l.label} sx={{ display: "flex", alignItems: "center", gap: 0.5 }}>
                    <Box sx={{ width: 10, height: 10, borderRadius: "50%", bgcolor: l.color }} />
                    <Typography variant="caption" color="text.secondary">{l.label}</Typography>
                  </Box>
                ))}
              </Box>
              <Divider />
              <Table size="small">
                <TableHead>
                  <TableRow sx={{ bgcolor: "#f8fafc" }}>
                    {["Etapa", "Em Andamento", "Pendente", "Bloqueada", "Concluída", "Progresso"].map((h) => (
                      <TableCell key={h} sx={{ fontWeight: 700, fontSize: "0.72rem", color: "text.secondary", py: 1.25, whiteSpace: "nowrap" }}>{h}</TableCell>
                    ))}
                  </TableRow>
                </TableHead>
                <TableBody>
                  {pipeline.porEtapa.map((e) => {
                    const pct = e.total > 0 ? Math.round((e.concluida / e.total) * 100) : 0;
                    return (
                      <TableRow key={e.etapa} sx={{ "&:hover": { bgcolor: "action.hover" } }}>
                        <TableCell sx={{ py: 1.5, fontWeight: 600, fontSize: "0.82rem" }}>{e.etapa}</TableCell>
                        <TableCell align="center">
                          {e.emAndamento > 0 ? (
                            <Chip label={e.emAndamento} size="small"
                              sx={{ height: 20, fontSize: "0.72rem", fontWeight: 700, bgcolor: "#eff6ff", color: "#2b7cee" }} />
                          ) : <Typography variant="caption" color="text.disabled">—</Typography>}
                        </TableCell>
                        <TableCell align="center">
                          {e.pendente > 0 ? (
                            <Chip label={e.pendente} size="small"
                              sx={{ height: 20, fontSize: "0.72rem", fontWeight: 700, bgcolor: "#f8fafc", color: "#64748b" }} />
                          ) : <Typography variant="caption" color="text.disabled">—</Typography>}
                        </TableCell>
                        <TableCell align="center">
                          {e.bloqueada > 0 ? (
                            <Chip label={e.bloqueada} size="small"
                              sx={{ height: 20, fontSize: "0.72rem", fontWeight: 700, bgcolor: "#fff5f5", color: "#ef4444" }} />
                          ) : <Typography variant="caption" color="text.disabled">—</Typography>}
                        </TableCell>
                        <TableCell align="center">
                          <Chip label={e.concluida} size="small"
                            sx={{ height: 20, fontSize: "0.72rem", fontWeight: 700, bgcolor: "#f0fdf4", color: "#10b981" }} />
                        </TableCell>
                        <TableCell sx={{ minWidth: 120 }}>
                          <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                            <Box sx={{ flex: 1, height: 6, borderRadius: 3, bgcolor: "#f1f5f9", overflow: "hidden", display: "flex" }}>
                              <Box sx={{ width: `${pct}%`, bgcolor: "#10b981", transition: "width 0.4s" }} />
                              <Box sx={{ width: `${e.total > 0 ? (e.emAndamento / e.total) * 100 : 0}%`, bgcolor: "#2b7cee" }} />
                              <Box sx={{ width: `${e.total > 0 ? (e.bloqueada / e.total) * 100 : 0}%`, bgcolor: "#ef4444" }} />
                            </Box>
                            <Typography variant="caption" fontWeight={700} sx={{ minWidth: 28, color: pct >= 80 ? "#10b981" : "text.secondary" }}>
                              {pct}%
                            </Typography>
                          </Box>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>

              {/* Resumo do status dos OAs */}
              <Divider />
              <Box sx={{ px: 3, py: 2 }}>
                <Typography variant="caption" color="text.disabled" sx={{ letterSpacing: "0.06em", fontWeight: 700 }}>
                  STATUS DOS OAs
                </Typography>
                <Box sx={{ display: "flex", gap: 1.5, mt: 1, flexWrap: "wrap" }}>
                  {pipeline.porStatusOA.map((s) => {
                    const cfg = STATUS_OA_CONFIG[s.status as StatusOA] ?? STATUS_OA_CONFIG.PENDENTE;
                    return (
                      <Box key={s.status} sx={{ display: "flex", alignItems: "center", gap: 1,
                        bgcolor: cfg.bg, px: 1.5, py: 0.75, borderRadius: 1.5 }}>
                        <Box sx={{ width: 7, height: 7, borderRadius: "50%", bgcolor: cfg.color }} />
                        <Typography variant="caption" color="text.secondary">{cfg.label}</Typography>
                        <Typography variant="caption" fontWeight={800} sx={{ color: cfg.color }}>{s.total}</Typography>
                      </Box>
                    );
                  })}
                </Box>
              </Box>
            </Box>
          )}
        </Section>

        {/* ── Atrasos por Responsável ──────────────────────────────────────────── */}
        <Section title="Atrasos por Responsável" icon={<WarningAmberIcon sx={{ fontSize: 18, color: "#ef4444" }} />}
          onExport={() => downloadRelatorio("/relatorios/export/atrasos", cursoId)}>
          {errAtrasos ? (
            <Alert severity="error" sx={{ m: 2 }}>Erro ao carregar dados.</Alert>
          ) : loadAtrasos ? (
            <LoadingRows n={4} />
          ) : atrasos.length === 0 ? (
            <Empty msg="Nenhuma etapa em atraso." ok />
          ) : (
            <AtrasosTable atrasos={atrasos} />
          )}
        </Section>
      </Box>
    </Box>
  );
}

// ─── Burndown Chart ───────────────────────────────────────────────────────────

function BurndownChart({ cursoId }: { cursoId: string }) {
  const { data, isLoading, isError } = useBurndown(cursoId);

  if (isLoading) return <LoadingRows n={5} />;
  if (isError || !data) return <Alert severity="error" sx={{ m: 2 }}>Erro ao carregar burndown.</Alert>;
  if (data.totalOAs === 0) return <Empty msg="Nenhum OA encontrado para este curso." />;

  const hoje = new Date().toISOString().slice(0, 10);
  const pct  = data.totalOAs > 0
    ? Math.round(((data.series.find((p) => p.realizado !== null && p.data <= hoje)?.realizado ?? data.totalOAs) / data.totalOAs) * -1 + 100)
    : 0;
  const concluidos = data.series.reduceRight<number | null>((acc, p) => acc !== null ? acc : (p.realizado !== null ? data.totalOAs - p.realizado : null), null) ?? 0;

  const formatX = (v: string) => {
    const d = new Date(v + "T12:00:00");
    return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
  };

  return (
    <Box sx={{ px: 3, py: 2 }}>
      {/* Mini KPIs */}
      <Box sx={{ display: "flex", gap: 3, mb: 2.5 }}>
        <Box>
          <Typography variant="caption" color="text.secondary">Total de OAs</Typography>
          <Typography fontWeight={800} sx={{ fontSize: "1.25rem", color: "#2b7cee" }}>{data.totalOAs}</Typography>
        </Box>
        <Box>
          <Typography variant="caption" color="text.secondary">Concluídos</Typography>
          <Typography fontWeight={800} sx={{ fontSize: "1.25rem", color: "#10b981" }}>{concluidos}</Typography>
        </Box>
        <Box>
          <Typography variant="caption" color="text.secondary">Progresso</Typography>
          <Typography fontWeight={800} sx={{ fontSize: "1.25rem", color: pct >= 70 ? "#10b981" : pct >= 40 ? "#f59e0b" : "#ef4444" }}>{pct}%</Typography>
        </Box>
        <Box>
          <Typography variant="caption" color="text.secondary">Período</Typography>
          <Typography variant="body2" fontWeight={600}>
            {new Date(data.dataInicio + "T12:00:00").toLocaleDateString("pt-BR", { day: "2-digit", month: "short" })}
            {" → "}
            {new Date(data.dataFim + "T12:00:00").toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "numeric" })}
          </Typography>
        </Box>
      </Box>

      <ResponsiveContainer width="100%" height={280}>
        <LineChart data={data.series} margin={{ top: 4, right: 16, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
          <XAxis
            dataKey="data"
            tickFormatter={formatX}
            tick={{ fontSize: 11, fill: "#94a3b8" }}
            tickLine={false}
            interval="preserveStartEnd"
          />
          <YAxis
            tick={{ fontSize: 11, fill: "#94a3b8" }}
            tickLine={false}
            axisLine={false}
            domain={[0, data.totalOAs]}
            allowDecimals={false}
            label={{ value: "OAs restantes", angle: -90, position: "insideLeft", offset: 12, style: { fontSize: 10, fill: "#94a3b8" } }}
          />
          <RTooltip
            formatter={(v: unknown, name: unknown) => {
              const val = v as number | null | undefined;
              const key = name as string;
              return val != null ? [val, key === "planejado" ? "Planejado" : "Realizado"] : ["-", key];
            }}
            labelFormatter={(l: unknown) => new Date(String(l) + "T12:00:00").toLocaleDateString("pt-BR")}
            contentStyle={{ fontSize: 12, borderRadius: 8 }}
          />
          <ReferenceLine
            x={hoje}
            stroke="#ef4444"
            strokeDasharray="4 2"
            label={{ value: "Hoje", position: "top", fontSize: 10, fill: "#ef4444" }}
          />
          <Line
            type="monotone" dataKey="planejado" name="planejado"
            stroke="#94a3b8" strokeDasharray="6 3" strokeWidth={2}
            dot={false} activeDot={{ r: 3 }}
          />
          <Line
            type="monotone" dataKey="realizado" name="realizado"
            stroke="#2b7cee" strokeWidth={2.5}
            dot={false} activeDot={{ r: 4 }}
            connectNulls={false}
          />
        </LineChart>
      </ResponsiveContainer>
    </Box>
  );
}

// ─── Tabela de Atrasos com linhas expansíveis ─────────────────────────────────

function AtrasosTable({ atrasos }: { atrasos: { nome: string; email: string; total: number; detalhes: { oa: string; etapa: string; diasAtraso: number }[] }[] }) {
  const [expanded, setExpanded] = useState<string | null>(null);

  return (
    <Table size="small">
      <TableHead>
        <TableRow sx={{ bgcolor: "#f8fafc" }}>
          {["", "Responsável", "Atrasos", "Pior atraso"].map((h) => (
            <TableCell key={h} sx={{ fontWeight: 700, fontSize: "0.72rem", color: "text.secondary", py: 1.25 }}>{h}</TableCell>
          ))}
        </TableRow>
      </TableHead>
      <TableBody>
        {atrasos.map((r) => {
          const piorAtraso = Math.max(...r.detalhes.map((d) => d.diasAtraso));
          const isOpen = expanded === r.email;
          return (
            <>
              <TableRow
                key={r.email}
                sx={{ "&:hover": { bgcolor: "action.hover" }, cursor: "pointer" }}
                onClick={() => setExpanded(isOpen ? null : r.email)}
              >
                <TableCell sx={{ py: 1, width: 32, pr: 0 }}>
                  <IconButton size="small" sx={{ p: 0.25 }}>
                    {isOpen ? <KeyboardArrowUpIcon fontSize="small" /> : <KeyboardArrowDownIcon fontSize="small" />}
                  </IconButton>
                </TableCell>
                <TableCell sx={{ py: 1.5 }}>
                  <Typography variant="body2" fontWeight={600}>{r.nome}</Typography>
                  <Typography variant="caption" color="text.disabled">{r.email}</Typography>
                </TableCell>
                <TableCell>
                  <Chip label={r.total} size="small"
                    sx={{ height: 20, fontSize: "0.72rem", bgcolor: "#fff5f5", color: "#ef4444", fontWeight: 700 }} />
                </TableCell>
                <TableCell>
                  <Typography variant="body2" fontWeight={700}
                    sx={{ color: piorAtraso >= 14 ? "#ef4444" : piorAtraso >= 7 ? "#f59e0b" : "#64748b" }}>
                    {piorAtraso}d
                  </Typography>
                </TableCell>
              </TableRow>

              {/* Detalhe expandido */}
              <TableRow key={`${r.email}-detail`}>
                <TableCell colSpan={4} sx={{ py: 0, border: 0 }}>
                  <Collapse in={isOpen} unmountOnExit>
                    <Box sx={{ bgcolor: "#fafafa", borderLeft: "3px solid #ef4444", ml: 4, mb: 1, borderRadius: "0 4px 4px 0" }}>
                      <Table size="small">
                        <TableBody>
                          {r.detalhes
                            .sort((a, b) => b.diasAtraso - a.diasAtraso)
                            .map((d, idx) => (
                              <TableRow key={idx} sx={{ "&:last-child td": { border: 0 } }}>
                                <TableCell sx={{ py: 0.75, pl: 2 }}>
                                  <Typography variant="caption" sx={{ fontFamily: "monospace", color: "text.secondary" }}>
                                    {d.oa}
                                  </Typography>
                                </TableCell>
                                <TableCell sx={{ py: 0.75 }}>
                                  <Typography variant="caption" color="text.secondary">{d.etapa}</Typography>
                                </TableCell>
                                <TableCell sx={{ py: 0.75 }} align="right">
                                  <Chip
                                    label={`${d.diasAtraso}d`} size="small"
                                    sx={{
                                      height: 18, fontSize: "0.65rem", fontWeight: 700,
                                      bgcolor: d.diasAtraso >= 14 ? "#fff5f5" : d.diasAtraso >= 7 ? "#fffbeb" : "#f8fafc",
                                      color:   d.diasAtraso >= 14 ? "#ef4444" : d.diasAtraso >= 7 ? "#f59e0b" : "#64748b",
                                    }}
                                  />
                                </TableCell>
                              </TableRow>
                            ))}
                        </TableBody>
                      </Table>
                    </Box>
                  </Collapse>
                </TableCell>
              </TableRow>
            </>
          );
        })}
      </TableBody>
    </Table>
  );
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function KpiCard({ label, value, color, sub }: { label: string; value: number; color: string; sub?: string }) {
  return (
    <Card>
      <CardContent sx={{ p: 2.5, pb: "12px !important" }}>
        <Typography sx={{ fontSize: "2rem", fontWeight: 900, color, lineHeight: 1 }}>{value}</Typography>
        <Typography variant="body2" fontWeight={600} sx={{ mt: 0.5 }}>{label}</Typography>
        {sub && <Typography variant="caption" color="text.disabled">{sub}</Typography>}
      </CardContent>
    </Card>
  );
}

function Section({ title, icon, children, mb, onExport }: { title: string; icon?: ReactNode; children: ReactNode; mb?: boolean; onExport?: () => void }) {
  return (
    <Card sx={{ mb: mb ? 3 : 0 }}>
      <CardContent sx={{ p: 0, pb: "0 !important" }}>
        <Box sx={{ px: 3, py: 2, display: "flex", alignItems: "center", gap: 1,
          borderBottom: "1px solid", borderColor: "divider" }}>
          {icon && <Box sx={{ color: "text.secondary", display: "flex" }}>{icon}</Box>}
          <Typography variant="h6" sx={{ fontWeight: 700, fontSize: "0.95rem" }}>{title}</Typography>
          {onExport && (
            <Tooltip title="Exportar .xlsx">
              <IconButton size="small" onClick={onExport} sx={{ ml: "auto", color: "text.disabled", "&:hover": { color: "primary.main" } }}>
                <DownloadIcon sx={{ fontSize: 18 }} />
              </IconButton>
            </Tooltip>
          )}
        </Box>
        {children}
      </CardContent>
    </Card>
  );
}

function LoadingRows({ n = 3 }: { n?: number }) {
  return (
    <Box sx={{ p: 3, display: "flex", flexDirection: "column", gap: 1.5 }}>
      {Array.from({ length: n }).map((_, i) => (
        <Skeleton key={i} height={36} sx={{ borderRadius: 2 }} />
      ))}
    </Box>
  );
}

function Empty({ msg, ok }: { msg: string; ok?: boolean }) {
  return (
    <Box sx={{ p: 4, textAlign: "center", display: "flex", flexDirection: "column", alignItems: "center", gap: 1 }}>
      {ok && <CheckCircleIcon sx={{ color: "#10b981", fontSize: 32 }} />}
      <Typography color={ok ? "#10b981" : "text.secondary"} variant="body2">{msg}</Typography>
    </Box>
  );
}
