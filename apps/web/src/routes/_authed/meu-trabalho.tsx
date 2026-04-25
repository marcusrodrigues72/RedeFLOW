import { createFileRoute, Link } from "@tanstack/react-router";
import {
  Box, Typography, Card, CardContent, Chip, Button,
  LinearProgress, Skeleton, Alert, Divider, Tabs, Tab, IconButton, Snackbar,
} from "@mui/material";
import AssignmentOutlinedIcon from "@mui/icons-material/AssignmentOutlined";
import ChevronLeftIcon        from "@mui/icons-material/ChevronLeft";
import ChevronRightIcon       from "@mui/icons-material/ChevronRight";
import { useState, useMemo }  from "react";
import { useMeuTrabalho, useAtualizarEtapaGeral } from "@/lib/api/cursos";
import type { OADetalhe, TipoOA, StatusEtapa } from "shared";

export const Route = createFileRoute("/_authed/meu-trabalho")({
  component: MeuTrabalhoPage,
});

// ─── Configs ──────────────────────────────────────────────────────────────────

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

const ETAPA_STATUS: Record<StatusEtapa, { label: string; color: string; bg: string }> = {
  PENDENTE:     { label: "Pendente",     color: "#64748b", bg: "#f8fafc" },
  EM_ANDAMENTO: { label: "Em Andamento", color: "#f59e0b", bg: "#fffbeb" },
  CONCLUIDA:    { label: "Concluída",    color: "#10b981", bg: "#f0fdf4" },
  BLOQUEADA:    { label: "Bloqueada",    color: "#ef4444", bg: "#fff5f5" },
};

const DIAS_SEMANA = ["Seg", "Ter", "Qua", "Qui", "Sex", "Sáb", "Dom"];

const KANBAN_COLS: { status: StatusEtapa; label: string; color: string; bg: string }[] = [
  { status: "PENDENTE",     label: "Pendente",     color: "#64748b", bg: "#f8fafc" },
  { status: "EM_ANDAMENTO", label: "Em Andamento", color: "#f59e0b", bg: "#fffbeb" },
  { status: "BLOQUEADA",    label: "Bloqueada",    color: "#ef4444", bg: "#fff5f5" },
  { status: "CONCLUIDA",    label: "Concluída",    color: "#10b981", bg: "#f0fdf4" },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

const hoje = new Date();
hoje.setHours(0, 0, 0, 0);

function toDateOnly(iso: string | null | undefined): Date | null {
  if (!iso) return null;
  const d = new Date(iso);
  d.setHours(0, 0, 0, 0);
  return d;
}

function fmtData(iso: string | null | undefined) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
}

// Dia da semana → coluna 0=Seg … 6=Dom
const dow = (d: Date) => (d.getDay() + 6) % 7;

// ─── Page ─────────────────────────────────────────────────────────────────────

function MeuTrabalhoPage() {
  const { data: oas = [], isLoading, isError } = useMeuTrabalho();
  const { mutate: atualizarEtapa, isPending: atualizando } = useAtualizarEtapaGeral();
  const [aba,      setAba]      = useState(0);
  const [errMsg,   setErrMsg]   = useState<string | null>(null);

  // KPIs
  const porStatus = useMemo(() => {
    const counts = { PENDENTE: 0, EM_ANDAMENTO: 0, BLOQUEADA: 0, CONCLUIDA: 0 };
    oas.forEach((oa) => {
      const s = oa.etapas[0]?.status ?? "PENDENTE";
      counts[s] = (counts[s] ?? 0) + 1;
    });
    return counts;
  }, [oas]);

  const emAtraso = oas.filter(
    (oa) => oa.etapas[0]?.deadlinePrevisto && new Date(oa.etapas[0].deadlinePrevisto) < hoje
      && oa.etapas[0]?.status !== "CONCLUIDA",
  ).length;

  // Wrapper que captura erro 422 de predecessora
  const atualizarComValidacao: typeof atualizarEtapa = (vars, opts) => {
    atualizarEtapa(vars, {
      ...opts,
      onError: (err: any) => {
        const msg = err?.response?.data?.message ?? "Erro ao atualizar etapa.";
        setErrMsg(msg);
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (opts?.onError as any)?.(err, vars, undefined);
      },
    });
  };

  const kpis = [
    { label: "Total",        value: oas.length,              color: "#2b7cee", bg: "#eff6ff" },
    { label: "Pendentes",    value: porStatus.PENDENTE,      color: "#64748b", bg: "#f8fafc" },
    { label: "Em Andamento", value: porStatus.EM_ANDAMENTO,  color: "#f59e0b", bg: "#fffbeb" },
    { label: "Bloqueadas",   value: porStatus.BLOQUEADA,     color: "#ef4444", bg: "#fff5f5" },
    { label: "Concluídas",   value: porStatus.CONCLUIDA,     color: "#10b981", bg: "#f0fdf4" },
    { label: "Em Atraso",    value: emAtraso,                color: "#dc2626", bg: "#fff0f0" },
  ];

  return (
    <Box>
      <Box sx={{ mb: 2 }}>
        <Typography sx={{ fontSize: "1.5rem", fontWeight: 800, mb: 0.5 }}>Meu Trabalho</Typography>
      </Box>

      {/* KPI Cards */}
      {!isLoading && !isError && (
        <Box sx={{ display: "flex", gap: 2, mb: 3, flexWrap: "wrap" }}>
          {kpis.map((k) => (
            <Card key={k.label} sx={{ minWidth: 110, flex: "1 1 110px" }}>
              <CardContent sx={{ p: 2, pb: "10px !important" }}>
                <Typography sx={{ fontSize: "1.75rem", fontWeight: 900, color: k.color, lineHeight: 1 }}>
                  {k.value}
                </Typography>
                <Typography variant="caption" color="text.secondary" sx={{ mt: 0.25, display: "block" }}>
                  {k.label}
                </Typography>
                <Box sx={{ height: 3, borderRadius: 2, bgcolor: k.color, mt: 1, opacity: 0.25 }} />
              </CardContent>
            </Card>
          ))}
        </Box>
      )}

      <Tabs
        value={aba} onChange={(_, v) => setAba(v)}
        sx={{ mb: 3, borderBottom: "1px solid", borderColor: "divider" }}
      >
        <Tab label="Lista" />
        <Tab label="Calendário" />
        <Tab label="Kanban" />
      </Tabs>

      {isLoading ? (
        [1, 2, 3].map((i) => <Skeleton key={i} height={80} sx={{ mb: 1.5, borderRadius: 2 }} />)
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
      ) : aba === 0 ? (
        <ListaView oas={oas} atualizarEtapa={atualizarComValidacao} atualizando={atualizando} />
      ) : aba === 1 ? (
        <CalendarioView oas={oas} />
      ) : (
        <KanbanView oas={oas} atualizarEtapa={atualizarComValidacao} />
      )}

      <Snackbar
        open={!!errMsg} autoHideDuration={5000} onClose={() => setErrMsg(null)}
        message={errMsg}
        anchorOrigin={{ vertical: "bottom", horizontal: "center" }}
        ContentProps={{ sx: { bgcolor: "#dc2626" } }}
      />
    </Box>
  );
}

// ─── Visão Lista ──────────────────────────────────────────────────────────────

function ListaView({
  oas, atualizarEtapa, atualizando,
}: {
  oas: OADetalhe[];
  atualizarEtapa: ReturnType<typeof useAtualizarEtapaGeral>["mutate"];
  atualizando: boolean;
}) {
  const grupos = oas.reduce<Record<string, OADetalhe[]>>((acc, oa) => {
    const etapa = oa.etapas[0];
    const key   = etapa?.etapaDef.nome ?? "Sem etapa";
    acc[key]    = acc[key] ?? [];
    acc[key]!.push(oa);
    return acc;
  }, {});

  return (
    <>
      {Object.entries(grupos).map(([etapaNome, items]) => (
        <Box key={etapaNome} sx={{ mb: 3 }}>
          <Typography variant="caption" sx={{ fontWeight: 700, color: "text.disabled", letterSpacing: "0.06em", mb: 1, display: "block" }}>
            {etapaNome.toUpperCase()} — {items.length} OA{items.length !== 1 ? "s" : ""}
          </Typography>
          <Card>
            <CardContent sx={{ p: 0, pb: "0 !important" }}>
              {items.map((oa, idx) => {
                const etapa   = oa.etapas[0];
                const tc      = TIPO_CONFIG[oa.tipo];
                const sc      = etapa ? ETAPA_STATUS[etapa.status] : ETAPA_STATUS.PENDENTE;
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
                            disabled={atualizando}
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
      ))}
    </>
  );
}

// ─── Visão Calendário ─────────────────────────────────────────────────────────

type CalEvent = {
  oa: OADetalhe;
  etapa: OADetalhe["etapas"][0] | undefined;
  start: Date;
  end: Date;
};

function CalendarioView({ oas }: { oas: OADetalhe[] }) {
  const [mesBase, setMesBase] = useState(
    () => new Date(hoje.getFullYear(), hoje.getMonth(), 1),
  );

  const prevMes   = () => setMesBase((m) => new Date(m.getFullYear(), m.getMonth() - 1, 1));
  const nextMes   = () => setMesBase((m) => new Date(m.getFullYear(), m.getMonth() + 1, 1));
  const irHoje    = () => setMesBase(new Date(hoje.getFullYear(), hoje.getMonth(), 1));

  // Montar eventos: barra de hoje até o deadline da etapa (ou deadlineFinal)
  const events = useMemo<CalEvent[]>(() => {
    return oas.flatMap((oa) => {
      const etapa   = oa.etapas[0];
      const endDate = toDateOnly(etapa?.deadlinePrevisto ?? oa.deadlineFinal);
      if (!endDate) return [];

      // Start: se concluída usa deadlineReal, caso contrário usa hoje
      let startDate: Date;
      if (etapa?.status === "CONCLUIDA" && etapa.deadlineReal) {
        startDate = toDateOnly(etapa.deadlineReal) ?? new Date(endDate);
      } else {
        startDate = new Date(hoje);
      }
      // Garante que start <= end
      if (startDate > endDate) startDate = new Date(endDate);

      return [{ oa, etapa, start: startDate, end: endDate }];
    });
  }, [oas]);

  // Montar grade do mês
  const semanas = useMemo(() => {
    const ano = mesBase.getFullYear();
    const mes = mesBase.getMonth();
    const primeiro = new Date(ano, mes, 1);
    const ultimo   = new Date(ano, mes + 1, 0);
    const startDow = dow(primeiro); // colunas antes do dia 1

    const dias: (Date | null)[] = [];
    for (let i = 0; i < startDow; i++) dias.push(null);
    for (let d = 1; d <= ultimo.getDate(); d++) dias.push(new Date(ano, mes, d));
    while (dias.length % 7 !== 0) dias.push(null);

    const semanas: (Date | null)[][] = [];
    for (let i = 0; i < dias.length; i += 7) semanas.push(dias.slice(i, i + 7));
    return semanas;
  }, [mesBase]);

  const mesLabel = mesBase.toLocaleDateString("pt-BR", { month: "long", year: "numeric" });
  const semData  = oas.filter((oa) => !oa.etapas[0]?.deadlinePrevisto && !oa.deadlineFinal);

  return (
    <Box>
      {/* Navegação */}
      <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 2 }}>
        <IconButton size="small" onClick={prevMes}><ChevronLeftIcon /></IconButton>
        <Typography variant="h6" fontWeight={700}
          sx={{ textTransform: "capitalize", minWidth: 230, textAlign: "center" }}>
          {mesLabel}
        </Typography>
        <IconButton size="small" onClick={nextMes}><ChevronRightIcon /></IconButton>
        <Button size="small" variant="outlined" onClick={irHoje}
          sx={{ ml: 1, fontSize: "0.75rem", textTransform: "none" }}>
          Hoje
        </Button>
      </Box>

      <Card>
        <CardContent sx={{ p: 0, pb: "0 !important" }}>
          {/* Cabeçalho dos dias */}
          <Box sx={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", bgcolor: "#f8fafc", borderBottom: "1px solid", borderColor: "divider" }}>
            {DIAS_SEMANA.map((d) => (
              <Box key={d} sx={{ py: 1, textAlign: "center" }}>
                <Typography variant="caption" fontWeight={700} color="text.secondary">{d}</Typography>
              </Box>
            ))}
          </Box>

          {/* Linhas de semanas */}
          {semanas.map((semana, si) => {
            const diasReais   = semana.filter(Boolean) as Date[];
            if (diasReais.length === 0) return null;
            const semanaStart = diasReais[0]!;
            const semanaEnd   = diasReais[diasReais.length - 1]!;

            const evsSemana = events.filter(
              (ev) => ev.end >= semanaStart && ev.start <= semanaEnd,
            );
            const rowH = Math.max(72, 36 + evsSemana.length * 22);

            return (
              <Box key={si} sx={{ position: "relative", borderBottom: si < semanas.length - 1 ? "1px solid" : "none", borderColor: "divider", minHeight: rowH }}>
                {/* Numeração dos dias */}
                <Box sx={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)" }}>
                  {semana.map((dia, di) => {
                    const isHojeDia = dia?.getTime() === hoje.getTime();
                    return (
                      <Box key={di} sx={{ borderLeft: di > 0 ? "1px solid" : "none", borderColor: "divider", px: 0.75, pt: 0.75, minHeight: rowH, bgcolor: dia ? "transparent" : "#fafafa" }}>
                        {dia && (
                          <Box sx={{ width: 22, height: 22, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", bgcolor: isHojeDia ? "primary.main" : "transparent" }}>
                            <Typography variant="caption" fontWeight={isHojeDia ? 700 : 400}
                              sx={{ color: isHojeDia ? "white" : "text.secondary", lineHeight: 1 }}>
                              {dia.getDate()}
                            </Typography>
                          </Box>
                        )}
                      </Box>
                    );
                  })}
                </Box>

                {/* Barras de eventos posicionadas absolutamente */}
                {evsSemana.map((ev, lane) => {
                  const clipStart = ev.start < semanaStart ? semanaStart : ev.start;
                  const clipEnd   = ev.end   > semanaEnd   ? semanaEnd   : ev.end;

                  const startCol = dow(clipStart);
                  const endCol   = dow(clipEnd);
                  const leftPct  = (startCol / 7) * 100;
                  const widthPct = ((endCol - startCol + 1) / 7) * 100;

                  const tc        = TIPO_CONFIG[ev.oa.tipo];
                  const concluida = ev.etapa?.status === "CONCLUIDA";
                  const vencida   = !concluida && ev.end < hoje;
                  const barColor  = vencida ? "#ef4444" : concluida ? "#10b981" : tc.color;

                  return (
                    <Box
                      key={ev.oa.id}
                      component={Link}
                      to={`/oas/${ev.oa.id}`}
                      title={`${ev.oa.codigo} · ${ev.etapa?.etapaDef.nome ?? ""} · ${fmtData(ev.start.toISOString())} → ${fmtData(ev.end.toISOString())}`}
                      sx={{
                        position: "absolute",
                        left:  `calc(${leftPct}%  + 2px)`,
                        width: `calc(${widthPct}% - 4px)`,
                        top:   36 + lane * 22,
                        height: 18,
                        bgcolor: `${barColor}18`,
                        borderLeft: `3px solid ${barColor}`,
                        borderRadius: "0 4px 4px 0",
                        display: "flex", alignItems: "center",
                        px: 0.75, overflow: "hidden",
                        textDecoration: "none", cursor: "pointer",
                        "&:hover": { filter: "brightness(0.88)" },
                        transition: "filter 0.12s",
                      }}
                    >
                      <Typography sx={{ fontSize: "0.6rem", fontWeight: 700, color: barColor, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                        {ev.oa.codigo}
                      </Typography>
                    </Box>
                  );
                })}
              </Box>
            );
          })}
        </CardContent>
      </Card>

      {/* OAs sem prazo definido */}
      {semData.length > 0 && (
        <Box sx={{ mt: 2 }}>
          <Typography variant="caption" sx={{ fontWeight: 700, color: "text.disabled", letterSpacing: "0.06em", display: "block", mb: 1 }}>
            SEM PRAZO DEFINIDO — {semData.length} OA{semData.length !== 1 ? "s" : ""}
          </Typography>
          <Box sx={{ display: "flex", gap: 1, flexWrap: "wrap" }}>
            {semData.map((oa) => {
              const tc = TIPO_CONFIG[oa.tipo];
              return (
                <Chip
                  key={oa.id}
                  component={Link}
                  to={`/oas/${oa.id}`}
                  label={oa.codigo}
                  size="small"
                  clickable
                  sx={{ bgcolor: `${tc.color}18`, color: tc.color, fontFamily: "monospace", fontWeight: 700 }}
                />
              );
            })}
          </Box>
        </Box>
      )}
    </Box>
  );
}

// ─── Visão Kanban ─────────────────────────────────────────────────────────────

function KanbanView({
  oas, atualizarEtapa,
}: {
  oas: OADetalhe[];
  atualizarEtapa: ReturnType<typeof useAtualizarEtapaGeral>["mutate"];
}) {
  const [overCol, setOverCol] = useState<StatusEtapa | null>(null);

  const etapaStatus = (oa: OADetalhe): StatusEtapa =>
    oa.etapas[0]?.status ?? "PENDENTE";

  const handleDrop = (oa: OADetalhe, novoStatus: StatusEtapa) => {
    const etapa = oa.etapas[0];
    if (!etapa || etapaStatus(oa) === novoStatus) return;
    atualizarEtapa({
      oaId: oa.id,
      etapaId: etapa.id,
      data: {
        status: novoStatus,
        ...(novoStatus === "CONCLUIDA" ? { deadlineReal: new Date().toISOString() } : {}),
      } as any,
    });
  };

  return (
    <Box sx={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 2, alignItems: "start" }}>
      {KANBAN_COLS.map((col) => {
        const colOAs = oas.filter((oa) => etapaStatus(oa) === col.status);
        const isOver = overCol === col.status;

        return (
          <Box
            key={col.status}
            onDragOver={(e) => { e.preventDefault(); e.dataTransfer.dropEffect = "move"; setOverCol(col.status); }}
            onDragLeave={(e) => { if (!e.currentTarget.contains(e.relatedTarget as Node)) setOverCol(null); }}
            onDrop={(e) => {
              e.preventDefault();
              setOverCol(null);
              const oaId = e.dataTransfer.getData("text/plain");
              const oa   = oas.find((o) => o.id === oaId);
              if (oa) handleDrop(oa, col.status);
            }}
            sx={{
              borderRadius: 3, border: "2px dashed",
              borderColor: isOver ? col.color : "transparent",
              bgcolor:     isOver ? `${col.color}08` : "transparent",
              transition: "border-color 0.15s, background-color 0.15s",
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
            <Box sx={{ display: "flex", flexDirection: "column", gap: 1.5, px: 0.5, pb: 1 }}>
              {colOAs.map((oa) => {
                const etapa   = oa.etapas[0];
                const tc      = TIPO_CONFIG[oa.tipo];
                const vencida = etapa?.deadlinePrevisto
                  && new Date(etapa.deadlinePrevisto) < hoje
                  && col.status !== "CONCLUIDA";

                return (
                  <Card
                    key={oa.id}
                    draggable
                    onDragStart={(e) => { e.dataTransfer.setData("text/plain", oa.id); e.dataTransfer.effectAllowed = "move"; }}
                    onDragOver={(e) => e.preventDefault()}
                    sx={{
                      cursor: "grab", borderRadius: 2,
                      boxShadow: "0 1px 4px rgba(0,0,0,0.08)",
                      "&:active":  { cursor: "grabbing" },
                      "&:hover":   { boxShadow: "0 4px 12px rgba(0,0,0,0.12)" },
                      transition:  "box-shadow 0.15s",
                      borderLeft:  `3px solid ${vencida ? "#ef4444" : col.color}`,
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

                      <Typography variant="caption" color="text.secondary" noWrap sx={{ display: "block", mb: 0.25 }}>
                        {oa.capitulo.unidade.nome}
                      </Typography>

                      {etapa && (
                        <Typography variant="caption" color="text.disabled" noWrap sx={{ display: "block", mb: 0.75 }}>
                          {etapa.etapaDef.nome}
                        </Typography>
                      )}

                      <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 0.75 }}>
                        <LinearProgress variant="determinate" value={oa.progressoPct}
                          sx={{ flex: 1, height: 4, borderRadius: 2, "& .MuiLinearProgress-bar": { bgcolor: col.color } }} />
                        <Typography variant="caption" sx={{ fontSize: "0.65rem", color: "text.disabled", minWidth: 24 }}>
                          {oa.progressoPct}%
                        </Typography>
                      </Box>

                      <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                        {etapa?.deadlinePrevisto ? (
                          <Typography variant="caption" sx={{ fontSize: "0.65rem", color: vencida ? "#ef4444" : "text.disabled", fontWeight: vencida ? 700 : 400 }}>
                            {vencida ? "⚠ " : ""}{fmtData(etapa.deadlinePrevisto)}
                          </Typography>
                        ) : <Box />}
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
