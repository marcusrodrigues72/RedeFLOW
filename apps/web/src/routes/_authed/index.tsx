import { createFileRoute, Link } from "@tanstack/react-router";
import {
  Box, Typography, Grid2 as Grid, Card, CardContent,
  LinearProgress, Chip, Skeleton, Button, Divider, Avatar, Tooltip,
  Drawer, IconButton, Table, TableHead, TableRow, TableCell, TableBody,
} from "@mui/material";
import AddIcon                from "@mui/icons-material/Add";
import TrendingUpIcon         from "@mui/icons-material/TrendingUp";
import PlayCircleOutlineIcon  from "@mui/icons-material/PlayCircleOutline";
import WarningAmberIcon       from "@mui/icons-material/WarningAmber";
import CheckCircleOutlineIcon from "@mui/icons-material/CheckCircleOutline";
import CalendarTodayIcon      from "@mui/icons-material/CalendarToday";
import CloseIcon              from "@mui/icons-material/Close";
import OpenInNewIcon          from "@mui/icons-material/OpenInNew";
import { useState }           from "react";
import { useAuthStore }       from "@/stores/auth.store";
import { useDashboardStats, useCursos, useDashboardDetalhe } from "@/lib/api/cursos";
import { useProgressoCursos }                                from "@/lib/api/relatorios";
import type { ReactNode }             from "react";
import type { DashboardDetalheTipo }  from "shared";

export const Route = createFileRoute("/_authed/")({
  component: DashboardPage,
});

function saudacao() {
  const h = new Date().getHours();
  if (h < 12) return "Bom dia";
  if (h < 18) return "Boa tarde";
  return "Boa noite";
}

const DETALHE_CONFIG: Record<DashboardDetalheTipo, { titulo: string; subtitulo: (n: number) => string }> = {
  em_producao: {
    titulo:    "OAs em Produção",
    subtitulo: (n) => `${n} objeto${n !== 1 ? "s" : ""} em andamento`,
  },
  concluidos: {
    titulo:    "OAs Concluídos",
    subtitulo: (n) => `${n} objeto${n !== 1 ? "s" : ""} concluído${n !== 1 ? "s" : ""}`,
  },
  atrasos: {
    titulo:    "Atrasos Críticos",
    subtitulo: (n) => `${n} etapa${n !== 1 ? "s" : ""} com deadline vencido`,
  },
  cursos: {
    titulo:    "Cursos Cadastrados",
    subtitulo: (n) => `${n} curso${n !== 1 ? "s" : ""} no sistema`,
  },
};

function DashboardPage() {
  const user            = useAuthStore((s) => s.user);
  const { data: stats,  isLoading: loadStats  } = useDashboardStats();
  const { data: cursos, isLoading: loadCursos } = useCursos();
  const { data: progresso, isLoading: loadProgresso } = useProgressoCursos();
  const [drawerTipo, setDrawerTipo]             = useState<DashboardDetalheTipo | null>(null);

  const hoje = new Date().toLocaleDateString("pt-BR", { weekday: "long", day: "numeric", month: "long" });

  // Cursos para a timeline: vêm do relatório (tem progresso + datas estimadas dos OAs)
  const cursosTimeline = (progresso ?? []).filter(
    (c) => c.status !== "ARQUIVADO" && (c.dataInicioEstimada || c.dataFimEstimada)
  );

  return (
    <Box>
      {/* ── Cabeçalho ──────────────────────────────────────────────────────── */}
      <Box sx={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", mb: 4 }}>
        <Box>
          <Typography sx={{ fontSize: "1.875rem", fontWeight: 800, color: "text.primary", lineHeight: 1.2 }}>
            {saudacao()}, {user?.nome?.split(" ")[0]}.
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5, textTransform: "capitalize" }}>
            {hoje}
          </Typography>
        </Box>
        <Button
          component={Link} to="/cursos/importar"
          variant="contained" startIcon={<AddIcon />}
          sx={{ fontWeight: 700, px: 3 }}
        >
          Importar Planilha
        </Button>
      </Box>

      {/* ── KPIs ───────────────────────────────────────────────────────────── */}
      <Grid container spacing={2.5} sx={{ mb: 4 }}>
        <Grid size={{ xs: 12, sm: 6, md: 3 }}>
          <KpiCard
            loading={loadStats}
            label="CURSOS CADASTRADOS"
            value={stats?.totalCursos ?? 0}
            sub={`${stats?.cursosAtivos ?? 0} ativos`}
            icon={<TrendingUpIcon />}
            iconColor="#2b7cee"
            onClick={() => setDrawerTipo("cursos")}
          />
        </Grid>
        <Grid size={{ xs: 12, sm: 6, md: 3 }}>
          <KpiCard
            loading={loadStats}
            label="OAs EM PRODUÇÃO"
            value={stats?.emProducao ?? 0}
            sub="aguardando etapas"
            icon={<PlayCircleOutlineIcon />}
            iconColor="#f59e0b"
            onClick={() => setDrawerTipo("em_producao")}
          />
        </Grid>
        <Grid size={{ xs: 12, sm: 6, md: 3 }}>
          <KpiCard
            loading={loadStats}
            label="OAs CONCLUÍDOS"
            value={stats?.oasConcluidos ?? 0}
            sub={`${stats?.progressoPct ?? 0}% do total`}
            progress={stats?.progressoPct}
            icon={<CheckCircleOutlineIcon />}
            iconColor="#10b981"
            onClick={() => setDrawerTipo("concluidos")}
          />
        </Grid>
        <Grid size={{ xs: 12, sm: 6, md: 3 }}>
          <KpiCard
            loading={loadStats}
            label="ATRASOS CRÍTICOS"
            value={stats?.oasAtrasados ?? 0}
            sub="etapas com deadline vencido"
            icon={<WarningAmberIcon />}
            iconColor="#ef4444"
            alert={!!stats?.oasAtrasados}
            onClick={() => setDrawerTipo("atrasos")}
          />
        </Grid>
      </Grid>

      {/* ── Cursos recentes + Progresso global ─────────────────────────────── */}
      <Grid container spacing={3} sx={{ mb: 4 }}>
        <Grid size={{ xs: 12, md: 8 }}>
          <Card>
            <CardContent sx={{ p: 3 }}>
              <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mb: 2.5 }}>
                <Typography variant="h5">Cursos em Produção</Typography>
                <Button component={Link} to="/cursos" size="small" sx={{ fontWeight: 600 }}>
                  Ver todos
                </Button>
              </Box>

              {loadCursos ? (
                [1, 2, 3].map((i) => <Skeleton key={i} height={60} sx={{ mb: 1, borderRadius: 2 }} />)
              ) : !cursos?.length ? (
                <Box sx={{ textAlign: "center", py: 4 }}>
                  <Typography color="text.secondary" sx={{ mb: 2 }}>
                    Nenhum curso cadastrado ainda.
                  </Typography>
                  <Button component={Link} to="/cursos/importar" variant="outlined" startIcon={<AddIcon />}>
                    Importar primeira planilha
                  </Button>
                </Box>
              ) : (
                cursos.slice(0, 5).map((curso) => (
                  <Box key={curso.id}>
                    <Box
                      component={Link} to={`/cursos/${curso.id}`}
                      sx={{ textDecoration: "none", display: "flex", alignItems: "center", gap: 2, py: 1.5, borderRadius: 2, px: 1, "&:hover": { bgcolor: "action.hover" } }}
                    >
                      <Avatar sx={{ bgcolor: "#eff6ff", color: "primary.main", width: 36, height: 36, fontSize: "0.8rem", fontWeight: 700 }}>
                        {curso.codigo.slice(0, 2).toUpperCase()}
                      </Avatar>
                      <Box sx={{ flex: 1, minWidth: 0 }}>
                        <Typography variant="body2" fontWeight={600} noWrap>{curso.nome}</Typography>
                        <Typography variant="caption" color="text.secondary">
                          {curso._count.unidades} unidade{curso._count.unidades !== 1 ? "s" : ""}
                        </Typography>
                      </Box>
                      <StatusBadge status={curso.status} />
                    </Box>
                    <Divider />
                  </Box>
                ))
              )}
            </CardContent>
          </Card>
        </Grid>

        <Grid size={{ xs: 12, md: 4 }}>
          <Card sx={{ height: "100%" }}>
            <CardContent sx={{ p: 3 }}>
              <Typography variant="h5" sx={{ mb: 2.5 }}>Progresso Global</Typography>

              {loadStats ? (
                <Skeleton height={120} sx={{ borderRadius: 2 }} />
              ) : (
                <>
                  <Box sx={{ textAlign: "center", mb: 3 }}>
                    <Typography sx={{ fontSize: "3rem", fontWeight: 900, color: "primary.main", lineHeight: 1 }}>
                      {stats?.progressoPct ?? 0}%
                    </Typography>
                    <Typography variant="body2" color="text.secondary">de OAs concluídos</Typography>
                  </Box>

                  <LinearProgress
                    variant="determinate"
                    value={stats?.progressoPct ?? 0}
                    sx={{ height: 10, borderRadius: 5, mb: 3, "& .MuiLinearProgress-bar": { bgcolor: "#10b981" } }}
                  />

                  <Box sx={{ display: "flex", flexDirection: "column", gap: 1.5 }}>
                    {[
                      { label: "Total de OAs",  value: stats?.totalOAs ?? 0,      color: "#2b7cee" },
                      { label: "Concluídos",     value: stats?.oasConcluidos ?? 0, color: "#10b981" },
                      { label: "Em produção",    value: stats?.emProducao ?? 0,    color: "#f59e0b" },
                      { label: "Com atraso",     value: stats?.oasAtrasados ?? 0,  color: "#ef4444" },
                    ].map((item) => (
                      <Box key={item.label} sx={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                        <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                          <Box sx={{ width: 8, height: 8, borderRadius: "50%", bgcolor: item.color }} />
                          <Typography variant="body2" color="text.secondary">{item.label}</Typography>
                        </Box>
                        <Typography variant="body2" fontWeight={700}>{item.value}</Typography>
                      </Box>
                    ))}
                  </Box>
                </>
              )}
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* ── Drawer de detalhe ──────────────────────────────────────────────── */}
      <DetalheDrawer tipo={drawerTipo} onClose={() => setDrawerTipo(null)} />

      {/* ── Timeline de Projetos ────────────────────────────────────────────── */}
      <Card>
        <CardContent sx={{ p: 3 }}>
          <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", mb: 3 }}>
            <Box sx={{ display: "flex", alignItems: "center", gap: 1.5 }}>
              <CalendarTodayIcon sx={{ color: "text.secondary", fontSize: 20 }} />
              <Typography variant="h5">Timeline de Projetos</Typography>
            </Box>
            <Button component={Link} to="/cursos" size="small" sx={{ fontWeight: 600 }}>
              Ver todos
            </Button>
          </Box>

          {loadProgresso ? (
            [1, 2, 3].map((i) => <Skeleton key={i} height={52} sx={{ mb: 1.5, borderRadius: 2 }} />)
          ) : cursosTimeline.length === 0 ? (
            <Box sx={{ textAlign: "center", py: 5 }}>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                Nenhum curso com período de execução definido.
              </Typography>
              <Typography variant="caption" color="text.disabled">
                Defina datas de início e fim nos cursos para visualizar a timeline.
              </Typography>
            </Box>
          ) : (
            <TimelineGantt cursos={cursosTimeline} />
          )}
        </CardContent>
      </Card>
    </Box>
  );
}

// ─── Timeline Gantt ───────────────────────────────────────────────────────────

type CursoTimeline = {
  id: string;
  nome: string;
  codigo: string;
  status: string;
  dataInicioEstimada: string | null;
  dataFimEstimada: string | null;
  progressoPct: number;
  totalOAs: number;
};

function barColor(pct: number, status: string): string {
  if (status === "ARQUIVADO") return "#94a3b8";
  if (pct >= 100)  return "#10b981";
  if (pct >= 60)   return "#2b7cee";
  if (pct >= 25)   return "#f59e0b";
  return "#94a3b8";
}

function TimelineGantt({ cursos }: { cursos: CursoTimeline[] }) {
  const hoje = new Date();

  // Calcula janela de datas global
  const datas = cursos.flatMap((c) => [
    c.dataInicioEstimada ? new Date(c.dataInicioEstimada).getTime() : null,
    c.dataFimEstimada    ? new Date(c.dataFimEstimada).getTime()    : null,
  ]).filter(Boolean) as number[];

  const minTs = Math.min(...datas);
  const maxTs = Math.max(...datas);
  // Adiciona 4% de padding em cada lado
  const pad     = (maxTs - minTs) * 0.04 || 86_400_000 * 30;
  const rangeStart = minTs - pad;
  const rangeEnd   = maxTs + pad;
  const totalRange = rangeEnd - rangeStart;

  const todayPct = Math.min(100, Math.max(0, ((hoje.getTime() - rangeStart) / totalRange) * 100));

  // Gera ticks mensais
  const ticks = buildMonthTicks(new Date(rangeStart), new Date(rangeEnd));

  // Altura da linha do eixo
  const ROW_H = 44;
  const LABEL_W = 200;

  return (
    <Box>
      {/* Eixo de tempo */}
      <Box sx={{ display: "flex", ml: `${LABEL_W}px`, mb: 0.5, position: "relative" }}>
        {ticks.map((tick) => (
          <Box
            key={tick.label}
            sx={{
              position: "absolute",
              left: `${tick.pct}%`,
              transform: "translateX(-50%)",
              pointerEvents: "none",
            }}
          >
            <Typography variant="caption" color="text.disabled" sx={{ fontSize: "0.65rem", whiteSpace: "nowrap" }}>
              {tick.label}
            </Typography>
          </Box>
        ))}
      </Box>

      {/* Grade + barras */}
      <Box sx={{ position: "relative", mt: 2.5 }}>
        {/* Grade vertical (ticks) */}
        <Box sx={{ position: "absolute", left: LABEL_W, right: 0, top: 0, bottom: 0, pointerEvents: "none", zIndex: 0 }}>
          {ticks.map((tick) => (
            <Box
              key={tick.label}
              sx={{
                position: "absolute",
                left: `${tick.pct}%`,
                top: 0, bottom: 0,
                borderLeft: "1px dashed",
                borderColor: "divider",
                opacity: 0.6,
              }}
            />
          ))}
          {/* Linha "hoje" */}
          {todayPct >= 0 && todayPct <= 100 && (
            <Tooltip title="Hoje" placement="top">
              <Box
                sx={{
                  position: "absolute",
                  left: `${todayPct}%`,
                  top: 0, bottom: 0,
                  borderLeft: "2px solid #ef4444",
                  zIndex: 2,
                  "&::after": {
                    content: '"▼"',
                    position: "absolute",
                    top: -18,
                    left: "50%",
                    transform: "translateX(-50%)",
                    color: "#ef4444",
                    fontSize: "0.6rem",
                  },
                }}
              />
            </Tooltip>
          )}
        </Box>

        {/* Linhas de curso */}
        {cursos.map((curso, idx) => {
          const start = curso.dataInicioEstimada ? new Date(curso.dataInicioEstimada).getTime() : null;
          const end   = curso.dataFimEstimada    ? new Date(curso.dataFimEstimada).getTime()    : null;

          const leftPct  = start ? ((start - rangeStart) / totalRange) * 100 : 0;
          const widthPct = start && end ? ((end - start) / totalRange) * 100 : 0;
          const color    = barColor(curso.progressoPct, curso.status);
          const isActive = curso.status === "ATIVO";

          return (
            <Box
              key={curso.id}
              sx={{
                display: "flex",
                alignItems: "center",
                height: ROW_H,
                bgcolor: idx % 2 === 0 ? "transparent" : "#fafafa",
                borderRadius: 1,
                "&:hover": { bgcolor: "#f0f7ff" },
                transition: "background 0.12s",
              }}
            >
              {/* Label */}
              <Box
                component={Link}
                to={`/cursos/${curso.id}`}
                sx={{
                  width: LABEL_W,
                  flexShrink: 0,
                  pr: 2,
                  textDecoration: "none",
                  overflow: "hidden",
                }}
              >
                <Typography
                  variant="body2"
                  fontWeight={isActive ? 600 : 400}
                  noWrap
                  color={isActive ? "text.primary" : "text.secondary"}
                  sx={{ fontSize: "0.8rem" }}
                >
                  {curso.nome}
                </Typography>
                <Typography variant="caption" color="text.disabled" sx={{ fontSize: "0.65rem" }}>
                  {curso.codigo}
                </Typography>
              </Box>

              {/* Área da barra */}
              <Box sx={{ flex: 1, position: "relative", height: "100%", display: "flex", alignItems: "center" }}>
                {start && end ? (
                  <Tooltip
                    title={
                      <Box>
                        <Typography variant="caption" sx={{ display: "block", fontWeight: 700 }}>{curso.nome}</Typography>
                        <Typography variant="caption" sx={{ display: "block" }}>
                          {new Date(start).toLocaleDateString("pt-BR")} → {new Date(end).toLocaleDateString("pt-BR")}
                          {" "}(estimado via OAs)
                        </Typography>
                        <Typography variant="caption" sx={{ display: "block" }}>
                          {curso.progressoPct}% concluído · {curso.totalOAs} OAs
                        </Typography>
                      </Box>
                    }
                    placement="top"
                  >
                    <Box
                      sx={{
                        position: "absolute",
                        left: `${leftPct}%`,
                        width: `${Math.max(widthPct, 1)}%`,
                        height: 28,
                        borderRadius: 1.5,
                        bgcolor: `${color}22`,
                        border: `1px solid ${color}55`,
                        overflow: "hidden",
                        cursor: "pointer",
                      }}
                    >
                      {/* Barra de progresso */}
                      <Box
                        sx={{
                          position: "absolute",
                          left: 0, top: 0, bottom: 0,
                          width: `${curso.progressoPct}%`,
                          bgcolor: color,
                          opacity: 0.7,
                          borderRadius: "inherit",
                          transition: "width 0.5s ease",
                        }}
                      />
                      {/* Label de % */}
                      <Box sx={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", px: 1 }}>
                        <Typography
                          variant="caption"
                          sx={{ fontSize: "0.65rem", fontWeight: 700, color, whiteSpace: "nowrap", zIndex: 1 }}
                        >
                          {curso.progressoPct}%
                        </Typography>
                      </Box>
                    </Box>
                  </Tooltip>
                ) : (
                  <Typography variant="caption" color="text.disabled" sx={{ fontSize: "0.65rem", pl: 1 }}>
                    Sem período definido
                  </Typography>
                )}
              </Box>

              {/* Datas à direita */}
              <Box sx={{ width: 140, pl: 1.5, flexShrink: 0 }}>
                {start && end ? (
                  <Box>
                    <Typography variant="caption" color="text.disabled" sx={{ fontSize: "0.65rem", display: "block" }}>
                      {new Date(start).toLocaleDateString("pt-BR", { month: "short", year: "2-digit" })}
                      {" → "}
                      {new Date(end).toLocaleDateString("pt-BR", { month: "short", year: "2-digit" })}
                    </Typography>
                    <Typography variant="caption" sx={{ fontSize: "0.6rem", color: "#94a3b8" }}>
                      {curso.totalOAs} OAs
                    </Typography>
                  </Box>
                ) : null}
              </Box>
            </Box>
          );
        })}
      </Box>

      {/* Legenda */}
      <Box sx={{ display: "flex", gap: 2.5, mt: 2.5, pt: 2, borderTop: "1px solid", borderColor: "divider", flexWrap: "wrap" }}>
        {[
          { color: "#94a3b8", label: "Não iniciado (<25%)" },
          { color: "#f59e0b", label: "Em andamento (25–60%)" },
          { color: "#2b7cee", label: "Avançado (60–99%)" },
          { color: "#10b981", label: "Concluído (100%)" },
          { color: "#ef4444", label: "Hoje", dashed: true },
        ].map((item) => (
          <Box key={item.label} sx={{ display: "flex", alignItems: "center", gap: 0.75 }}>
            <Box sx={{
              width: item.dashed ? 2 : 12, height: item.dashed ? 14 : 8,
              bgcolor: item.dashed ? item.color : `${item.color}55`,
              border: item.dashed ? "none" : `1px solid ${item.color}88`,
              borderRadius: item.dashed ? 0 : 1,
            }} />
            <Typography variant="caption" color="text.secondary" sx={{ fontSize: "0.65rem" }}>
              {item.label}
            </Typography>
          </Box>
        ))}
      </Box>
    </Box>
  );
}

function buildMonthTicks(start: Date, end: Date): { label: string; pct: number }[] {
  const totalMs = end.getTime() - start.getTime();
  const ticks: { label: string; pct: number }[] = [];
  const cur = new Date(start.getFullYear(), start.getMonth(), 1);
  while (cur <= end) {
    const pct = ((cur.getTime() - start.getTime()) / totalMs) * 100;
    if (pct >= 0 && pct <= 100) {
      ticks.push({
        label: cur.toLocaleDateString("pt-BR", { month: "short", year: "2-digit" }),
        pct,
      });
    }
    cur.setMonth(cur.getMonth() + 1);
  }
  return ticks;
}

// ─── KPI Card ─────────────────────────────────────────────────────────────────
function KpiCard({ loading, label, value, sub, icon, iconColor, progress, alert, onClick }: {
  loading: boolean; label: string; value: number; sub: string;
  icon: ReactNode; iconColor: string; progress?: number; alert?: boolean; onClick?: () => void;
}) {
  return (
    <Card
      onClick={onClick}
      sx={{
        border: alert ? `1px solid #fecaca` : "none",
        bgcolor: alert ? "#fff5f5" : "background.paper",
        cursor: onClick ? "pointer" : "default",
        transition: "box-shadow 0.15s, transform 0.1s",
        "&:hover": onClick ? { boxShadow: "0 4px 16px rgba(0,0,0,0.10)", transform: "translateY(-1px)" } : {},
      }}
    >
      <CardContent sx={{ p: 3 }}>
        <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", mb: 1.5 }}>
          <Typography variant="caption" color="text.secondary">{label}</Typography>
          <Box sx={{ bgcolor: `${iconColor}15`, p: 0.75, borderRadius: 1.5, color: iconColor, display: "flex" }}>
            {icon}
          </Box>
        </Box>
        {loading
          ? <Skeleton width={60} height={44} />
          : <Typography sx={{ fontSize: "2rem", fontWeight: 900, color: "text.primary", lineHeight: 1, mb: 0.5 }}>{value}</Typography>
        }
        <Typography variant="caption" color="text.secondary">{sub}</Typography>
        {progress !== undefined && (
          <LinearProgress variant="determinate" value={progress} sx={{ mt: 1.5, "& .MuiLinearProgress-bar": { bgcolor: iconColor } }} />
        )}
      </CardContent>
    </Card>
  );
}

// ─── Detalhe Drawer ───────────────────────────────────────────────────────────

import type { DashboardDetalheOA, DashboardDetalheAtraso } from "shared";

const TIPO_LABEL: Record<string, string> = {
  VIDEO: "Vídeo", SLIDE: "Slide", QUIZ: "Quiz",
  EBOOK: "E-book", PLANO_AULA: "Plano", TAREFA: "Tarefa",
};

const STATUS_LABEL: Record<string, { label: string; color: string }> = {
  PENDENTE:     { label: "Pendente",     color: "#94a3b8" },
  EM_ANDAMENTO: { label: "Em andamento", color: "#f59e0b" },
  BLOQUEADO:    { label: "Bloqueado",    color: "#ef4444" },
  CONCLUIDO:    { label: "Concluído",    color: "#10b981" },
};

function DetalheDrawer({ tipo, onClose }: { tipo: DashboardDetalheTipo | null; onClose: () => void }) {
  const { data, isLoading } = useDashboardDetalhe(tipo);
  const cfg = tipo ? DETALHE_CONFIG[tipo] : null;
  const items = (data ?? []) as (DashboardDetalheAtraso | DashboardDetalheOA)[];

  return (
    <Drawer
      anchor="right"
      open={!!tipo}
      onClose={onClose}
      PaperProps={{ sx: { width: { xs: "100vw", sm: 560 }, p: 0 } }}
    >
      {/* Header */}
      <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", px: 3, py: 2.5, borderBottom: "1px solid", borderColor: "divider" }}>
        <Box>
          <Typography variant="h6" fontWeight={700}>{cfg?.titulo ?? ""}</Typography>
          {!isLoading && (
            <Typography variant="caption" color="text.secondary">
              {cfg?.subtitulo(items.length) ?? ""}
            </Typography>
          )}
        </Box>
        <IconButton onClick={onClose} size="small"><CloseIcon fontSize="small" /></IconButton>
      </Box>

      {/* Content */}
      <Box sx={{ overflow: "auto", flex: 1 }}>
        {isLoading ? (
          <Box sx={{ p: 3 }}>
            {[1, 2, 3, 4].map((i) => <Skeleton key={i} height={52} sx={{ mb: 1, borderRadius: 1 }} />)}
          </Box>
        ) : items.length === 0 ? (
          <Box sx={{ p: 4, textAlign: "center" }}>
            <Typography color="text.secondary">Nenhum item encontrado.</Typography>
          </Box>
        ) : tipo === "atrasos" ? (
          <AtrasosTable items={items as DashboardDetalheAtraso[]} />
        ) : (
          <OAsTable items={items as DashboardDetalheOA[]} />
        )}
      </Box>
    </Drawer>
  );
}

function OAsTable({ items }: { items: DashboardDetalheOA[] }) {
  return (
    <Table size="small" stickyHeader>
      <TableHead>
        <TableRow>
          <TableCell sx={{ fontWeight: 700, fontSize: "0.72rem" }}>Código</TableCell>
          <TableCell sx={{ fontWeight: 700, fontSize: "0.72rem" }}>Tipo</TableCell>
          <TableCell sx={{ fontWeight: 700, fontSize: "0.72rem" }}>Status</TableCell>
          <TableCell sx={{ fontWeight: 700, fontSize: "0.72rem" }}>Progresso</TableCell>
          <TableCell sx={{ fontWeight: 700, fontSize: "0.72rem" }}>Curso</TableCell>
          <TableCell sx={{ fontWeight: 700, fontSize: "0.72rem" }}>Etapa Atual</TableCell>
          <TableCell />
        </TableRow>
      </TableHead>
      <TableBody>
        {items.map((oa) => {
          const st = STATUS_LABEL[oa.status] ?? STATUS_LABEL["PENDENTE"]!;
          return (
            <TableRow key={oa.id} hover>
              <TableCell sx={{ fontSize: "0.72rem", fontWeight: 600, whiteSpace: "nowrap" }}>{oa.codigo}</TableCell>
              <TableCell sx={{ fontSize: "0.72rem" }}>{TIPO_LABEL[oa.tipo] ?? oa.tipo}</TableCell>
              <TableCell>
                <Chip label={st.label} size="small" sx={{ bgcolor: `${st.color}15`, color: st.color, fontWeight: 600, fontSize: "0.65rem", height: 20 }} />
              </TableCell>
              <TableCell sx={{ fontSize: "0.72rem", minWidth: 80 }}>
                <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                  <LinearProgress
                    variant="determinate"
                    value={oa.progressoPct}
                    sx={{ flex: 1, height: 5, borderRadius: 3, "& .MuiLinearProgress-bar": { bgcolor: "#2b7cee" } }}
                  />
                  <Typography variant="caption" sx={{ fontSize: "0.65rem", minWidth: 28 }}>{oa.progressoPct}%</Typography>
                </Box>
              </TableCell>
              <TableCell sx={{ fontSize: "0.72rem" }}>
                <Typography variant="caption" noWrap sx={{ maxWidth: 120, display: "block" }}>{oa.curso.nome}</Typography>
              </TableCell>
              <TableCell sx={{ fontSize: "0.72rem" }}>
                {oa.etapaAtual ? (
                  <Box>
                    <Typography variant="caption" sx={{ fontSize: "0.68rem", display: "block" }}>{oa.etapaAtual.nome}</Typography>
                    {oa.etapaAtual.responsavel && (
                      <Typography variant="caption" color="text.secondary" sx={{ fontSize: "0.63rem" }}>{oa.etapaAtual.responsavel}</Typography>
                    )}
                  </Box>
                ) : (
                  <Typography variant="caption" color="text.disabled">—</Typography>
                )}
              </TableCell>
              <TableCell>
                <IconButton component={Link} to={`/oas/${oa.id}`} size="small" sx={{ p: 0.5 }}>
                  <OpenInNewIcon sx={{ fontSize: 14 }} />
                </IconButton>
              </TableCell>
            </TableRow>
          );
        })}
      </TableBody>
    </Table>
  );
}

function AtrasosTable({ items }: { items: DashboardDetalheAtraso[] }) {
  return (
    <Table size="small" stickyHeader>
      <TableHead>
        <TableRow>
          <TableCell sx={{ fontWeight: 700, fontSize: "0.72rem" }}>OA</TableCell>
          <TableCell sx={{ fontWeight: 700, fontSize: "0.72rem" }}>Etapa</TableCell>
          <TableCell sx={{ fontWeight: 700, fontSize: "0.72rem" }}>Responsável</TableCell>
          <TableCell sx={{ fontWeight: 700, fontSize: "0.72rem" }}>Atraso</TableCell>
          <TableCell sx={{ fontWeight: 700, fontSize: "0.72rem" }}>Curso</TableCell>
          <TableCell />
        </TableRow>
      </TableHead>
      <TableBody>
        {items.map((item, idx) => (
          <TableRow key={`${item.oaId}-${idx}`} hover>
            <TableCell sx={{ fontSize: "0.72rem", fontWeight: 600, whiteSpace: "nowrap" }}>{item.oaCodigo}</TableCell>
            <TableCell sx={{ fontSize: "0.72rem" }}>{item.etapa}</TableCell>
            <TableCell sx={{ fontSize: "0.72rem" }}>
              {item.responsavel ?? <Typography variant="caption" color="text.disabled">—</Typography>}
            </TableCell>
            <TableCell>
              <Chip
                label={`${item.diasAtraso}d`}
                size="small"
                sx={{ bgcolor: "#fef2f2", color: "#ef4444", fontWeight: 700, fontSize: "0.65rem", height: 20 }}
              />
            </TableCell>
            <TableCell sx={{ fontSize: "0.72rem" }}>
              <Typography variant="caption" noWrap sx={{ maxWidth: 120, display: "block" }}>{item.curso.nome}</Typography>
            </TableCell>
            <TableCell>
              <IconButton component={Link} to={`/oas/${item.oaId}`} size="small" sx={{ p: 0.5 }}>
                <OpenInNewIcon sx={{ fontSize: 14 }} />
              </IconButton>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { label: string; color: string; bg: string }> = {
    ATIVO:     { label: "Ativo",     color: "#10b981", bg: "#f0fdf4" },
    RASCUNHO:  { label: "Rascunho",  color: "#64748b", bg: "#f8fafc" },
    ARQUIVADO: { label: "Arquivado", color: "#94a3b8", bg: "#f1f5f9" },
  };
  const s = map[status] ?? map["RASCUNHO"]!;
  return (
    <Chip label={s.label} size="small" sx={{ bgcolor: s.bg, color: s.color, fontWeight: 600, fontSize: "0.7rem" }} />
  );
}
