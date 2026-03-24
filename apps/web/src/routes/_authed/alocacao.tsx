import { createFileRoute } from "@tanstack/react-router";
import {
  Box, Typography, Card, CardContent, Avatar, Chip,
  Skeleton, Alert, Tooltip, ToggleButton, ToggleButtonGroup,
  Divider,
} from "@mui/material";
import PeopleAltIcon      from "@mui/icons-material/PeopleAlt";
import CalendarMonthIcon  from "@mui/icons-material/CalendarMonth";
import SpeedIcon          from "@mui/icons-material/Speed";
import { useState }       from "react";
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

/** Retorna a segunda-feira da semana que contém `d` */
function inicioSemana(d: Date): Date {
  const r = new Date(d);
  const dia = r.getDay(); // 0=dom
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

const PAPEL_CORES: Record<string, { bg: string; border: string; text: string }> = {
  CONTEUDISTA:           { bg: "#eff6ff", border: "#93c5fd", text: "#1d4ed8" },
  DESIGNER_INSTRUCIONAL: { bg: "#faf5ff", border: "#c4b5fd", text: "#6d28d9" },
  PROFESSOR_ATOR:        { bg: "#fff7ed", border: "#fdba74", text: "#c2410c" },
  PROFESSOR_TECNICO:     { bg: "#f0fdf4", border: "#86efac", text: "#15803d" },
  ACESSIBILIDADE:        { bg: "#fefce8", border: "#fde047", text: "#a16207" },
  PRODUTOR_FINAL:        { bg: "#f0f9ff", border: "#7dd3fc", text: "#0369a1" },
  VALIDADOR_FINAL:       { bg: "#fff1f2", border: "#fda4af", text: "#be123c" },
};

const PAPEL_LABEL: Record<string, string> = {
  CONTEUDISTA:           "Conteudista",
  DESIGNER_INSTRUCIONAL: "Designer Instrucional",
  PROFESSOR_ATOR:        "Prof. Ator",
  PROFESSOR_TECNICO:     "Revisor Técnico",
  ACESSIBILIDADE:        "Acessibilidade",
  PRODUTOR_FINAL:        "Produtor Final",
  VALIDADOR_FINAL:       "Validador Final",
};

function initials(nome: string) {
  return nome.split(" ").slice(0, 2).map((n) => n[0]).join("").toUpperCase();
}

// ─── Página ───────────────────────────────────────────────────────────────────

function AlocacaoPage() {
  const { data, isLoading, isError } = useAlocacao();
  const [view, setView] = useState<"semana" | "mes">("semana");

  if (isError) return <Alert severity="error">Erro ao carregar dados de alocação.</Alert>;

  const porPapel       = data?.porPapel       ?? [];
  const porResponsavel = data?.porResponsavel ?? [];
  const maxCarga       = Math.max(...porPapel.map((p) => p.emAndamento + p.pendente), 1);

  return (
    <Box>
      <Typography sx={{ fontSize: "1.375rem", fontWeight: 800, mb: 0.5 }}>Alocação do Time</Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
        Distribuição de atividades e carga de trabalho da equipe de produção
      </Typography>

      {/* ── Linha superior: Carga por Papel + Carga por Responsável ─────────── */}
      <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", md: "1fr 1fr" }, gap: 3, mb: 3 }}>

        {/* Carga por Papel */}
        <Card>
          <CardContent sx={{ p: 0, pb: "0 !important" }}>
            <SectionHeader title="Carga por Papel" icon={<SpeedIcon sx={{ fontSize: 18 }} />} />
            {isLoading ? <LoadingRows n={5} /> : porPapel.length === 0 ? (
              <Empty msg="Nenhuma etapa ativa atribuída." />
            ) : (
              <Box sx={{ p: 3, display: "flex", flexDirection: "column", gap: 2.5 }}>
                {porPapel.map((p) => {
                  const total  = p.emAndamento + p.pendente;
                  const pct    = Math.round((total / maxCarga) * 100);
                  const cor    = pct >= 80 ? "#ef4444" : pct >= 50 ? "#f59e0b" : "#10b981";
                  const cores  = PAPEL_CORES[p.papel] ?? PAPEL_CORES.CONTEUDISTA!;
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
                        <Box sx={{ width: `${maxCarga > 0 ? (p.emAndamento / maxCarga) * 100 : 0}%`, bgcolor: "#2b7cee", transition: "width 0.4s" }} />
                        <Box sx={{ width: `${maxCarga > 0 ? (p.pendente / maxCarga) * 100 : 0}%`, bgcolor: "#bfdbfe", transition: "width 0.4s" }} />
                      </Box>
                    </Box>
                  );
                })}
                {/* Legenda */}
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

        {/* Carga por Responsável */}
        <Card>
          <CardContent sx={{ p: 0, pb: "0 !important" }}>
            <SectionHeader title="Carga por Responsável" icon={<PeopleAltIcon sx={{ fontSize: 18 }} />} />
            {isLoading ? <LoadingRows n={5} /> : porResponsavel.length === 0 ? (
              <Empty msg="Nenhum responsável com etapas ativas." />
            ) : (
              <Box sx={{ p: 2, display: "flex", flexDirection: "column", gap: 1 }}>
                {porResponsavel.slice(0, 8).map((r) => {
                  const total    = r.emAndamento + r.pendente;
                  const maxTotal = Math.max(...porResponsavel.map((x) => x.emAndamento + x.pendente), 1);
                  const pct      = Math.round((total / maxTotal) * 100);
                  const cor      = pct >= 80 ? "#ef4444" : pct >= 50 ? "#f59e0b" : "#2b7cee";
                  return (
                    <Box key={r.usuarioId} sx={{ display: "flex", alignItems: "center", gap: 1.5, py: 0.75 }}>
                      <Avatar sx={{ width: 32, height: 32, bgcolor: cor, fontSize: "0.7rem", fontWeight: 700, flexShrink: 0 }}>
                        {r.fotoUrl ? <img src={r.fotoUrl} style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : initials(r.nome)}
                      </Avatar>
                      <Box sx={{ flex: 1, minWidth: 0 }}>
                        <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mb: 0.5 }}>
                          <Typography variant="body2" fontWeight={600} noWrap sx={{ maxWidth: 140 }}>{r.nome}</Typography>
                          <Box sx={{ display: "flex", alignItems: "center", gap: 0.75, flexShrink: 0 }}>
                            {r.emAndamento > 0 && (
                              <Chip label={`${r.emAndamento} ativos`} size="small"
                                sx={{ height: 18, fontSize: "0.65rem", fontWeight: 700, bgcolor: "#eff6ff", color: "#2b7cee" }} />
                            )}
                            {r.pendente > 0 && (
                              <Chip label={`${r.pendente} pend.`} size="small"
                                sx={{ height: 18, fontSize: "0.65rem", bgcolor: "#f8fafc", color: "#64748b" }} />
                            )}
                          </Box>
                        </Box>
                        <Box sx={{ height: 5, borderRadius: 3, bgcolor: "#f1f5f9", overflow: "hidden", display: "flex" }}>
                          <Box sx={{ width: `${(r.emAndamento / maxTotal) * 100}%`, bgcolor: cor }} />
                          <Box sx={{ width: `${(r.pendente / maxTotal) * 100}%`, bgcolor: cor + "55" }} />
                        </Box>
                      </Box>
                    </Box>
                  );
                })}
                {porResponsavel.length > 8 && (
                  <Typography variant="caption" color="text.disabled" sx={{ textAlign: "center", pt: 1 }}>
                    +{porResponsavel.length - 8} pessoa(s) com etapas ativas
                  </Typography>
                )}
              </Box>
            )}
          </CardContent>
        </Card>
      </Box>

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
            <LoadingRows n={4} />
          ) : porResponsavel.length === 0 ? (
            <Empty msg="Nenhuma etapa ativa atribuída." />
          ) : (
            <AgendaTimeline pessoas={porResponsavel} view={view} />
          )}
        </CardContent>
      </Card>
    </Box>
  );
}

// ─── Timeline ─────────────────────────────────────────────────────────────────

function AgendaTimeline({ pessoas, view }: { pessoas: ResponsavelAlocacao[]; view: "semana" | "mes" }) {
  const hoje_      = hoje();
  const semAtual   = inicioSemana(hoje_);

  // Gera colunas: 1 semana antes + atual + 5 próximas = 7 semanas
  // ou 1 mês antes + atual + 5 próximos = 7 meses
  const N = 7;
  const colunas: { inicio: Date; fim: Date; label: string; isHoje: boolean }[] = [];

  for (let i = -1; i < N - 1; i++) {
    if (view === "semana") {
      const ini = addDays(semAtual, i * 7);
      const fim = addDays(ini, 6);
      const isHoje = ini <= hoje_ && hoje_ <= fim;
      colunas.push({ inicio: ini, fim: fim, label: `${fmtDia(ini)}`, isHoje });
    } else {
      const ini = addMonths(new Date(hoje_.getFullYear(), hoje_.getMonth(), 1), i);
      const fim = addDays(addMonths(ini, 1), -1);
      const isHoje = ini.getFullYear() === hoje_.getFullYear() && ini.getMonth() === hoje_.getMonth();
      colunas.push({ inicio: ini, fim: fim, label: fmtMes(ini), isHoje });
    }
  }

  // Atrasados: deadline < início da primeira coluna
  const limiteInicio = colunas[0]!.inicio;

  // Filtra apenas pessoas com etapas no horizonte visível (incluindo atrasados)
  const pessoasVisiveis = pessoas.filter((p) =>
    p.etapas.some((e) => !e.deadlinePrevisto || new Date(e.deadlinePrevisto) >= addDays(limiteInicio, -30))
  );

  const COL_W = 140; // px por coluna
  const PESSOA_W = 200;

  return (
    <Box sx={{ overflowX: "auto" }}>
      <Box sx={{ minWidth: PESSOA_W + COL_W * (N + 1), pb: 2 }}>

        {/* Header */}
        <Box sx={{ display: "flex", borderBottom: "1px solid", borderColor: "divider", bgcolor: "#f8fafc", position: "sticky", top: 0, zIndex: 10 }}>
          <Box sx={{ width: PESSOA_W, flexShrink: 0, px: 3, py: 1.5 }}>
            <Typography variant="caption" fontWeight={700} color="text.secondary">PROFISSIONAL</Typography>
          </Box>
          {/* Coluna "Atrasado" */}
          <Box sx={{ width: COL_W, flexShrink: 0, px: 1, py: 1.5, textAlign: "center", borderLeft: "1px solid", borderColor: "divider", bgcolor: "#fff5f5" }}>
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

        {/* Linhas por pessoa */}
        {pessoasVisiveis.map((pessoa, pi) => {
          const atrasadas = pessoa.etapas.filter((e) =>
            e.deadlinePrevisto && new Date(e.deadlinePrevisto) < limiteInicio
          );

          return (
            <Box key={pessoa.usuarioId}>
              <Box sx={{ display: "flex", alignItems: "flex-start", minHeight: 64,
                "&:hover": { bgcolor: "action.hover" },
                borderBottom: pi < pessoasVisiveis.length - 1 ? "1px solid" : "none",
                borderColor: "divider",
              }}>
                {/* Pessoa */}
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

                {/* Coluna atrasados */}
                <Box sx={{ width: COL_W, flexShrink: 0, px: 0.75, py: 1, borderLeft: "1px solid", borderColor: "divider",
                  bgcolor: atrasadas.length > 0 ? "#fff5f5" : "transparent", alignSelf: "stretch",
                  display: "flex", flexDirection: "column", gap: 0.5 }}>
                  {atrasadas.map((e) => <EtapaChip key={e.etapaId} etapa={e} overdue />)}
                </Box>

                {/* Colunas semanais/mensais */}
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
                      alignSelf: "stretch",
                      display: "flex", flexDirection: "column", gap: 0.5,
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

// ─── Helpers ──────────────────────────────────────────────────────────────────

function SectionHeader({ title, icon }: { title: string; icon?: React.ReactNode }) {
  return (
    <Box sx={{ px: 3, py: 2, display: "flex", alignItems: "center", gap: 1,
      borderBottom: "1px solid", borderColor: "divider" }}>
      {icon && <Box sx={{ color: "text.secondary", display: "flex" }}>{icon}</Box>}
      <Typography variant="h6" sx={{ fontWeight: 700, fontSize: "0.95rem" }}>{title}</Typography>
    </Box>
  );
}

function LoadingRows({ n = 3 }: { n?: number }) {
  return (
    <Box sx={{ p: 3, display: "flex", flexDirection: "column", gap: 1.5 }}>
      {Array.from({ length: n }).map((_, i) => <Skeleton key={i} height={40} sx={{ borderRadius: 2 }} />)}
    </Box>
  );
}

function Empty({ msg }: { msg: string }) {
  return (
    <Box sx={{ p: 5, textAlign: "center" }}>
      <Typography color="text.secondary" variant="body2">{msg}</Typography>
    </Box>
  );
}
