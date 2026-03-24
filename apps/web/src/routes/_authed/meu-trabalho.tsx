import { createFileRoute, Link } from "@tanstack/react-router";
import {
  Box, Typography, Card, CardContent, Chip, Button,
  LinearProgress, Skeleton, Alert, Divider,
} from "@mui/material";
import AssignmentOutlinedIcon from "@mui/icons-material/AssignmentOutlined";
import { useMeuTrabalho, useAtualizarEtapaGeral } from "@/lib/api/cursos";
import type { TipoOA, StatusEtapa } from "shared";

export const Route = createFileRoute("/_authed/meu-trabalho")({
  component: MeuTrabalhoPage,
});

const TIPO_CONFIG: Record<TipoOA, { label: string; color: string }> = {
  VIDEO:      { label: "Vídeo",         color: "#2b7cee" },
  SLIDE:      { label: "Slide",         color: "#7c3aed" },
  QUIZ:       { label: "Quiz",          color: "#0891b2" },
  EBOOK:      { label: "E-book",        color: "#059669" },
  PLANO_AULA: { label: "Plano de Aula", color: "#d97706" },
  TAREFA:     { label: "Tarefa",        color: "#dc2626" },
};

const ETAPA_STATUS: Record<StatusEtapa, { label: string; color: string; bg: string }> = {
  PENDENTE:     { label: "Pendente",     color: "#64748b", bg: "#f8fafc" },
  EM_ANDAMENTO: { label: "Em Andamento", color: "#f59e0b", bg: "#fffbeb" },
  CONCLUIDA:    { label: "Concluída",    color: "#10b981", bg: "#f0fdf4" },
  BLOQUEADA:    { label: "Bloqueada",    color: "#ef4444", bg: "#fff5f5" },
};

function MeuTrabalhoPage() {
  const { data: oas = [], isLoading, isError } = useMeuTrabalho();
  const { mutate: atualizarEtapa, isPending: concluindo } = useAtualizarEtapaGeral();

  // Agrupa por etapa ativa
  const grupos = oas.reduce<Record<string, typeof oas>>((acc, oa) => {
    const etapa = oa.etapas[0];
    const key = etapa?.etapaDef.nome ?? "Sem etapa";
    acc[key] = acc[key] ?? [];
    acc[key]!.push(oa);
    return acc;
  }, {});

  const vencidos = oas.filter((oa) =>
    oa.deadlineFinal && new Date(oa.deadlineFinal) < new Date()
  ).length;

  return (
    <Box>
      <Box sx={{ mb: 3 }}>
        <Typography sx={{ fontSize: "1.5rem", fontWeight: 800, mb: 0.5 }}>Meu Trabalho</Typography>
        <Typography variant="body2" color="text.secondary">
          {oas.length} OA{oas.length !== 1 ? "s" : ""} atribuído{oas.length !== 1 ? "s" : ""} a você
          {vencidos > 0 && <> · <span style={{ color: "#ef4444", fontWeight: 600 }}>{vencidos} com prazo vencido</span></>}
        </Typography>
      </Box>

      {isLoading ? (
        [1,2,3].map((i) => <Skeleton key={i} height={80} sx={{ mb: 1.5, borderRadius: 2 }} />)
      ) : isError ? (
        <Alert severity="error">Erro ao carregar tarefas.</Alert>
      ) : oas.length === 0 ? (
        <Card>
          <CardContent sx={{ p: 6, textAlign: "center" }}>
            <Box sx={{ bgcolor: "#eff6ff", width: 64, height: 64, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", mx: "auto", mb: 2 }}>
              <AssignmentOutlinedIcon sx={{ color: "primary.main", fontSize: 32 }} />
            </Box>
            <Typography variant="h6" sx={{ mb: 1 }}>Nenhuma tarefa pendente</Typography>
            <Typography variant="body2" color="text.secondary">
              Quando alguém atribuir um OA a você, ele aparecerá aqui.
            </Typography>
          </CardContent>
        </Card>
      ) : (
        Object.entries(grupos).map(([etapaNome, items]) => (
          <Box key={etapaNome} sx={{ mb: 3 }}>
            <Typography variant="caption" sx={{ fontWeight: 700, color: "text.disabled", letterSpacing: "0.06em", mb: 1, display: "block" }}>
              {etapaNome.toUpperCase()} — {items.length} OA{items.length !== 1 ? "s" : ""}
            </Typography>
            <Card>
              <CardContent sx={{ p: 0, pb: "0 !important" }}>
                {items.map((oa, idx) => {
                  const etapa  = oa.etapas[0];
                  const tc     = TIPO_CONFIG[oa.tipo];
                  const sc     = etapa ? ETAPA_STATUS[etapa.status] : ETAPA_STATUS.PENDENTE;
                  const vencido = oa.deadlineFinal && new Date(oa.deadlineFinal) < new Date();
                  return (
                    <Box key={oa.id}>
                      <Box sx={{ px: 2.5, py: 2, display: "flex", alignItems: "center", gap: 2 }}>
                        <Box sx={{ flex: 1, minWidth: 0 }}>
                          <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 0.5 }}>
                            <Typography variant="body2" fontWeight={700} sx={{ fontFamily: "monospace" }}>
                              {oa.codigo}
                            </Typography>
                            <Chip label={tc.label} size="small"
                              sx={{ bgcolor: `${tc.color}18`, color: tc.color, fontSize: "0.65rem", height: 18 }} />
                            <Chip label={sc.label} size="small"
                              sx={{ bgcolor: sc.bg, color: sc.color, fontSize: "0.65rem", height: 18 }} />
                            {vencido && (
                              <Chip label="Vencido" size="small"
                                sx={{ bgcolor: "#fff5f5", color: "#ef4444", fontSize: "0.65rem", height: 18, fontWeight: 700 }} />
                            )}
                          </Box>
                          <Typography variant="caption" color="text.secondary" noWrap>
                            {oa.capitulo.unidade.curso.nome} › {oa.capitulo.unidade.nome} › {oa.capitulo.nome}
                          </Typography>
                          <LinearProgress variant="determinate" value={oa.progressoPct}
                            sx={{ mt: 0.75, height: 4, borderRadius: 2, width: 120 }} />
                        </Box>
                        <Box sx={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 0.5 }}>
                          {oa.deadlineFinal && (
                            <Typography variant="caption" color={vencido ? "error" : "text.disabled"}>
                              {new Date(oa.deadlineFinal).toLocaleDateString("pt-BR")}
                            </Typography>
                          )}
                          {etapa && etapa.status !== "CONCLUIDA" && (
                            <Button
                              size="small" variant="contained" color="success"
                              disabled={concluindo}
                              onClick={() => atualizarEtapa({
                                oaId: oa.id, etapaId: etapa.id,
                                data: { status: "CONCLUIDA", deadlineReal: new Date().toISOString() },
                              })}
                              sx={{ fontSize: "0.7rem", py: 0.25, fontWeight: 700 }}
                            >
                              Concluir
                            </Button>
                          )}
                          <Button component={Link} to={`/oas/${oa.id}`} size="small" variant="outlined"
                            sx={{ fontSize: "0.7rem", py: 0.25 }}>
                            Abrir
                          </Button>
                        </Box>
                      </Box>
                      {idx < items.length - 1 && <Divider />}
                    </Box>
                  );
                })}
              </CardContent>
            </Card>
          </Box>
        ))
      )}
    </Box>
  );
}
