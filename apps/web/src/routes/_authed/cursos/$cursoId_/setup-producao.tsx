import { createFileRoute, Link } from "@tanstack/react-router";
import {
  Box, Typography, Chip, Button, Card, CardContent, Accordion,
  AccordionSummary, AccordionDetails, TextField, Select, MenuItem,
  FormControl, InputLabel, Alert, Skeleton, Snackbar, Divider,
  LinearProgress, FormControlLabel, Checkbox, Tooltip, Avatar,
} from "@mui/material";
import ArrowBackIcon        from "@mui/icons-material/ArrowBack";
import ExpandMoreIcon       from "@mui/icons-material/ExpandMore";
import CheckCircleIcon      from "@mui/icons-material/CheckCircle";
import LinkIcon             from "@mui/icons-material/Link";
import VerifiedIcon         from "@mui/icons-material/Verified";
import PersonIcon           from "@mui/icons-material/Person";
import AutoAwesomeIcon      from "@mui/icons-material/AutoAwesome";
import PlayArrowIcon        from "@mui/icons-material/PlayArrow";
import { useState }         from "react";
import {
  useOAsByCurso, useCurso, useAtualizarOA, useAtualizarEtapaGeral,
  useValidarMatriz, useDefinirCoordenadorProducao,
  useSugestaoAlocacao, useAplicarSugestao,
} from "@/lib/api/cursos";
import { useAuthStore } from "@/stores/auth.store";
import type { OADetalhe, TipoOA, StatusEtapa, SugestaoAlocacao, SugestaoItem } from "shared";

export const Route = createFileRoute("/_authed/cursos/$cursoId_/setup-producao")({
  component: SetupProducaoPage,
});

const TIPO_CONFIG: Record<TipoOA, { label: string; color: string }> = {
  VIDEO:       { label: "Vídeo",         color: "#2b7cee" },
  SLIDE:       { label: "Slide",         color: "#7c3aed" },
  QUIZ:        { label: "Quiz",          color: "#0891b2" },
  EBOOK:       { label: "E-book",        color: "#059669" },
  PLANO_AULA:  { label: "Plano de Aula", color: "#d97706" },
  TAREFA:      { label: "Tarefa",        color: "#dc2626" },
  INFOGRAFICO: { label: "Infográfico",   color: "#7e22ce" },
  TIMELINE:    { label: "Timeline",      color: "#0f766e" },
};

function SetupProducaoPage() {
  const { cursoId } = Route.useParams();
  const { data: curso, isLoading: loadingCurso } = useCurso(cursoId);
  const { data: oas = [], isLoading: loadingOAs, isError } = useOAsByCurso(cursoId, {});
  const [filtro, setFiltro]     = useState<"todos" | "pendente" | "concluido">("pendente");
  const [snackMsg, setSnackMsg] = useState<string | null>(null);
  const user = useAuthStore((s) => s.user);

  const { mutate: validarMatriz, isPending: validando } = useValidarMatriz(cursoId);

  if (loadingCurso || loadingOAs) return <LoadingSkeleton />;
  if (isError) return <Alert severity="error">Erro ao carregar OAs.</Alert>;

  const isAdmin = user?.papelGlobal === "ADMIN"
    || curso?.membros.some((m) => m.usuarioId === user?.id && m.papel === "ADMIN");
  if (!isAdmin) return <Alert severity="error">Acesso restrito. Apenas administradores do curso podem acessar o Setup de Produção.</Alert>;

  // OAs com etapa de Setup
  const oasComSetup = oas.filter((oa) =>
    oa.etapas.some((e) => e.etapaDef.papel === "COORDENADOR_PRODUCAO")
  );

  const oasFiltrados = oasComSetup.filter((oa) => {
    const setup = oa.etapas.find((e) => e.etapaDef.papel === "COORDENADOR_PRODUCAO");
    const concluido = setup?.status === "CONCLUIDA";
    if (filtro === "pendente")  return !concluido;
    if (filtro === "concluido") return concluido;
    return true;
  });

  const totalSetup     = oasComSetup.length;
  const totalConcluido = oasComSetup.filter((oa) =>
    oa.etapas.find((e) => e.etapaDef.papel === "COORDENADOR_PRODUCAO")?.status === "CONCLUIDA"
  ).length;
  const pct = totalSetup > 0 ? Math.round((totalConcluido / totalSetup) * 100) : 0;

  const matrizValidada    = !!curso?.matrizValidadaEm;
  const temOAsImportados  = oasComSetup.length > 0;

  // Membros do curso para seletor de coordenador
  const membros = curso?.membros ?? [];

  // Agrupa por unidade
  const porUnidade = new Map<string, { nome: string; oas: OADetalhe[] }>();
  for (const oa of oasFiltrados) {
    const key = oa.capitulo.unidade.nome;
    if (!porUnidade.has(key)) porUnidade.set(key, { nome: key, oas: [] });
    porUnidade.get(key)!.oas.push(oa);
  }

  return (
    <Box>
      {/* Header */}
      <Box sx={{ display: "flex", alignItems: "center", gap: 2, mb: 3 }}>
        <Button component={Link} to={`/cursos/${cursoId}/oas`} startIcon={<ArrowBackIcon />} sx={{ color: "text.secondary" }}>
          Voltar
        </Button>
        <Box sx={{ flex: 1 }}>
          <Typography sx={{ fontSize: "1.25rem", fontWeight: 800 }}>Setup de Produção</Typography>
          <Typography variant="caption" color="text.disabled">
            Configure templates, responsáveis e deadlines antes de liberar para os professores
          </Typography>
        </Box>
        <Chip
          label={`${totalConcluido}/${totalSetup} concluídos`}
          color={totalConcluido === totalSetup && totalSetup > 0 ? "success" : "default"}
          sx={{ fontWeight: 700 }}
        />
      </Box>

      {/* Coordenador de Produção */}
      {curso && (
        <CoordenadorSelector
          cursoId={cursoId}
          membros={membros}
          coordenadorAtualId={curso.coordenadorProducaoId}
          coordenadorAtual={curso.coordenadorProducao}
        />
      )}

      {/* Sugestão Inteligente */}
      <SugestaoAlocacaoCard cursoId={cursoId} />

      {/* Banner de validação da matriz */}
      {temOAsImportados && !matrizValidada && (
        <Card sx={{ mb: 3, border: "1px solid #fbbf24", bgcolor: "#fffbeb" }}>
          <CardContent sx={{ p: 2, display: "flex", alignItems: "center", gap: 2, flexWrap: "wrap" }}>
            <Box sx={{ flex: 1 }}>
              <Typography fontWeight={700} sx={{ color: "#92400e", mb: 0.25 }}>
                Matriz importada — validação pendente
              </Typography>
              <Typography variant="caption" color="text.secondary">
                Antes de iniciar o Setup por OA, analise a matriz importada:{" "}
                <strong>{totalSetup} objetos</strong> em{" "}
                <strong>{new Set(oasComSetup.map((o) => o.capitulo.unidade.nome)).size} unidades</strong>.
                Confirme que as quantidades estão corretas.
              </Typography>
            </Box>
            <Button
              variant="contained"
              size="small"
              startIcon={<VerifiedIcon />}
              onClick={() => validarMatriz()}
              disabled={validando}
              sx={{ bgcolor: "#d97706", "&:hover": { bgcolor: "#b45309" }, whiteSpace: "nowrap" }}
            >
              {validando ? "Confirmando…" : "Confirmar e iniciar Setup"}
            </Button>
          </CardContent>
        </Card>
      )}

      {matrizValidada && curso?.matrizValidadaPor && (
        <Alert severity="success" icon={<VerifiedIcon />} sx={{ mb: 2, py: 0.5 }}>
          Matriz validada por <strong>{curso.matrizValidadaPor.nome}</strong> em{" "}
          {new Date(curso.matrizValidadaEm!).toLocaleDateString("pt-BR")}.
        </Alert>
      )}

      {/* Barra de progresso */}
      {totalSetup > 0 && (
        <Card sx={{ mb: 3 }}>
          <CardContent sx={{ p: 2 }}>
            <Box sx={{ display: "flex", justifyContent: "space-between", mb: 0.75 }}>
              <Typography variant="body2" fontWeight={600}>
                {totalConcluido} de {totalSetup} OAs configurados
              </Typography>
              <Typography variant="body2" color="text.secondary">{pct}%</Typography>
            </Box>
            <LinearProgress variant="determinate" value={pct} sx={{ height: 8, borderRadius: 4 }} />
          </CardContent>
        </Card>
      )}

      {/* Filtros */}
      <Box sx={{ display: "flex", gap: 1, mb: 2.5 }}>
        {(["todos", "pendente", "concluido"] as const).map((f) => (
          <Chip key={f}
            label={f === "todos" ? `Todos (${oasComSetup.length})` : f === "pendente" ? `Pendente (${oasComSetup.length - totalConcluido})` : `Concluído (${totalConcluido})`}
            onClick={() => setFiltro(f)}
            variant={filtro === f ? "filled" : "outlined"}
            color={filtro === f ? "primary" : "default"}
            size="small"
          />
        ))}
      </Box>

      {/* Lista */}
      {oasFiltrados.length === 0 ? (
        <Alert severity={filtro === "pendente" ? "success" : "info"} sx={{ mt: 1 }}>
          {filtro === "pendente" ? "Todos os OAs já foram configurados!" : "Nenhum OA para este filtro."}
        </Alert>
      ) : (
        Array.from(porUnidade.values()).map(({ nome, oas: unidadeOAs }) => (
          <Box key={nome} sx={{ mb: 3 }}>
            <Typography variant="caption" fontWeight={700} color="text.secondary"
              sx={{ textTransform: "uppercase", letterSpacing: 1, display: "block", mb: 1 }}>
              {nome}
            </Typography>
            {unidadeOAs.map((oa) => {
              const setup = oa.etapas.find((e) => e.etapaDef.papel === "COORDENADOR_PRODUCAO");
              const tc = TIPO_CONFIG[oa.tipo] ?? { label: oa.tipo, color: "#64748b" };
              return (
                <SetupOARow
                  key={oa.id}
                  oa={oa}
                  tipoLabel={tc.label}
                  tipoColor={tc.color}
                  setupEtapa={setup ?? null}
                  matrizValidada={matrizValidada}
                  onSetupConcluido={() => setSnackMsg(`${oa.codigo} liberado para produção.`)}
                />
              );
            })}
          </Box>
        ))
      )}

      <Snackbar open={!!snackMsg} autoHideDuration={4000} onClose={() => setSnackMsg(null)}
        message={snackMsg} anchorOrigin={{ vertical: "bottom", horizontal: "center" }} />
    </Box>
  );
}

// ─── Sugestão Inteligente de Alocação ────────────────────────────────────────

const PAPEL_LABEL: Record<string, string> = {
  COORDENADOR_PRODUCAO:  "Coord. Produção",
  CONTEUDISTA:           "Conteudista",
  DESIGNER_INSTRUCIONAL: "Designer Instrucional",
  PROFESSOR_ATOR:        "Professor Ator",
  PROFESSOR_TECNICO:     "Professor Técnico",
  ACESSIBILIDADE:        "Acessibilidade",
  EDITOR_VIDEO:          "Editor de Vídeo",
  DESIGNER_GRAFICO:      "Designer Gráfico",
  PRODUTOR_FINAL:        "Produtor Final",
  VALIDADOR_FINAL:       "Validador Final",
};

function OcupacaoBar({ pct }: { pct: number }) {
  const color = pct >= 90 ? "#ef4444" : pct >= 70 ? "#f59e0b" : "#10b981";
  return (
    <Box sx={{ display: "flex", alignItems: "center", gap: 1, minWidth: 120 }}>
      <Box sx={{ flex: 1, height: 6, borderRadius: 3, bgcolor: "#e2e8f0", overflow: "hidden" }}>
        <Box sx={{ width: `${Math.min(pct, 100)}%`, height: "100%", bgcolor: color, borderRadius: 3, transition: "width 0.4s" }} />
      </Box>
      <Typography variant="caption" sx={{ minWidth: 36, textAlign: "right", fontWeight: 600, color }}>
        {Math.round(pct)}%
      </Typography>
    </Box>
  );
}

function SugestaoAlocacaoCard({ cursoId }: { cursoId: string }) {
  const [aberto, setAberto]                         = useState(false);
  const [mostrarMembros, setMostrarMembros]         = useState(false);
  const [snack, setSnack]                           = useState<string | null>(null);
  const { data, isLoading, isFetching, refetch }    = useSugestaoAlocacao(cursoId, aberto);
  const { mutate: aplicar, isPending: aplicando }   = useAplicarSugestao(cursoId);

  const handleAplicar = () => {
    if (!data?.sugestao?.length) return;
    aplicar(data.sugestao, {
      onSuccess: (res) => {
        setSnack(`${res.totalAtualizado} etapa(s) atribuída(s) com sucesso.`);
        setAberto(false);
      },
    });
  };

  return (
    <>
      <Card sx={{ mb: 2.5, border: "1px solid #e0e7ff", bgcolor: aberto ? "#fafafe" : "background.paper" }}>
        <CardContent sx={{ p: 2 }}>
          <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 2 }}>
            <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
              <AutoAwesomeIcon sx={{ color: "#6366f1", fontSize: 20 }} />
              <Box>
                <Typography variant="body2" fontWeight={700} color="#4338ca">
                  Sugestão Inteligente de Alocação
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  Analisa a carga de todos os projetos e sugere o colaborador menos ocupado por papel
                </Typography>
              </Box>
            </Box>
            <Button
              size="small" variant={aberto ? "outlined" : "contained"}
              onClick={() => { setAberto((v) => !v); if (!aberto) refetch(); }}
              sx={{ whiteSpace: "nowrap", bgcolor: aberto ? undefined : "#6366f1", "&:hover": { bgcolor: aberto ? undefined : "#4338ca" } }}
            >
              {aberto ? "Fechar" : "Ver Sugestão"}
            </Button>
          </Box>

          {aberto && (
            <Box sx={{ mt: 2 }}>
              {isLoading || isFetching ? (
                <Box sx={{ display: "flex", flexDirection: "column", gap: 1 }}>
                  {[1, 2, 3].map((i) => <Skeleton key={i} height={36} sx={{ borderRadius: 1 }} />)}
                </Box>
              ) : !data || data.sugestao.length === 0 ? (
                <Alert severity="info" sx={{ mt: 1 }}>
                  Nenhum membro com papéis de produção configurados. Defina os papéis de produção na aba <strong>Equipe</strong> do curso.
                </Alert>
              ) : (
                <>
                  {data.oasPendentesSetup > 0 && (
                    <Alert severity="info" icon={false} sx={{ py: 0.5, mb: 1.5, fontSize: "0.8rem" }}>
                      <strong>{data.oasPendentesSetup}</strong> OA(s) com etapas sem responsável — esta sugestão irá preencher automaticamente.
                    </Alert>
                  )}

                  {/* Tabela de sugestões */}
                  <Box component="table" sx={{ width: "100%", borderCollapse: "collapse" }}>
                    <Box component="thead">
                      <Box component="tr">
                        {["Papel", "Sugerido", "Ocupação Global"].map((h) => (
                          <Box key={h} component="th" sx={{ textAlign: "left", py: 0.75, px: 1, fontSize: "0.7rem", fontWeight: 700, color: "text.secondary", borderBottom: "1px solid", borderColor: "divider" }}>
                            {h}
                          </Box>
                        ))}
                      </Box>
                    </Box>
                    <Box component="tbody">
                      {data.sugestao.map((s: SugestaoItem) => (
                        <Box key={s.papel} component="tr" sx={{ "&:hover": { bgcolor: "action.hover" } }}>
                          <Box component="td" sx={{ py: 1, px: 1, fontSize: "0.8rem", whiteSpace: "nowrap" }}>
                            <Chip label={PAPEL_LABEL[s.papel] ?? s.papel} size="small" sx={{ fontSize: "0.65rem", bgcolor: "#eff6ff", color: "primary.main" }} />
                          </Box>
                          <Box component="td" sx={{ py: 1, px: 1 }}>
                            <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                              <Avatar sx={{ width: 24, height: 24, fontSize: "0.65rem", bgcolor: "primary.light", fontWeight: 700 }}>
                                {s.responsavelNome[0]?.toUpperCase()}
                              </Avatar>
                              <Typography variant="body2" fontWeight={500}>{s.responsavelNome}</Typography>
                            </Box>
                          </Box>
                          <Box component="td" sx={{ py: 1, px: 1, minWidth: 160 }}>
                            <OcupacaoBar pct={s.percentualOcupado} />
                          </Box>
                        </Box>
                      ))}
                    </Box>
                  </Box>

                  {/* Membros detalhados */}
                  <Box sx={{ mt: 1.5 }}>
                    <Button size="small" variant="text" sx={{ fontSize: "0.75rem", color: "text.secondary", px: 0 }}
                      onClick={() => setMostrarMembros((v) => !v)}>
                      {mostrarMembros ? "Ocultar" : "Ver"} todos os membros ({data.membros.length})
                    </Button>
                    {mostrarMembros && (
                      <Box sx={{ mt: 1, display: "flex", flexDirection: "column", gap: 0.75 }}>
                        {data.membros.map((m: SugestaoAlocacao["membros"][number]) => (
                          <Box key={m.usuarioId} sx={{ display: "flex", alignItems: "center", gap: 1.5, px: 1, py: 0.5, bgcolor: "#f8fafc", borderRadius: 1 }}>
                            <Avatar sx={{ width: 24, height: 24, fontSize: "0.65rem", bgcolor: "primary.light", fontWeight: 700 }}>
                              {m.nome[0]?.toUpperCase()}
                            </Avatar>
                            <Typography variant="caption" fontWeight={600} sx={{ minWidth: 130 }}>{m.nome}</Typography>
                            <Typography variant="caption" color="text.disabled" sx={{ flex: 1, fontSize: "0.65rem" }}>
                              {m.papeisProducao.map((p) => PAPEL_LABEL[p] ?? p).join(", ") || "Sem papéis"}
                            </Typography>
                            <OcupacaoBar pct={m.percentualOcupado} />
                            <Typography variant="caption" color="text.disabled" sx={{ minWidth: 70, fontSize: "0.65rem" }}>
                              {m.horasCompromissadas.toFixed(1)}h/{m.capacidade}h sem.
                            </Typography>
                          </Box>
                        ))}
                      </Box>
                    )}
                  </Box>

                  <Divider sx={{ my: 2 }} />
                  <Box sx={{ display: "flex", alignItems: "center", gap: 2 }}>
                    <Button
                      variant="contained" size="small"
                      startIcon={<PlayArrowIcon />}
                      onClick={handleAplicar}
                      disabled={aplicando || data.oasPendentesSetup === 0}
                      sx={{ fontWeight: 700, bgcolor: "#6366f1", "&:hover": { bgcolor: "#4338ca" } }}
                    >
                      {aplicando ? "Aplicando…" : "Aplicar Sugestão"}
                    </Button>
                    {data.oasPendentesSetup === 0 && (
                      <Typography variant="caption" color="text.secondary">
                        Todos os OAs já têm responsáveis atribuídos.
                      </Typography>
                    )}
                    {data.oasPendentesSetup > 0 && (
                      <Typography variant="caption" color="text.secondary">
                        Atribuirá responsáveis às etapas sem responsável, respeitando os papéis de produção.
                      </Typography>
                    )}
                  </Box>
                </>
              )}
            </Box>
          )}
        </CardContent>
      </Card>

      <Snackbar open={!!snack} autoHideDuration={5000} onClose={() => setSnack(null)}
        message={snack} anchorOrigin={{ vertical: "bottom", horizontal: "center" }} />
    </>
  );
}

// ─── Seletor de Coordenador de Produção ───────────────────────────────────────

function CoordenadorSelector({ cursoId, membros, coordenadorAtualId, coordenadorAtual }: {
  cursoId: string;
  membros: { usuarioId: string; papel: string; usuario: { id: string; nome: string; fotoUrl: string | null } }[];
  coordenadorAtualId: string | null;
  coordenadorAtual: { id: string; nome: string; fotoUrl: string | null } | null;
}) {
  const { mutate: definir, isPending } = useDefinirCoordenadorProducao(cursoId);

  return (
    <Card sx={{ mb: 2.5 }}>
      <CardContent sx={{ p: 2, display: "flex", alignItems: "center", gap: 2 }}>
        <PersonIcon sx={{ color: "text.secondary", fontSize: 20 }} />
        <Typography variant="body2" fontWeight={600} sx={{ minWidth: 160 }}>
          Coordenador de Produção
        </Typography>
        <FormControl size="small" sx={{ minWidth: 240 }} disabled={isPending}>
          <Select
            value={coordenadorAtualId ?? ""}
            displayEmpty
            onChange={(e) => definir(e.target.value || null)}
            sx={{ fontSize: "0.8125rem" }}
          >
            <MenuItem value=""><em>Não definido</em></MenuItem>
            {membros.map((m) => (
              <MenuItem key={m.usuarioId} value={m.usuarioId}>
                <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                  <Avatar src={m.usuario.fotoUrl ?? undefined} sx={{ width: 20, height: 20, fontSize: "0.65rem" }}>
                    {m.usuario.nome[0]}
                  </Avatar>
                  {m.usuario.nome}
                </Box>
              </MenuItem>
            ))}
          </Select>
        </FormControl>
        {coordenadorAtual && (
          <Typography variant="caption" color="text.secondary">
            {coordenadorAtual.nome} é o responsável pelo Setup de Produção deste curso.
          </Typography>
        )}
      </CardContent>
    </Card>
  );
}

// ─── Row por OA ───────────────────────────────────────────────────────────────

function SetupOARow({ oa, tipoLabel, tipoColor, setupEtapa, matrizValidada, onSetupConcluido }: {
  oa: OADetalhe;
  tipoLabel: string;
  tipoColor: string;
  setupEtapa: OADetalhe["etapas"][number] | null;
  matrizValidada: boolean;
  onSetupConcluido: () => void;
}) {
  const [expanded, setExpanded]   = useState(false);
  const [linkInput, setLinkInput] = useState(oa.linkObjeto ?? "");
  const [errMsg, setErrMsg]       = useState<string | null>(null);

  const { mutate: atualizarOA, isPending: salvandoLink }    = useAtualizarOA(oa.id);
  const { mutate: atualizarEtapa } = useAtualizarEtapaGeral();

  const membros       = oa.capitulo.unidade.curso.membros;
  const setupConcluido = setupEtapa?.status === "CONCLUIDA";

  // Estado do checklist derivado da etapa (server truth)
  const templateGerado     = setupEtapa?.templateGerado     ?? false;
  const templateOrganizado = setupEtapa?.templateOrganizado ?? false;
  const linkPreenchido     = !!(oa.linkObjeto || linkInput.trim());

  // Checklist completo = pode concluir
  const checklistOk = templateGerado && templateOrganizado && linkPreenchido;

  const handleCheckTemplate = (campo: "templateGerado" | "templateOrganizado", valor: boolean) => {
    if (!setupEtapa) return;
    atualizarEtapa({ oaId: oa.id, etapaId: setupEtapa.id, data: { [campo]: valor } });
  };

  const handleSalvarLink = () => {
    atualizarOA({ linkObjeto: linkInput.trim() || null });
  };

  const handleConcluirSetup = () => {
    if (!setupEtapa) return;
    if (!checklistOk) {
      setErrMsg("Complete todos os itens do checklist antes de concluir o Setup.");
      return;
    }

    const concluir = () =>
      atualizarEtapa({
        oaId:    oa.id,
        etapaId: setupEtapa.id,
        data:    { status: "CONCLUIDA" as StatusEtapa, deadlineReal: new Date().toISOString() },
      }, {
        onSuccess: onSetupConcluido,
        onError:   (err: any) => setErrMsg(err?.response?.data?.message ?? "Erro ao concluir setup."),
      });

    if (linkInput.trim() && linkInput.trim() !== oa.linkObjeto) {
      atualizarOA({ linkObjeto: linkInput.trim() }, { onSuccess: concluir });
    } else {
      concluir();
    }
  };

  return (
    <>
      <Accordion expanded={expanded} onChange={() => setExpanded((v) => !v)} disableGutters
        sx={{
          mb: 1, border: "1px solid",
          borderColor: setupConcluido ? "#bbf7d0" : !matrizValidada ? "#e2e8f0" : "divider",
          bgcolor: setupConcluido ? "#f0fdf4" : "background.paper",
          borderRadius: "8px !important", "&:before": { display: "none" },
          opacity: !matrizValidada ? 0.65 : 1,
        }}>

        <AccordionSummary expandIcon={<ExpandMoreIcon />} sx={{ px: 2, minHeight: 52 }}>
          <Box sx={{ display: "flex", alignItems: "center", gap: 1.5, flex: 1 }}>
            {setupConcluido
              ? <CheckCircleIcon sx={{ fontSize: 18, color: "#10b981" }} />
              : <Box sx={{ width: 18, height: 18, borderRadius: "50%", border: "2px solid #94a3b8", flexShrink: 0 }} />
            }
            <Typography fontWeight={700} sx={{ fontFamily: "monospace", fontSize: "0.875rem" }}>{oa.codigo}</Typography>
            <Chip label={tipoLabel} size="small"
              sx={{ bgcolor: `${tipoColor}18`, color: tipoColor, fontWeight: 600, fontSize: "0.65rem", height: 18 }} />
            {oa.linkObjeto && (
              <Chip icon={<LinkIcon sx={{ fontSize: "12px !important" }} />}
                label="Template" size="small"
                sx={{ bgcolor: "#eff6ff", color: "primary.main", fontSize: "0.65rem", height: 18 }} />
            )}
            {setupConcluido && (
              <Chip label="Liberado" size="small"
                sx={{ bgcolor: "#dcfce7", color: "#166534", fontSize: "0.65rem", height: 18 }} />
            )}
            {!matrizValidada && (
              <Chip label="Aguardando validação" size="small"
                sx={{ bgcolor: "#fef9c3", color: "#92400e", fontSize: "0.65rem", height: 18 }} />
            )}
          </Box>
        </AccordionSummary>

        <AccordionDetails sx={{ px: 2.5, pb: 2.5 }}>
          {!matrizValidada ? (
            <Alert severity="warning" sx={{ mb: 0 }}>
              Valide a matriz importada antes de iniciar o Setup deste OA.
            </Alert>
          ) : (
            <>
              {/* ── Checklist de Setup ────────────────────────────────── */}
              <Typography variant="caption" fontWeight={700} color="text.secondary"
                sx={{ display: "block", mb: 1.5, textTransform: "uppercase", letterSpacing: 0.5 }}>
                Checklist de Setup
              </Typography>

              {/* Passo 1: Gerar templates */}
              <ChecklistItem
                numero={1}
                label="Templates gerados via Google Apps Script"
                checked={templateGerado}
                disabled={setupConcluido}
                onChange={(v) => handleCheckTemplate("templateGerado", v)}
              />

              {/* Passo 2: Organizar no Drive */}
              <Tooltip title={!templateGerado ? "Conclua o passo 1 primeiro" : ""} placement="left">
                <span>
                  <ChecklistItem
                    numero={2}
                    label="Templates organizados na pasta do projeto (Google Drive)"
                    checked={templateOrganizado}
                    disabled={setupConcluido || !templateGerado}
                    onChange={(v) => handleCheckTemplate("templateOrganizado", v)}
                  />
                </span>
              </Tooltip>

              {/* Passo 3: Link do template */}
              <Box sx={{ display: "flex", alignItems: "flex-start", gap: 1.5, mb: 1.5, pl: 0.5 }}>
                <Box sx={{
                  width: 22, height: 22, borderRadius: "50%", flexShrink: 0, mt: 0.25,
                  bgcolor: linkPreenchido ? "#10b981" : "#e2e8f0",
                  display: "flex", alignItems: "center", justifyContent: "center",
                }}>
                  {linkPreenchido
                    ? <CheckCircleIcon sx={{ fontSize: 14, color: "#fff" }} />
                    : <Typography sx={{ fontSize: "0.65rem", fontWeight: 700, color: "#94a3b8" }}>3</Typography>
                  }
                </Box>
                <Box sx={{ flex: 1 }}>
                  <Typography variant="caption" fontWeight={600} color={linkPreenchido ? "text.primary" : "text.secondary"}
                    sx={{ display: "block", mb: 0.75 }}>
                    Link do template compartilhado (Google Drive / Docs)
                  </Typography>
                  <Box sx={{ display: "flex", gap: 1 }}>
                    <TextField
                      size="small" fullWidth
                      placeholder="Cole aqui o link do template gerado no Google Apps Script…"
                      value={linkInput}
                      onChange={(e) => setLinkInput(e.target.value)}
                      disabled={setupConcluido || salvandoLink}
                      sx={{ "& .MuiInputBase-input": { fontSize: "0.8125rem" } }}
                    />
                    {!setupConcluido && (
                      <Button variant="outlined" size="small" onClick={handleSalvarLink}
                        disabled={salvandoLink || !linkInput.trim()}
                        sx={{ whiteSpace: "nowrap", minWidth: 80 }}>
                        {salvandoLink ? "Salvando…" : "Salvar"}
                      </Button>
                    )}
                    {oa.linkObjeto && (
                      <Button href={oa.linkObjeto} target="_blank" size="small" variant="text"
                        sx={{ whiteSpace: "nowrap" }}>
                        Abrir
                      </Button>
                    )}
                  </Box>
                </Box>
              </Box>

              <Divider sx={{ my: 2 }} />

              {/* Passo 4: Responsáveis e deadlines */}
              <Box sx={{ display: "flex", alignItems: "center", gap: 1.5, mb: 1.5, pl: 0.5 }}>
                <Box sx={{
                  width: 22, height: 22, borderRadius: "50%", flexShrink: 0,
                  bgcolor: "#e2e8f0",
                  display: "flex", alignItems: "center", justifyContent: "center",
                }}>
                  <Typography sx={{ fontSize: "0.65rem", fontWeight: 700, color: "#94a3b8" }}>4</Typography>
                </Box>
                <Typography variant="caption" fontWeight={700} color="text.secondary"
                  sx={{ textTransform: "uppercase", letterSpacing: 0.5 }}>
                  Responsáveis e Deadlines por etapa
                </Typography>
              </Box>
              <Typography variant="caption" color="text.disabled" sx={{ display: "block", mb: 1.25, pl: 4 }}>
                O deadline da etapa de Setup propaga automaticamente para as etapas seguintes. Ajuste as datas individualmente se necessário — todas as subsequentes serão recalculadas.
              </Typography>
              <Box sx={{ display: "flex", flexDirection: "column", gap: 1.5, pl: 1 }}>
                {oa.etapas.map((etapa) => (
                  <EtapaSetupRow
                    key={etapa.id}
                    oaId={oa.id}
                    etapa={etapa}
                    membros={membros}
                    disabled={setupConcluido}
                  />
                ))}
              </Box>

              {/* Botão concluir */}
              {!setupConcluido && (
                <Box sx={{ mt: 2.5, pt: 2, borderTop: "1px solid", borderColor: "divider" }}>
                  <Button
                    variant="contained" color="success" size="small"
                    disabled={salvandoLink || !checklistOk}
                    onClick={handleConcluirSetup}
                    startIcon={<CheckCircleIcon />}
                    sx={{ fontWeight: 700 }}
                  >
                    Concluir Setup e Liberar para Produção
                  </Button>
                  {!checklistOk && (
                    <Typography variant="caption" color="text.disabled" sx={{ display: "block", mt: 0.75 }}>
                      Complete os 3 primeiros itens do checklist para liberar este botão.
                    </Typography>
                  )}
                  {checklistOk && (
                    <Typography variant="caption" color="text.secondary" sx={{ display: "block", mt: 0.75 }}>
                      Após concluir, o Conteudista (professor) poderá iniciar o preenchimento do template.
                    </Typography>
                  )}
                </Box>
              )}
            </>
          )}
        </AccordionDetails>
      </Accordion>

      <Snackbar open={!!errMsg} autoHideDuration={5000} onClose={() => setErrMsg(null)}
        message={errMsg} anchorOrigin={{ vertical: "bottom", horizontal: "center" }}
        ContentProps={{ sx: { bgcolor: "#ef4444" } }} />
    </>
  );
}

// ─── Item do checklist ────────────────────────────────────────────────────────

function ChecklistItem({ numero, label, checked, disabled, onChange }: {
  numero: number;
  label: string;
  checked: boolean;
  disabled: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <Box sx={{ display: "flex", alignItems: "center", gap: 1.5, mb: 1, pl: 0.5 }}>
      <Box sx={{
        width: 22, height: 22, borderRadius: "50%", flexShrink: 0,
        bgcolor: checked ? "#10b981" : "#e2e8f0",
        display: "flex", alignItems: "center", justifyContent: "center",
      }}>
        {checked
          ? <CheckCircleIcon sx={{ fontSize: 14, color: "#fff" }} />
          : <Typography sx={{ fontSize: "0.65rem", fontWeight: 700, color: "#94a3b8" }}>{numero}</Typography>
        }
      </Box>
      <FormControlLabel
        control={
          <Checkbox
            checked={checked}
            disabled={disabled}
            onChange={(e) => onChange(e.target.checked)}
            size="small"
            sx={{ p: 0.5 }}
          />
        }
        label={
          <Typography variant="caption" fontWeight={checked ? 700 : 400}
            sx={{ color: checked ? "text.primary" : "text.secondary", textDecoration: checked ? "none" : "none" }}>
            {label}
          </Typography>
        }
        sx={{ m: 0 }}
      />
    </Box>
  );
}

// ─── Linha de etapa (responsável + deadline) ──────────────────────────────────

function EtapaSetupRow({ oaId, etapa, membros, disabled }: {
  oaId: string;
  etapa: {
    id: string; status: StatusEtapa; deadlinePrevisto: string | null;
    responsavelId: string | null;
    etapaDef: { nome: string; papel: string };
  };
  membros: { usuarioId: string; papel: string; usuario: { id: string; nome: string; fotoUrl: string | null } }[];
  disabled: boolean;
}) {
  const { mutate: atualizarEtapa } = useAtualizarEtapaGeral();
  const [dl, setDl] = useState(etapa.deadlinePrevisto ? etapa.deadlinePrevisto.slice(0, 10) : "");
  const isSetup = etapa.etapaDef.papel === "COORDENADOR_PRODUCAO";

  const handleResponsavel = (val: string) => {
    atualizarEtapa({ oaId, etapaId: etapa.id, data: { responsavelId: val || null } });
  };

  const handleDeadline = (val: string) => {
    setDl(val);
    if (val) {
      atualizarEtapa({
        oaId, etapaId: etapa.id,
        data: {
          deadlinePrevisto: new Date(val + "T12:00:00").toISOString(),
          // Propaga cascade para etapas subsequentes
          recalcularSequencia: true,
        },
      });
    }
  };

  return (
    <Box sx={{
      display: "grid", gridTemplateColumns: { xs: "1fr", sm: "180px 1fr 160px" }, gap: 1, alignItems: "center",
      bgcolor: isSetup ? "#eff6ff" : "transparent", borderRadius: isSetup ? 1 : 0, p: isSetup ? 1 : 0,
    }}>
      <Typography variant="caption" fontWeight={isSetup ? 700 : 400}
        color={isSetup ? "primary.main" : "text.secondary"}
        sx={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
        {etapa.etapaDef.nome}
      </Typography>
      <FormControl size="small" fullWidth disabled={disabled}>
        <InputLabel sx={{ fontSize: "0.8rem" }}>Responsável</InputLabel>
        <Select
          value={etapa.responsavelId ?? ""}
          label="Responsável"
          onChange={(e) => handleResponsavel(e.target.value)}
          sx={{ fontSize: "0.8125rem" }}
        >
          <MenuItem value=""><em>Sem responsável</em></MenuItem>
          {membros.map((m) => (
            <MenuItem key={m.usuarioId} value={m.usuarioId}>{m.usuario.nome}</MenuItem>
          ))}
        </Select>
      </FormControl>
      <TextField
        type="date" size="small" label="Deadline" fullWidth
        value={dl}
        onChange={(e) => handleDeadline(e.target.value)}
        disabled={disabled}
        InputLabelProps={{ shrink: true }}
        sx={{ "& .MuiInputBase-input": { fontSize: "0.8125rem" } }}
      />
    </Box>
  );
}

function LoadingSkeleton() {
  return (
    <Box>
      <Skeleton height={40} sx={{ mb: 2 }} />
      <Skeleton height={60} sx={{ mb: 2 }} />
      <Skeleton height={20} sx={{ mb: 1, width: "30%" }} />
      {[1, 2, 3, 4].map((i) => <Skeleton key={i} height={60} sx={{ mb: 1, borderRadius: 2 }} />)}
    </Box>
  );
}
