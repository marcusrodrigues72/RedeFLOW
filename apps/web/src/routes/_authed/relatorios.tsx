import { createFileRoute } from "@tanstack/react-router";
import {
  Box, Typography, Card, CardContent, LinearProgress,
  Chip, Skeleton, Alert, Table, TableHead, TableRow,
  TableCell, TableBody, Divider,
} from "@mui/material";
import TrendingUpIcon    from "@mui/icons-material/TrendingUp";
import WarningAmberIcon  from "@mui/icons-material/WarningAmber";
import { useProgressoCursos, usePipelineStatus, useAtrasosResponsavel } from "@/lib/api/relatorios";
import type { StatusEtapa } from "shared";
import type { ReactNode } from "react";

export const Route = createFileRoute("/_authed/relatorios")({
  component: RelatoriosPage,
});

const STATUS_CONFIG: Record<StatusEtapa, { label: string; color: string; bg: string }> = {
  PENDENTE:     { label: "Pendente",     color: "#64748b", bg: "#f8fafc" },
  EM_ANDAMENTO: { label: "Em Andamento", color: "#f59e0b", bg: "#fffbeb" },
  CONCLUIDA:    { label: "Concluída",    color: "#10b981", bg: "#f0fdf4" },
  BLOQUEADA:    { label: "Bloqueada",    color: "#ef4444", bg: "#fff5f5" },
};

function RelatoriosPage() {
  const { data: cursos   = [], isLoading: loadCursos,   isError: errCursos   } = useProgressoCursos();
  const { data: pipeline,      isLoading: loadPipeline, isError: errPipeline } = usePipelineStatus();
  const { data: atrasos  = [], isLoading: loadAtrasos,  isError: errAtrasos  } = useAtrasosResponsavel();

  return (
    <Box>
      <Typography sx={{ fontSize: "1.375rem", fontWeight: 800, mb: 0.5 }}>Relatórios</Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
        Visão gerencial da produção de conteúdo
      </Typography>

      {/* ── Progresso por Curso ──────────────────────────────────────────────── */}
      <Section title="Progresso por Curso" icon={<TrendingUpIcon sx={{ fontSize: 18 }} />}>
        {errCursos ? (
          <Alert severity="error" sx={{ m: 2 }}>Erro ao carregar dados.</Alert>
        ) : loadCursos ? (
          <LoadingRows />
        ) : cursos.length === 0 ? (
          <Empty msg="Nenhum curso encontrado." />
        ) : (
          <Box sx={{ display: "flex", flexDirection: "column" }}>
            {cursos.map((curso, i) => (
              <Box key={curso.id}>
                <Box sx={{ px: 3, py: 2 }}>
                  <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", mb: 1 }}>
                    <Box sx={{ display: "flex", alignItems: "center", gap: 1.5 }}>
                      <Typography variant="body2" fontWeight={700}>{curso.nome}</Typography>
                      <Typography variant="caption" sx={{ fontFamily: "monospace", color: "text.disabled" }}>
                        {curso.codigo}
                      </Typography>
                      {curso.oasAtrasados > 0 && (
                        <Chip
                          label={`${curso.oasAtrasados} atraso${curso.oasAtrasados > 1 ? "s" : ""}`}
                          size="small"
                          sx={{ height: 18, fontSize: "0.65rem", bgcolor: "#fff5f5", color: "#ef4444", fontWeight: 700 }}
                        />
                      )}
                    </Box>
                    <Box sx={{ display: "flex", alignItems: "center", gap: 2 }}>
                      <Typography variant="caption" color="text.secondary">
                        {curso.oasConcluidos}/{curso.totalOAs} OAs
                      </Typography>
                      <Typography
                        variant="body2" fontWeight={800}
                        sx={{ minWidth: 36, textAlign: "right",
                          color: curso.progressoPct >= 80 ? "#10b981" : curso.progressoPct >= 40 ? "#f59e0b" : "text.primary" }}
                      >
                        {curso.progressoPct}%
                      </Typography>
                    </Box>
                  </Box>
                  <LinearProgress
                    variant="determinate" value={curso.progressoPct}
                    sx={{
                      height: 8, borderRadius: 4, bgcolor: "#f1f5f9",
                      "& .MuiLinearProgress-bar": {
                        bgcolor: curso.progressoPct >= 80 ? "#10b981" : curso.progressoPct >= 40 ? "#f59e0b" : "#2b7cee",
                        borderRadius: 4,
                      },
                    }}
                  />
                </Box>
                {i < cursos.length - 1 && <Divider />}
              </Box>
            ))}
          </Box>
        )}
      </Section>

      <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", md: "1fr 1fr" }, gap: 3, mt: 3 }}>

        {/* ── Status do Pipeline ──────────────────────────────────────────────── */}
        <Section title="Status do Pipeline">
          {errPipeline ? (
            <Alert severity="error" sx={{ m: 2 }}>Erro ao carregar dados.</Alert>
          ) : loadPipeline ? (
            <LoadingRows n={4} />
          ) : !pipeline ? null : (
            <Box>
              <Typography variant="caption" sx={{ px: 3, pt: 2, pb: 1, display: "block", color: "text.disabled", letterSpacing: "0.06em", fontWeight: 700 }}>
                POR STATUS
              </Typography>
              <Box sx={{ px: 3, pb: 2, display: "flex", flexWrap: "wrap", gap: 1 }}>
                {pipeline.porStatus.map((s) => {
                  const cfg = STATUS_CONFIG[s.status as StatusEtapa] ?? STATUS_CONFIG.PENDENTE;
                  return (
                    <Box key={s.status} sx={{ display: "flex", alignItems: "center", gap: 1.5,
                      bgcolor: cfg.bg, px: 2, py: 1.25, borderRadius: 2, minWidth: 130 }}>
                      <Box sx={{ width: 8, height: 8, borderRadius: "50%", bgcolor: cfg.color, flexShrink: 0 }} />
                      <Box>
                        <Typography variant="caption" color="text.secondary" sx={{ display: "block" }}>{cfg.label}</Typography>
                        <Typography sx={{ fontWeight: 800, fontSize: "1.375rem", lineHeight: 1, color: cfg.color }}>
                          {s.total}
                        </Typography>
                      </Box>
                    </Box>
                  );
                })}
              </Box>

              <Divider />

              <Typography variant="caption" sx={{ px: 3, pt: 2, pb: 1, display: "block", color: "text.disabled", letterSpacing: "0.06em", fontWeight: 700 }}>
                POR ETAPA
              </Typography>
              <Box sx={{ px: 3, pb: 2, display: "flex", flexDirection: "column", gap: 1.5 }}>
                {pipeline.porEtapa.map((e) => {
                  const max = Math.max(...pipeline.porEtapa.map((x) => x.total), 1);
                  return (
                    <Box key={e.etapa}>
                      <Box sx={{ display: "flex", justifyContent: "space-between", mb: 0.5 }}>
                        <Typography variant="caption" color="text.secondary">{e.etapa}</Typography>
                        <Typography variant="caption" fontWeight={700}>{e.total}</Typography>
                      </Box>
                      <LinearProgress variant="determinate" value={(e.total / max) * 100}
                        sx={{ height: 6, borderRadius: 3, bgcolor: "#f1f5f9",
                          "& .MuiLinearProgress-bar": { bgcolor: "#2b7cee", borderRadius: 3 } }} />
                    </Box>
                  );
                })}
              </Box>
            </Box>
          )}
        </Section>

        {/* ── Atrasos por Responsável ─────────────────────────────────────────── */}
        <Section title="Atrasos por Responsável" icon={<WarningAmberIcon sx={{ fontSize: 18, color: "#ef4444" }} />}>
          {errAtrasos ? (
            <Alert severity="error" sx={{ m: 2 }}>Erro ao carregar dados.</Alert>
          ) : loadAtrasos ? (
            <LoadingRows n={4} />
          ) : atrasos.length === 0 ? (
            <Empty msg="Nenhum atraso registrado." ok />
          ) : (
            <Table size="small">
              <TableHead>
                <TableRow sx={{ bgcolor: "#f8fafc" }}>
                  {["Responsável", "OAs atrasados", "Pior atraso"].map((h) => (
                    <TableCell key={h} sx={{ fontWeight: 700, fontSize: "0.75rem", color: "text.secondary", py: 1.5 }}>{h}</TableCell>
                  ))}
                </TableRow>
              </TableHead>
              <TableBody>
                {atrasos.map((r) => {
                  const piorAtraso = Math.max(...r.detalhes.map((d) => d.diasAtraso));
                  return (
                    <TableRow key={r.email} sx={{ "&:hover": { bgcolor: "action.hover" } }}>
                      <TableCell sx={{ py: 1.5 }}>
                        <Typography variant="body2" fontWeight={600}>{r.nome}</Typography>
                        <Typography variant="caption" color="text.disabled">{r.email}</Typography>
                      </TableCell>
                      <TableCell>
                        <Chip label={r.total} size="small"
                          sx={{ bgcolor: "#fff5f5", color: "#ef4444", fontWeight: 700, fontSize: "0.75rem" }} />
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2" color="error" fontWeight={600}>{piorAtraso}d</Typography>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </Section>
      </Box>
    </Box>
  );
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function Section({ title, icon, children }: { title: string; icon?: ReactNode; children: ReactNode }) {
  return (
    <Card>
      <CardContent sx={{ p: 0, pb: "0 !important" }}>
        <Box sx={{ px: 3, py: 2, display: "flex", alignItems: "center", gap: 1,
          borderBottom: "1px solid", borderColor: "divider" }}>
          {icon && <Box sx={{ color: "text.secondary", display: "flex" }}>{icon}</Box>}
          <Typography variant="h6" sx={{ fontWeight: 700, fontSize: "0.95rem" }}>{title}</Typography>
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
    <Box sx={{ p: 4, textAlign: "center" }}>
      <Typography color={ok ? "#10b981" : "text.secondary"} variant="body2">{msg}</Typography>
    </Box>
  );
}
