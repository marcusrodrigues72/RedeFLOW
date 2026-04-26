import { createFileRoute, Link } from "@tanstack/react-router";
import {
  Box, Typography, Grid2 as Grid, Card, CardContent,
  LinearProgress, Chip, Skeleton, Button, Divider, Avatar, Tooltip,
  Drawer, IconButton, Table, TableHead, TableRow, TableCell, TableBody,
  List, ListItem, ListItemAvatar, ListItemText,
} from "@mui/material";
import AddIcon                from "@mui/icons-material/Add";
import TrendingUpIcon         from "@mui/icons-material/TrendingUp";
import PlayCircleOutlineIcon  from "@mui/icons-material/PlayCircleOutline";
import WarningAmberIcon       from "@mui/icons-material/WarningAmber";
import CheckCircleOutlineIcon from "@mui/icons-material/CheckCircleOutline";
import CalendarTodayIcon      from "@mui/icons-material/CalendarToday";
import CloseIcon              from "@mui/icons-material/Close";
import OpenInNewIcon          from "@mui/icons-material/OpenInNew";
import BlockIcon              from "@mui/icons-material/Block";
import AccessTimeIcon         from "@mui/icons-material/AccessTime";
import PersonIcon             from "@mui/icons-material/Person";
import { useState, useRef, useEffect } from "react";
import { useAuthStore }       from "@/stores/auth.store";
import { useDashboardStats, useCursos, useDashboardDetalhe, useProximasEntregas } from "@/lib/api/cursos";
import { useProgressoCursos, useAtrasosResponsavel }         from "@/lib/api/relatorios";
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
  const { data: progresso, isLoading: loadProgresso, isError: erroProgresso } = useProgressoCursos();
  const { data: proximasEntregas, isLoading: loadProximas } = useProximasEntregas(14);
  const { data: atrasosResp } = useAtrasosResponsavel();
  const [drawerTipo, setDrawerTipo]             = useState<DashboardDetalheTipo | null>(null);

  const vencendoEm7 = (proximasEntregas ?? []).filter((e) => e.diasRestantes <= 7).length;
  const top3atrasados = (atrasosResp ?? []).slice(0, 3);

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

      {/* ── Alertas + Próximas Entregas ────────────────────────────────────── */}
      <Grid container spacing={3} sx={{ mb: 4 }}>
        {/* Alertas de Bottleneck */}
        <Grid size={{ xs: 12, md: 7 }}>
          <Card sx={{ height: "100%" }}>
            <CardContent sx={{ p: 3 }}>
              <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 2.5 }}>
                <WarningAmberIcon sx={{ color: "#f59e0b", fontSize: 20 }} />
                <Typography variant="h5">Alertas de Atenção</Typography>
              </Box>

              <Grid container spacing={2} sx={{ mb: 3 }}>
                {/* Bloqueados */}
                <Grid size={{ xs: 12, sm: 4 }}>
                  <Box sx={{ p: 2, borderRadius: 2, bgcolor: "#fef2f2", border: "1px solid #fecaca", textAlign: "center" }}>
                    <BlockIcon sx={{ color: "#ef4444", fontSize: 28, mb: 0.5 }} />
                    {loadStats ? <Skeleton width={40} height={36} sx={{ mx: "auto" }} /> : (
                      <Typography sx={{ fontSize: "1.75rem", fontWeight: 900, color: "#ef4444", lineHeight: 1 }}>
                        {stats?.oasBloqueados ?? 0}
                      </Typography>
                    )}
                    <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600 }}>
                      OAs Bloqueados
                    </Typography>
                  </Box>
                </Grid>

                {/* Vencendo em 7 dias */}
                <Grid size={{ xs: 12, sm: 4 }}>
                  <Box sx={{ p: 2, borderRadius: 2, bgcolor: "#fffbeb", border: "1px solid #fde68a", textAlign: "center" }}>
                    <AccessTimeIcon sx={{ color: "#f59e0b", fontSize: 28, mb: 0.5 }} />
                    {loadProximas ? <Skeleton width={40} height={36} sx={{ mx: "auto" }} /> : (
                      <Typography sx={{ fontSize: "1.75rem", fontWeight: 900, color: "#f59e0b", lineHeight: 1 }}>
                        {vencendoEm7}
                      </Typography>
                    )}
                    <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600 }}>
                      Vencem em 7 dias
                    </Typography>
                  </Box>
                </Grid>

                {/* Atrasos críticos */}
                <Grid size={{ xs: 12, sm: 4 }}>
                  <Box sx={{ p: 2, borderRadius: 2, bgcolor: "#fef2f2", border: "1px solid #fecaca", textAlign: "center" }}>
                    <WarningAmberIcon sx={{ color: "#dc2626", fontSize: 28, mb: 0.5 }} />
                    {loadStats ? <Skeleton width={40} height={36} sx={{ mx: "auto" }} /> : (
                      <Typography sx={{ fontSize: "1.75rem", fontWeight: 900, color: "#dc2626", lineHeight: 1 }}>
                        {stats?.oasAtrasados ?? 0}
                      </Typography>
                    )}
                    <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600 }}>
                      Etapas Atrasadas
                    </Typography>
                  </Box>
                </Grid>
              </Grid>

              {/* Top 3 responsáveis com mais atrasos */}
              <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.5, mb: 1, display: "block" }}>
                Top responsáveis com atrasos
              </Typography>
              {top3atrasados.length === 0 ? (
                <Box sx={{ py: 2, textAlign: "center" }}>
                  <Typography variant="body2" color="text.secondary">Nenhum atraso registrado.</Typography>
                </Box>
              ) : (
                top3atrasados.map((resp, idx) => (
                  <Box key={resp.email} sx={{ display: "flex", alignItems: "center", gap: 1.5, py: 1, borderTop: idx > 0 ? "1px solid" : "none", borderColor: "divider" }}>
                    <Avatar sx={{ width: 32, height: 32, fontSize: "0.75rem", bgcolor: "#fee2e2", color: "#dc2626", fontWeight: 700 }}>
                      {resp.nome.charAt(0).toUpperCase()}
                    </Avatar>
                    <Box sx={{ flex: 1, minWidth: 0 }}>
                      <Typography variant="body2" fontWeight={600} noWrap>{resp.nome}</Typography>
                      <Typography variant="caption" color="text.secondary" noWrap>{resp.email}</Typography>
                    </Box>
                    <Chip
                      label={`${resp.total} atraso${resp.total !== 1 ? "s" : ""}`}
                      size="small"
                      sx={{ bgcolor: "#fef2f2", color: "#ef4444", fontWeight: 700, fontSize: "0.65rem", height: 20 }}
                    />
                  </Box>
                ))
              )}
            </CardContent>
          </Card>
        </Grid>

        {/* Próximas Entregas */}
        <Grid size={{ xs: 12, md: 5 }}>
          <Card sx={{ height: "100%" }}>
            <CardContent sx={{ p: 3, display: "flex", flexDirection: "column", height: "100%" }}>
              <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", mb: 2 }}>
                <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                  <CalendarTodayIcon sx={{ color: "text.secondary", fontSize: 20 }} />
                  <Typography variant="h5">Próximas Entregas</Typography>
                </Box>
                <Typography variant="caption" color="text.secondary">próximos 14 dias</Typography>
              </Box>

              {loadProximas ? (
                [1, 2, 3, 4].map((i) => <Skeleton key={i} height={52} sx={{ mb: 0.5, borderRadius: 1 }} />)
              ) : !proximasEntregas?.length ? (
                <Box sx={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <Box sx={{ textAlign: "center" }}>
                    <CheckCircleOutlineIcon sx={{ fontSize: 40, color: "#10b981", mb: 1 }} />
                    <Typography variant="body2" color="text.secondary">
                      Nenhuma entrega nos próximos 14 dias.
                    </Typography>
                  </Box>
                </Box>
              ) : (
                <List dense disablePadding sx={{ flex: 1, overflow: "auto", maxHeight: 320 }}>
                  {proximasEntregas.map((item) => {
                    const urgent = item.diasRestantes <= 2;
                    const warning = item.diasRestantes <= 7;
                    const chipColor = urgent ? "#ef4444" : warning ? "#f59e0b" : "#2b7cee";
                    const chipBg   = urgent ? "#fef2f2" : warning ? "#fffbeb" : "#eff6ff";
                    return (
                      <ListItem
                        key={item.etapaId}
                        disablePadding
                        sx={{ py: 0.75, borderBottom: "1px solid", borderColor: "divider", "&:last-child": { borderBottom: "none" } }}
                      >
                        <ListItemAvatar sx={{ minWidth: 36 }}>
                          <Avatar sx={{ width: 28, height: 28, fontSize: "0.65rem", bgcolor: "#f0f7ff", color: "primary.main", fontWeight: 700 }}>
                            {item.responsavelNome ? item.responsavelNome.charAt(0).toUpperCase() : <PersonIcon sx={{ fontSize: 14 }} />}
                          </Avatar>
                        </ListItemAvatar>
                        <ListItemText
                          primary={
                            <Box sx={{ display: "flex", alignItems: "center", gap: 0.75 }}>
                              <Typography variant="caption" fontWeight={700} sx={{ fontSize: "0.72rem" }}>
                                {item.oaCodigo}
                              </Typography>
                              <Typography variant="caption" color="text.secondary" sx={{ fontSize: "0.68rem" }} noWrap>
                                · {item.etapaNome}
                              </Typography>
                            </Box>
                          }
                          secondary={
                            <Typography variant="caption" color="text.disabled" noWrap sx={{ fontSize: "0.63rem" }}>
                              {item.cursoNome}
                            </Typography>
                          }
                        />
                        <Chip
                          label={item.diasRestantes === 0 ? "hoje" : `${item.diasRestantes}d`}
                          size="small"
                          sx={{ bgcolor: chipBg, color: chipColor, fontWeight: 700, fontSize: "0.63rem", height: 18, ml: 0.5 }}
                        />
                      </ListItem>
                    );
                  })}
                </List>
              )}
            </CardContent>
          </Card>
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
          ) : erroProgresso ? (
            <Box sx={{ textAlign: "center", py: 5 }}>
              <Typography variant="body2" color="error" sx={{ mb: 1 }}>
                Erro ao carregar dados da timeline.
              </Typography>
              <Typography variant="caption" color="text.disabled">
                Verifique os logs da API ou tente novamente mais tarde.
              </Typography>
            </Box>
          ) : cursosTimeline.length === 0 ? (
            <Box sx={{ textAlign: "center", py: 5 }}>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                Nenhum curso com período de execução definido.
              </Typography>
              <Typography variant="caption" color="text.disabled">
                Os deadlines das etapas dos OAs definem o período de execução.
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

// px por mês na régua horizontal
const PX_PER_MONTH = 110;
const LABEL_W      = 180;
const ROW_H        = 52;

function TimelineGantt({ cursos }: { cursos: CursoTimeline[] }) {
  const hoje      = new Date();
  const scrollRef = useRef<HTMLDivElement>(null);

  const datas = cursos.flatMap((c) => [
    c.dataInicioEstimada ? new Date(c.dataInicioEstimada).getTime() : null,
    c.dataFimEstimada    ? new Date(c.dataFimEstimada).getTime()    : null,
  ]).filter(Boolean) as number[];

  const hasData = datas.length > 0;
  const minTs = hasData ? Math.min(...datas) : hoje.getTime();
  const maxTs = hasData ? Math.max(...datas) : hoje.getTime();

  const rulerStart = new Date(new Date(minTs).getFullYear(), new Date(minTs).getMonth() - 1, 1);
  const rulerEnd   = new Date(new Date(maxTs).getFullYear(), new Date(maxTs).getMonth() + 2, 1);

  const months: Date[] = [];
  if (hasData) {
    const mCur = new Date(rulerStart);
    while (mCur < rulerEnd) {
      months.push(new Date(mCur));
      mCur.setMonth(mCur.getMonth() + 1);
    }
  }
  const totalChartW = Math.max(months.length * PX_PER_MONTH, 1);

  const toPx = (ts: number) =>
    ((ts - rulerStart.getTime()) / (1000 * 60 * 60 * 24 * 30.44)) * PX_PER_MONTH;

  const todayPx = toPx(hoje.getTime());

  useEffect(() => {
    if (!scrollRef.current || !hasData) return;
    const target = todayPx - scrollRef.current.clientWidth / 2;
    scrollRef.current.scrollLeft = Math.max(0, target);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!hasData) {
    return (
      <Typography color="text.disabled" sx={{ py: 4, textAlign: "center" }}>
        Nenhum projeto com datas definidas.
      </Typography>
    );
  }

  return (
    <Box>
      {/* Layout: label column fixo + área de gráfico com scroll horizontal */}
      <Box sx={{ display: "flex", border: "1px solid", borderColor: "divider", borderRadius: 2, overflow: "hidden" }}>

        {/* Coluna de labels — nunca rola */}
        <Box sx={{ width: LABEL_W, flexShrink: 0, borderRight: "1px solid", borderColor: "divider", bgcolor: "background.paper", zIndex: 2 }}>
          {/* Espaço vazio alinhado com a régua de meses */}
          <Box sx={{ height: 32, borderBottom: "1px solid", borderColor: "divider" }} />
          {cursos.map((curso, idx) => {
            const isActive = curso.status === "ATIVO";
            return (
              <Box key={curso.id} component={Link} to={`/cursos/${curso.id}`}
                sx={{
                  display: "flex", flexDirection: "column", justifyContent: "center",
                  height: ROW_H, px: 1.5, textDecoration: "none",
                  bgcolor: idx % 2 === 0 ? "transparent" : "#fafafa",
                  borderBottom: "1px solid", borderColor: "divider",
                  "&:hover": { bgcolor: "#f0f7ff" }, transition: "background 0.12s",
                }}
              >
                <Typography variant="body2" fontWeight={isActive ? 700 : 400} noWrap
                  color={isActive ? "text.primary" : "text.secondary"} sx={{ fontSize: "0.78rem" }}>
                  {curso.nome}
                </Typography>
                <Typography variant="caption" color="text.disabled" sx={{ fontSize: "0.63rem" }}>
                  {curso.codigo}
                </Typography>
              </Box>
            );
          })}
        </Box>

        {/* Área do gráfico — scroll horizontal */}
        <Box ref={scrollRef} sx={{ flex: 1, overflowX: "auto" }}>
          <Box sx={{ width: totalChartW, position: "relative" }}>

            {/* Régua de meses */}
            <Box sx={{ display: "flex", height: 32, borderBottom: "1px solid", borderColor: "divider", bgcolor: "#f8fafc" }}>
              {months.map((m) => (
                <Box key={m.toISOString()} sx={{
                  width: PX_PER_MONTH, flexShrink: 0,
                  display: "flex", alignItems: "center", justifyContent: "center",
                  borderRight: "1px dashed", borderColor: "divider",
                }}>
                  <Typography variant="caption" sx={{ fontSize: "0.68rem", fontWeight: 600, color: "text.secondary", textTransform: "capitalize" }}>
                    {m.toLocaleDateString("pt-BR", { month: "short", year: "2-digit" })}
                  </Typography>
                </Box>
              ))}
            </Box>

            {/* Grade vertical + linha de hoje (atrás das barras) */}
            <Box sx={{ position: "absolute", left: 0, right: 0, top: 32, bottom: 0, pointerEvents: "none" }}>
              {months.map((m, mIdx) => (
                <Box key={m.toISOString()} sx={{
                  position: "absolute", left: mIdx * PX_PER_MONTH, top: 0, bottom: 0,
                  borderLeft: "1px dashed", borderColor: "divider", opacity: 0.5,
                }} />
              ))}
              {todayPx >= 0 && todayPx <= totalChartW && (
                <Box sx={{ position: "absolute", left: todayPx, top: -32, bottom: 0, width: 2, bgcolor: "#ef4444", zIndex: 3 }}>
                  <Typography sx={{ position: "absolute", top: 2, left: "50%", transform: "translateX(-50%)", fontSize: "0.55rem", color: "#ef4444", userSelect: "none" }}>
                    ▼
                  </Typography>
                </Box>
              )}
            </Box>

            {/* Linhas de curso com barras */}
            {cursos.map((curso, idx) => {
              const startTs = curso.dataInicioEstimada ? new Date(curso.dataInicioEstimada).getTime() : null;
              const endTs   = curso.dataFimEstimada    ? new Date(curso.dataFimEstimada).getTime()    : null;
              const color   = barColor(curso.progressoPct, curso.status);
              const leftPx  = startTs !== null ? Math.max(0, toPx(startTs)) : null;
              const rightPx = endTs   !== null ? Math.min(totalChartW, toPx(endTs)) : null;
              const widthPx = leftPx !== null && rightPx !== null ? Math.max(rightPx - leftPx, 2) : null;

              return (
                <Box key={curso.id} sx={{
                  position: "relative", height: ROW_H, display: "flex", alignItems: "center",
                  bgcolor: idx % 2 === 0 ? "transparent" : "#fafafa",
                  borderBottom: "1px solid", borderColor: "divider",
                }}>
                  {widthPx !== null && leftPx !== null ? (
                    <Tooltip arrow placement="top"
                      title={
                        <Box sx={{ minWidth: 180 }}>
                          <Typography sx={{ display: "block", fontSize: "0.82rem", fontWeight: 700, color: "#1e293b", mb: 0.5 }}>
                            {curso.nome}
                          </Typography>
                          <Typography sx={{ display: "block", fontSize: "0.75rem", color: "#475569" }}>
                            {startTs ? new Date(startTs).toLocaleDateString("pt-BR") : "?"} → {endTs ? new Date(endTs).toLocaleDateString("pt-BR") : "?"}
                          </Typography>
                          <Typography sx={{ display: "block", fontSize: "0.75rem", color: "#475569", mt: 0.25 }}>
                            {curso.progressoPct}% concluído · {curso.totalOAs} OAs
                          </Typography>
                        </Box>
                      }
                      componentsProps={{
                        tooltip: { sx: { bgcolor: "white", color: "#1e293b", border: "1px solid #e2e8f0", boxShadow: "0 4px 16px rgba(0,0,0,0.12)", borderRadius: 1.5, px: 1.5, py: 1 } },
                        arrow:   { sx: { color: "white", "&::before": { border: "1px solid #e2e8f0" } } },
                      }}
                    >
                      <Box sx={{
                        position: "absolute", left: leftPx, width: widthPx, height: 30,
                        borderRadius: 1.5, bgcolor: `${color}22`, border: `1.5px solid ${color}88`,
                        overflow: "hidden", cursor: "pointer",
                      }}>
                        {/* Preenchimento de progresso */}
                        <Box sx={{ position: "absolute", left: 0, top: 0, bottom: 0, width: `${curso.progressoPct}%`, bgcolor: color, opacity: 0.5, transition: "width 0.5s ease" }} />
                        {/* Labels dentro da barra */}
                        <Box sx={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", px: 1, gap: 0.5 }}>
                          <Typography variant="caption" sx={{ fontSize: "0.68rem", fontWeight: 800, color, whiteSpace: "nowrap", zIndex: 1, textShadow: "0 0 4px #fff" }}>
                            {curso.progressoPct}%
                          </Typography>
                          {widthPx > 90 && startTs && endTs && (
                            <Typography variant="caption" sx={{ fontSize: "0.6rem", color: `${color}cc`, whiteSpace: "nowrap", zIndex: 1, textShadow: "0 0 4px #fff" }}>
                              {new Date(startTs).toLocaleDateString("pt-BR", { day: "2-digit", month: "short" })} – {new Date(endTs).toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "2-digit" })}
                            </Typography>
                          )}
                        </Box>
                      </Box>
                    </Tooltip>
                  ) : (
                    <Typography variant="caption" color="text.disabled" sx={{ fontSize: "0.65rem", pl: 2 }}>
                      Sem período definido
                    </Typography>
                  )}
                </Box>
              );
            })}
          </Box>
        </Box>
      </Box>

      {/* Legenda */}
      <Box sx={{ display: "flex", gap: 2.5, mt: 2, pt: 2, borderTop: "1px solid", borderColor: "divider", flexWrap: "wrap" }}>
        {[
          { color: "#94a3b8", label: "Não iniciado (<25%)" },
          { color: "#f59e0b", label: "Em andamento (25–60%)" },
          { color: "#2b7cee", label: "Avançado (60–99%)" },
          { color: "#10b981", label: "Concluído (100%)" },
          { color: "#ef4444", label: "Hoje", dashed: true },
        ].map((item) => (
          <Box key={item.label} sx={{ display: "flex", alignItems: "center", gap: 0.75 }}>
            <Box sx={{
              width: "dashed" in item ? 2 : 12, height: "dashed" in item ? 14 : 8,
              bgcolor: "dashed" in item ? item.color : `${item.color}55`,
              border: "dashed" in item ? "none" : `1px solid ${item.color}88`,
              borderRadius: "dashed" in item ? 0 : 1,
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
