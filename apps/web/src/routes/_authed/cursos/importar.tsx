import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import {
  Box, Typography, Card, CardContent, Button, Stepper, Step,
  StepLabel, Chip, LinearProgress, Alert, CircularProgress,
  Table, TableBody, TableCell, TableHead, TableRow,
  Select, MenuItem, FormControl, InputLabel, Paper,
  ToggleButton, ToggleButtonGroup, TextField,
} from "@mui/material";
import CloudUploadOutlinedIcon    from "@mui/icons-material/CloudUploadOutlined";
import CheckCircleIcon            from "@mui/icons-material/CheckCircle";
import ArrowBackIcon              from "@mui/icons-material/ArrowBack";
import FileDownloadOutlinedIcon   from "@mui/icons-material/FileDownloadOutlined";
import TableChartOutlinedIcon     from "@mui/icons-material/TableChartOutlined";
import SchoolOutlinedIcon         from "@mui/icons-material/SchoolOutlined";
import { useState, useRef }       from "react";
import {
  useCursos,
  useImportarPreview, useImportarConfirmar,
  useImportarMINovoPreview, useImportarMINovoCurso,
} from "@/lib/api/cursos";
import type { ImportPreview, ImportResult, MIPreview, MIResult } from "shared";

export const Route = createFileRoute("/_authed/cursos/importar")({
  component: ImportarPage,
});

const PASSOS = ["Configuração", "Análise", "Revisão", "Concluído"];

const TIPO_LABELS: Record<string, string> = {
  VIDEO: "Vídeo", SLIDE: "Slide", QUIZ: "Quiz",
  EBOOK: "E-book", PLANO_AULA: "Plano de Aula", TAREFA: "Tarefa",
};

type TipoImport = "MC" | "MI";

function ImportarPage() {
  const navigate        = useNavigate();
  const { data: cursos = [] } = useCursos();

  const [tipoImport, setTipoImport] = useState<TipoImport>("MI");
  const [passo,      setPasso]      = useState(0);

  // Campos para MI (novo curso)
  const [codigo,      setCodigo]      = useState("");
  const [nome,        setNome]        = useState("");
  const [dataInicio,  setDataInicio]  = useState("");

  // Campos para MC (curso existente)
  const [cursoId, setCursoId] = useState("");

  const [arquivo,    setArquivo]    = useState<File | null>(null);
  const [previewMC,  setPreviewMC]  = useState<ImportPreview | null>(null);
  const [previewMI,  setPreviewMI]  = useState<MIPreview | null>(null);
  const [resultadoMC, setResultadoMC] = useState<ImportResult | null>(null);
  const [resultadoMI, setResultadoMI] = useState<MIResult | null>(null);
  const [dragOver,   setDragOver]   = useState(false);

  const fileRef = useRef<HTMLInputElement>(null);

  const { mutate: buscarPreviewMC,  isPending: loadPreviewMC,  error: errPreviewMC  } = useImportarPreview(cursoId);
  const { mutate: confirmarMC,      isPending: loadConfirmMC  } = useImportarConfirmar(cursoId);
  const { mutate: buscarPreviewMI,  isPending: loadPreviewMI,  error: errPreviewMI  } = useImportarMINovoPreview();
  const { mutate: confirmarMINovo,  isPending: loadConfirmMI,  error: errConfirmMI  } = useImportarMINovoCurso();

  const loadPreview = tipoImport === "MC" ? loadPreviewMC : loadPreviewMI;
  const errPreview  = tipoImport === "MC" ? errPreviewMC  : errPreviewMI;

  const podeAvancar = tipoImport === "MI"
    ? !!arquivo && !!codigo.trim() && !!nome.trim()
    : !!arquivo && !!cursoId;

  const handleFile = (f: File) => setArquivo(f);
  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault(); setDragOver(false);
    const f = e.dataTransfer.files[0];
    if (f) handleFile(f);
  };

  const irParaPreview = () => {
    if (!arquivo) return;
    setPasso(1);
    if (tipoImport === "MC") {
      buscarPreviewMC(arquivo, {
        onSuccess: (data) => { setPreviewMC(data); setPasso(2); },
        onError:   ()     => setPasso(2),
      });
    } else {
      buscarPreviewMI(arquivo, {
        onSuccess: (data) => { setPreviewMI(data); setPasso(2); },
        onError:   ()     => setPasso(2),
      });
    }
  };

  const confirmarImport = (novosUsuarios: { nomeNaPlanilha: string; email: string }[] = []) => {
    if (!arquivo) return;
    if (tipoImport === "MC") {
      confirmarMC({ file: arquivo, novosUsuarios }, {
        onSuccess: (data) => { setResultadoMC(data); setPasso(3); },
      });
    } else {
      confirmarMINovo({ file: arquivo, codigo: codigo.trim(), nome: nome.trim(), dataInicio: dataInicio || undefined }, {
        onSuccess: (data) => {
          setResultadoMI(data);
          setPasso(3);
          // Só redireciona se OAs foram gerados com sucesso
          if (data.oasCriados > 0) {
            setTimeout(() => navigate({ to: "/cursos/$cursoId/setup-producao", params: { cursoId: data.cursoId } }), 2000);
          }
        },
      });
    }
  };

  const resetar = () => {
    setPasso(0); setArquivo(null);
    setPreviewMC(null); setPreviewMI(null);
    setResultadoMC(null); setResultadoMI(null);
    setCodigo(""); setNome(""); setDataInicio("");
  };

  return (
    <Box sx={{ maxWidth: 900, mx: "auto" }}>
      {/* Header */}
      <Box sx={{ display: "flex", alignItems: "center", gap: 2, mb: 3 }}>
        <Button component={Link} to="/cursos" startIcon={<ArrowBackIcon />} sx={{ color: "text.secondary" }}>
          Voltar
        </Button>
        <Box>
          <Typography sx={{ fontSize: "1.5rem", fontWeight: 800 }}>Importar Planilha</Typography>
          <Typography variant="body2" color="text.secondary">Importe arquivos .csv ou .xlsx do iRede</Typography>
        </Box>
      </Box>

      {/* Stepper */}
      <Stepper activeStep={passo} sx={{ mb: 4 }}>
        {PASSOS.map((label, i) => (
          <Step key={label} completed={i < passo}>
            <StepLabel>{label}</StepLabel>
          </Step>
        ))}
      </Stepper>

      {/* ── PASSO 0: Configuração ─────────────────────────────────────────────── */}
      {passo === 0 && (
        <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", md: "1fr auto" }, gap: 3 }}>
          <Box>
            {/* Tipo de importação */}
            <Box sx={{ mb: 3 }}>
              <Typography variant="body2" fontWeight={600} sx={{ mb: 1 }}>Tipo de Planilha</Typography>
              <ToggleButtonGroup
                value={tipoImport}
                exclusive
                onChange={(_, v) => { if (v) { setTipoImport(v); resetar(); } }}
                size="small"
              >
                <ToggleButton value="MI" sx={{ px: 3, fontWeight: 600, gap: 1 }}>
                  <SchoolOutlinedIcon fontSize="small" />
                  Matriz Instrucional
                </ToggleButton>
                <ToggleButton value="MC" sx={{ px: 3, fontWeight: 600, gap: 1 }}>
                  <TableChartOutlinedIcon fontSize="small" />
                  Matriz de Conteúdo
                </ToggleButton>
              </ToggleButtonGroup>
              <Typography variant="caption" color="text.secondary" sx={{ mt: 0.75, display: "block" }}>
                {tipoImport === "MI"
                  ? "Cria um novo curso com toda a estrutura pedagógica e gera os OAs automaticamente."
                  : "Atualiza o status de produção dos OAs de um curso já existente."}
              </Typography>
            </Box>

            {/* Identificação: MI = campos novo curso | MC = seletor de curso */}
            {tipoImport === "MI" ? (
              <Box sx={{ display: "flex", gap: 2, mb: 3, flexWrap: "wrap" }}>
                <TextField
                  label="Código do Curso"
                  value={codigo}
                  onChange={(e) => setCodigo(e.target.value.toUpperCase())}
                  placeholder="Ex: CI-AM-01"
                  size="small"
                  sx={{ width: 180 }}
                  inputProps={{ maxLength: 20 }}
                />
                <TextField
                  label="Nome do Curso"
                  value={nome}
                  onChange={(e) => setNome(e.target.value)}
                  placeholder="Ex: Capacitação em Microeletrônica"
                  size="small"
                  sx={{ flex: 1, minWidth: 200 }}
                  inputProps={{ maxLength: 200 }}
                />
                <TextField
                  label="Data de Início"
                  type="date"
                  value={dataInicio}
                  onChange={(e) => setDataInicio(e.target.value)}
                  size="small"
                  sx={{ width: 180 }}
                  InputLabelProps={{ shrink: true }}
                  helperText="Opcional — calcula deadlines"
                />
              </Box>
            ) : (
              <FormControl fullWidth sx={{ mb: 3 }}>
                <InputLabel>Selecione o Curso de Destino</InputLabel>
                <Select value={cursoId} onChange={(e) => setCursoId(e.target.value)} label="Selecione o Curso de Destino">
                  {cursos.map((c) => (
                    <MenuItem key={c.id} value={c.id}>{c.nome} ({c.codigo})</MenuItem>
                  ))}
                </Select>
              </FormControl>
            )}

            {/* Drop zone */}
            <Box
              onDrop={handleDrop}
              onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
              onDragLeave={() => setDragOver(false)}
              onClick={() => fileRef.current?.click()}
              sx={{
                border: `2px dashed ${dragOver ? "#2b7cee" : "#e2e8f0"}`,
                borderRadius: 3, p: 6, textAlign: "center", cursor: "pointer",
                bgcolor: dragOver ? "#eff6ff" : "transparent", transition: "all 0.2s",
                "&:hover": { borderColor: "#2b7cee", bgcolor: "#eff6ff" },
              }}
            >
              <input ref={fileRef} type="file" hidden accept=".csv,.xls,.xlsx"
                onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); }}
              />
              <CloudUploadOutlinedIcon sx={{ fontSize: 48, color: arquivo ? "primary.main" : "text.disabled", mb: 2 }} />
              {arquivo ? (
                <>
                  <Typography fontWeight={700} color="primary">{arquivo.name}</Typography>
                  <Typography variant="caption" color="text.secondary">
                    {(arquivo.size / 1024).toFixed(1)} KB · Clique para trocar
                  </Typography>
                </>
              ) : (
                <>
                  <Typography fontWeight={600} sx={{ mb: 0.5 }}>Arraste e solte seu arquivo aqui</Typography>
                  <Typography variant="body2" color="text.secondary">ou clique para selecionar</Typography>
                  <Typography variant="caption" color="text.disabled" sx={{ mt: 1, display: "block" }}>
                    Formatos aceitos: .csv, .xls, .xlsx · Máx. 25 MB
                  </Typography>
                </>
              )}
            </Box>

            <Box sx={{ display: "flex", justifyContent: "flex-end", gap: 2, mt: 3 }}>
              <Button component={Link} to="/cursos" color="inherit">Cancelar</Button>
              <Button variant="contained" onClick={irParaPreview}
                disabled={!podeAvancar || loadPreview} sx={{ fontWeight: 700 }}>
                {loadPreview ? <CircularProgress size={20} sx={{ color: "white" }} /> : "Analisar Arquivo →"}
              </Button>
            </Box>
          </Box>

          {/* Instruções */}
          <Card sx={{ width: 260, height: "fit-content" }}>
            <CardContent sx={{ p: 2.5 }}>
              <Typography variant="h6" sx={{ mb: 2 }}>
                {tipoImport === "MI" ? "Importando MI" : "Importando MC"}
              </Typography>
              {(tipoImport === "MI"
                ? [
                    { n: 1, text: "Informe o código e nome do novo curso" },
                    { n: 2, text: "Exporte a Matriz Instrucional em .xlsx" },
                    { n: 3, text: "O arquivo deve ter uma aba por unidade (ex: Unidade 1)" },
                    { n: 4, text: "A linha de cabeçalho deve conter 'Nº Capítulo'" },
                  ]
                : [
                    { n: 1, text: "Exporte a Matriz de Conteúdo em .csv ou .xlsx" },
                    { n: 2, text: "Mantenha o separador ; para arquivos CSV" },
                    { n: 3, text: "A primeira linha deve ser o cabeçalho original do iRede" },
                  ]
              ).map((item) => (
                <Box key={item.n} sx={{ display: "flex", gap: 1.5, mb: 1.5 }}>
                  <Box sx={{ bgcolor: "primary.main", color: "white", width: 22, height: 22, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, fontSize: "0.75rem", fontWeight: 700 }}>
                    {item.n}
                  </Box>
                  <Typography variant="body2" color="text.secondary">{item.text}</Typography>
                </Box>
              ))}
              <Button variant="outlined" size="small" fullWidth startIcon={<FileDownloadOutlinedIcon />} sx={{ mt: 1 }}>
                Baixar Modelo .XLSX
              </Button>
            </CardContent>
          </Card>
        </Box>
      )}

      {/* ── PASSO 1: Processando ─────────────────────────────────────────────── */}
      {passo === 1 && (
        <Card>
          <CardContent sx={{ p: 4, textAlign: "center" }}>
            <CircularProgress sx={{ mb: 2 }} />
            <Typography fontWeight={600}>Analisando arquivo…</Typography>
            <Typography variant="body2" color="text.secondary">
              {tipoImport === "MI"
                ? "Lendo capítulos, objetivos e definições de OAs."
                : "Mapeando colunas automaticamente de acordo com o padrão iRede."}
            </Typography>
          </CardContent>
        </Card>
      )}

      {/* ── PASSO 2: Revisão MC ──────────────────────────────────────────────── */}
      {passo === 2 && tipoImport === "MC" && previewMC && (
        <PreviewMC
          preview={previewMC} erro={!!errPreviewMC} loadConfirm={loadConfirmMC}
          onVoltar={() => setPasso(0)} onConfirmar={confirmarImport}
        />
      )}

      {/* ── PASSO 2: Revisão MI ──────────────────────────────────────────────── */}
      {passo === 2 && tipoImport === "MI" && previewMI && (
        <PreviewMI
          preview={previewMI} erro={!!errPreviewMI} loadConfirm={loadConfirmMI}
          erroConfirm={errConfirmMI ? (errConfirmMI as any)?.response?.data?.message ?? errConfirmMI.message : undefined}
          codigo={codigo} nome={nome} dataInicio={dataInicio}
          onVoltar={() => setPasso(0)} onConfirmar={confirmarImport}
        />
      )}

      {/* ── PASSO 2: Erro de análise ─────────────────────────────────────────── */}
      {passo === 2 && errPreview && !previewMC && !previewMI && (
        <Box>
          <Alert severity="error" sx={{ mb: 2 }}>
            Erro ao analisar o arquivo. Verifique o formato e tente novamente.
          </Alert>
          <Button onClick={() => setPasso(0)} startIcon={<ArrowBackIcon />}>Voltar</Button>
        </Box>
      )}

      {/* ── PASSO 3: Sucesso ────────────────────────────────────────────────── */}
      {passo === 3 && (tipoImport === "MC" ? resultadoMC : resultadoMI) && (
        <Card>
          <CardContent sx={{ p: 6, textAlign: "center" }}>
            <CheckCircleIcon sx={{ fontSize: 64, color: "#10b981", mb: 2 }} />
            <Typography sx={{ fontSize: "1.5rem", fontWeight: 800, mb: 1 }}>Importação Concluída!</Typography>

            {tipoImport === "MC" && resultadoMC && (
              <>
                <Box sx={{ display: "flex", gap: 2, justifyContent: "center", mb: 3, flexWrap: "wrap" }}>
                  {[
                    { label: "OAs criados",      value: resultadoMC.criados,     color: "#10b981" },
                    { label: "OAs atualizados",  value: resultadoMC.atualizados, color: "#2b7cee" },
                    ...(resultadoMC.ignorados > 0
                      ? [{ label: "OAs ignorados", value: resultadoMC.ignorados, color: "#94a3b8" }]
                      : []),
                  ].map((s) => (
                    <Paper key={s.label} sx={{ px: 3, py: 2, borderRadius: 2, textAlign: "center", minWidth: 110 }}>
                      <Typography sx={{ fontSize: "1.75rem", fontWeight: 900, color: s.color }}>{s.value}</Typography>
                      <Typography variant="caption" color="text.secondary">{s.label}</Typography>
                    </Paper>
                  ))}
                </Box>

                {/* Novos usuários cadastrados */}
                {resultadoMC.novosUsuariosCriados?.length > 0 && (
                  <Alert severity="success" sx={{ mb: 2, textAlign: "left" }}>
                    <Typography variant="body2" fontWeight={700} sx={{ mb: 1 }}>
                      {resultadoMC.novosUsuariosCriados.length} usuário{resultadoMC.novosUsuariosCriados.length > 1 ? "s" : ""} cadastrado{resultadoMC.novosUsuariosCriados.length > 1 ? "s" : ""} e adicionado{resultadoMC.novosUsuariosCriados.length > 1 ? "s" : ""} ao time:
                    </Typography>
                    {resultadoMC.novosUsuariosCriados.map((u) => (
                      <Box key={u.email} sx={{ mb: 0.75, pl: 1, borderLeft: "3px solid #10b981" }}>
                        <Typography variant="body2" fontWeight={600}>{u.nome}</Typography>
                        <Typography variant="caption" color="text.secondary">{u.email}</Typography>
                        {u.senhaTemporaria !== "(usuário já existia no sistema)" && (
                          <Typography variant="caption" sx={{ display: "block", color: "#059669", fontFamily: "monospace", fontWeight: 700 }}>
                            Senha temporária: {u.senhaTemporaria}
                          </Typography>
                        )}
                      </Box>
                    ))}
                    <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5, display: "block" }}>
                      Compartilhe as senhas temporárias com os novos usuários. Eles devem alterá-las no primeiro acesso.
                    </Typography>
                  </Alert>
                )}

                {/* Avisos de nomes ainda não resolvidos */}
                {resultadoMC.avisos?.length > 0 && (
                  <Alert severity="warning" sx={{ mb: 2, textAlign: "left" }}>
                    <Typography variant="body2" fontWeight={700} sx={{ mb: 0.5 }}>Responsáveis não atribuídos:</Typography>
                    <ul style={{ margin: "4px 0 0", paddingLeft: 20 }}>
                      {resultadoMC.avisos.map((a, i) => <li key={i}><Typography variant="caption">{a}</Typography></li>)}
                    </ul>
                  </Alert>
                )}
              </>
            )}

            {tipoImport === "MI" && resultadoMI && (
              <>
                <Box sx={{ display: "flex", gap: 2, justifyContent: "center", mb: 3, flexWrap: "wrap" }}>
                  {[
                    { label: "Capítulos",  value: resultadoMI.capitulosAtualizados, color: "#2b7cee" },
                    { label: "Objetivos",  value: resultadoMI.objetivosCriados,     color: "#7c3aed" },
                    { label: "OAs gerados",value: resultadoMI.oasCriados,           color: "#10b981" },
                    ...(resultadoMI.oasIgnorados > 0
                      ? [{ label: "OAs ignorados", value: resultadoMI.oasIgnorados, color: "#94a3b8" }]
                      : []),
                  ].map((s) => (
                    <Paper key={s.label} sx={{ px: 3, py: 2, borderRadius: 2, textAlign: "center", minWidth: 100 }}>
                      <Typography sx={{ fontSize: "1.75rem", fontWeight: 900, color: s.color }}>{s.value}</Typography>
                      <Typography variant="caption" color="text.secondary">{s.label}</Typography>
                    </Paper>
                  ))}
                </Box>
                <Typography color="text.secondary" sx={{ mb: resultadoMI.avisos?.length ? 2 : 3 }}>
                  Curso <strong>{nome}</strong> criado com pipeline de produção configurado.
                </Typography>
                {resultadoMI.avisos && resultadoMI.avisos.length > 0 && (
                  <Alert severity={resultadoMI.oasCriados === 0 ? "error" : "warning"} sx={{ mb: 3, textAlign: "left" }}>
                    <strong>
                      {resultadoMI.oasCriados === 0
                        ? "Nenhum OA foi gerado. Verifique os avisos abaixo:"
                        : "Avisos durante a importação:"}
                    </strong>
                    <ul style={{ margin: "4px 0 0", paddingLeft: 20 }}>
                      {resultadoMI.avisos.map((a, i) => <li key={i}>{a}</li>)}
                    </ul>
                  </Alert>
                )}
              </>
            )}

            <Box sx={{ display: "flex", gap: 2, justifyContent: "center" }}>
              {tipoImport === "MI" && resultadoMI?.cursoId && (
                <Button
                  variant="contained"
                  onClick={() => navigate({ to: `/cursos/${resultadoMI.cursoId}` })}
                  sx={{ fontWeight: 700 }}
                >
                  Abrir Curso →
                </Button>
              )}
              <Button variant={tipoImport === "MC" ? "contained" : "outlined"} onClick={() => navigate({ to: "/cursos" })}>
                Ver Todos os Cursos
              </Button>
              <Button variant="outlined" onClick={resetar}>
                Importar Outro Arquivo
              </Button>
            </Box>
          </CardContent>
        </Card>
      )}
    </Box>
  );
}

// ─── Preview MC ───────────────────────────────────────────────────────────────

type ResolucaoUsuario = { acao: "ignorar" | "cadastrar"; email: string };

function PreviewMC({ preview, erro, loadConfirm, onVoltar, onConfirmar }: {
  preview: ImportPreview; erro: boolean; loadConfirm: boolean;
  onVoltar: () => void;
  onConfirmar: (novosUsuarios: { nomeNaPlanilha: string; email: string }[]) => void;
}) {
  const [resolucao, setResolucao] = useState<Record<string, ResolucaoUsuario>>(() =>
    Object.fromEntries((preview.responsaveisNaoEncontrados ?? []).map((n) => [n, { acao: "ignorar", email: "" }]))
  );

  const setAcao  = (nome: string, acao: "ignorar" | "cadastrar") =>
    setResolucao((prev) => ({ ...prev, [nome]: { ...prev[nome]!, acao } }));
  const setEmail = (nome: string, email: string) =>
    setResolucao((prev) => ({ ...prev, [nome]: { ...prev[nome]!, email } }));

  const emailInvalido = (email: string) => email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
  const temEmailInvalido = Object.values(resolucao).some(
    (v) => v.acao === "cadastrar" && !!emailInvalido(v.email)
  );
  const temCadastrarSemEmail = Object.values(resolucao).some(
    (v) => v.acao === "cadastrar" && !v.email.trim()
  );

  const handleConfirmar = () => {
    const novosUsuarios = Object.entries(resolucao)
      .filter(([, v]) => v.acao === "cadastrar" && v.email.trim())
      .map(([nomeNaPlanilha, v]) => ({ nomeNaPlanilha, email: v.email.trim() }));
    onConfirmar(novosUsuarios);
  };

  const naoEncontrados = preview.responsaveisNaoEncontrados ?? [];

  return (
    <Box>
      {erro && <Alert severity="error" sx={{ mb: 2 }}>Erro ao analisar arquivo. Verifique o formato.</Alert>}
      <Box sx={{ display: "flex", gap: 2, mb: 3, flexWrap: "wrap" }}>
        <Paper sx={{ px: 3, py: 2, borderRadius: 2, textAlign: "center" }}>
          <Typography sx={{ fontSize: "2rem", fontWeight: 900, color: "primary.main" }}>{preview.totalOAs}</Typography>
          <Typography variant="caption" color="text.secondary">OAs encontrados</Typography>
        </Paper>
        {preview.unidades.map((u) => (
          <Paper key={u.numero} sx={{ px: 3, py: 2, borderRadius: 2, textAlign: "center" }}>
            <Typography sx={{ fontSize: "1.5rem", fontWeight: 700 }}>{u.totalOAs}</Typography>
            <Typography variant="caption" color="text.secondary">Unidade {u.numero}</Typography>
          </Paper>
        ))}
      </Box>

      {preview.avisos.length > 0 && (
        <Alert severity="warning" sx={{ mb: 2 }}>{preview.avisos.map((a, i) => <div key={i}>{a}</div>)}</Alert>
      )}

      {/* ── Responsáveis não encontrados ── */}
      {naoEncontrados.length > 0 && (
        <Card sx={{ mb: 3, border: "1px solid #fef3c7" }}>
          <CardContent sx={{ p: 0, pb: "0 !important" }}>
            <Box sx={{ px: 2.5, py: 2, borderBottom: "1px solid", borderColor: "divider", bgcolor: "#fffbeb", display: "flex", alignItems: "center", gap: 1 }}>
              <Typography fontWeight={700} sx={{ color: "#92400e" }}>
                {naoEncontrados.length} responsável{naoEncontrados.length > 1 ? "is" : ""} não encontrado{naoEncontrados.length > 1 ? "s" : ""} no time
              </Typography>
              <Chip label={naoEncontrados.length} size="small" sx={{ height: 18, fontSize: "0.65rem", bgcolor: "#fef3c7", color: "#92400e", fontWeight: 700 }} />
            </Box>
            <Box sx={{ px: 2.5, py: 1.5, bgcolor: "#fffbeb" }}>
              <Typography variant="caption" color="text.secondary">
                Os nomes abaixo estão na planilha mas não foram encontrados no time do projeto.
                Cadastre-os agora para que fiquem atribuídos às etapas, ou ignore para deixar sem responsável.
              </Typography>
            </Box>
            {naoEncontrados.map((nome) => {
              const estado = resolucao[nome] ?? { acao: "ignorar", email: "" };
              const isCadastrar = estado.acao === "cadastrar";
              const emailErr = isCadastrar && estado.email.trim() ? !!emailInvalido(estado.email) : false;
              return (
                <Box key={nome} sx={{
                  px: 2.5, py: 1.75, borderTop: "1px solid", borderColor: "divider",
                  display: "flex", alignItems: "flex-start", gap: 2, flexWrap: "wrap",
                }}>
                  {/* Nome da planilha */}
                  <Box sx={{ minWidth: 200, pt: 0.5 }}>
                    <Typography variant="body2" fontWeight={600}>{nome}</Typography>
                    <Typography variant="caption" color="text.disabled">nome na planilha</Typography>
                  </Box>

                  {/* Toggle ação */}
                  <ToggleButtonGroup
                    value={estado.acao}
                    exclusive
                    size="small"
                    onChange={(_, v) => { if (v) setAcao(nome, v); }}
                  >
                    <ToggleButton value="ignorar" sx={{ px: 2, fontSize: "0.75rem" }}>
                      Ignorar
                    </ToggleButton>
                    <ToggleButton value="cadastrar" sx={{ px: 2, fontSize: "0.75rem" }}>
                      Cadastrar usuário
                    </ToggleButton>
                  </ToggleButtonGroup>

                  {/* Campo de e-mail (somente quando "cadastrar") */}
                  {isCadastrar && (
                    <TextField
                      size="small"
                      label="E-mail"
                      placeholder="usuario@exemplo.com"
                      value={estado.email}
                      onChange={(e) => setEmail(nome, e.target.value)}
                      error={emailErr}
                      helperText={emailErr ? "E-mail inválido" : "Usuário criado com senha temporária"}
                      sx={{ flex: 1, minWidth: 240 }}
                    />
                  )}
                </Box>
              );
            })}
          </CardContent>
        </Card>
      )}

      {/* ── Amostra de OAs ── */}
      <Card sx={{ mb: 3 }}>
        <CardContent sx={{ p: 0, pb: "0 !important" }}>
          <Box sx={{ p: 2.5, borderBottom: "1px solid", borderColor: "divider" }}>
            <Typography fontWeight={700}>Amostra ({preview.amostra.length} primeiros OAs)</Typography>
          </Box>
          <Table size="small">
            <TableHead>
              <TableRow sx={{ bgcolor: "#f8fafc" }}>
                {["Unidade", "Capítulo", "Código", "Tipo", "Progresso"].map((h) => (
                  <TableCell key={h} sx={{ fontWeight: 700, fontSize: "0.75rem", color: "text.secondary", py: 1.5 }}>{h}</TableCell>
                ))}
              </TableRow>
            </TableHead>
            <TableBody>
              {preview.amostra.map((row, i) => (
                <TableRow key={i} sx={{ "&:hover": { bgcolor: "action.hover" } }}>
                  <TableCell sx={{ py: 1.5 }}>U{row.unidade}</TableCell>
                  <TableCell>C{row.capitulo}</TableCell>
                  <TableCell sx={{ fontFamily: "monospace", fontWeight: 600 }}>{row.codigo}</TableCell>
                  <TableCell>
                    <Chip label={TIPO_LABELS[row.tipo] ?? row.tipo} size="small" sx={{ bgcolor: "#eff6ff", color: "primary.main", fontSize: "0.7rem" }} />
                  </TableCell>
                  <TableCell>
                    <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                      <LinearProgress variant="determinate" value={row.progressoPct} sx={{ width: 60, height: 6, borderRadius: 3 }} />
                      <Typography variant="caption">{row.progressoPct}%</Typography>
                    </Box>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Box sx={{ display: "flex", justifyContent: "space-between" }}>
        <Button onClick={onVoltar} startIcon={<ArrowBackIcon />}>Voltar</Button>
        <Button
          variant="contained" onClick={handleConfirmar}
          disabled={loadConfirm || temEmailInvalido || temCadastrarSemEmail}
          sx={{ fontWeight: 700 }}
        >
          {loadConfirm
            ? <CircularProgress size={20} sx={{ color: "white" }} />
            : `Confirmar e Importar ${preview.totalOAs} OAs`}
        </Button>
      </Box>
    </Box>
  );
}

// ─── Preview MI ───────────────────────────────────────────────────────────────
function PreviewMI({ preview, erro, erroConfirm, loadConfirm, codigo, nome, dataInicio, onVoltar, onConfirmar }: {
  preview: MIPreview; erro: boolean; erroConfirm?: string; loadConfirm: boolean;
  codigo: string; nome: string; dataInicio?: string;
  onVoltar: () => void; onConfirmar: () => void;
}) {
  const dataInicioFmt = dataInicio
    ? new Date(dataInicio + "T12:00:00").toLocaleDateString("pt-BR")
    : null;

  return (
    <Box>
      {erro && <Alert severity="error" sx={{ mb: 2 }}>Erro ao analisar arquivo. Verifique o formato.</Alert>}
      {erroConfirm && <Alert severity="error" sx={{ mb: 2 }}>{erroConfirm}</Alert>}

      {/* Resumo do curso a criar */}
      <Alert severity="info" icon={false} sx={{ mb: 3, bgcolor: "#eff6ff", border: "1px solid #bfdbfe" }}>
        <Typography variant="body2">
          Será criado o curso <strong>{nome}</strong>{" "}
          <Chip label={codigo} size="small" sx={{ fontFamily: "monospace", fontWeight: 700, fontSize: "0.72rem", mx: 0.5 }} />
          {dataInicioFmt
            ? <> com início em <strong>{dataInicioFmt}</strong> — deadlines serão calculados automaticamente.</>
            : <> com os dados abaixo. Sem data de início, os deadlines ficarão em branco.</>}
        </Typography>
      </Alert>

      <Box sx={{ display: "flex", gap: 2, mb: 3, flexWrap: "wrap" }}>
        <Paper sx={{ px: 3, py: 2, borderRadius: 2, textAlign: "center" }}>
          <Typography sx={{ fontSize: "2rem", fontWeight: 900, color: "primary.main" }}>{preview.totalCapitulos}</Typography>
          <Typography variant="caption" color="text.secondary">Capítulos</Typography>
        </Paper>
        <Paper sx={{ px: 3, py: 2, borderRadius: 2, textAlign: "center" }}>
          <Typography sx={{ fontSize: "2rem", fontWeight: 900, color: "#7c3aed" }}>{preview.totalObjetivos}</Typography>
          <Typography variant="caption" color="text.secondary">Objetivos Educacionais</Typography>
        </Paper>
        <Paper sx={{ px: 3, py: 2, borderRadius: 2, textAlign: "center", border: "1px solid #f59e0b22", bgcolor: "#fffbeb" }}>
          <Typography sx={{ fontSize: "2rem", fontWeight: 900, color: "#f59e0b" }}>{preview.totalOAs}</Typography>
          <Typography variant="caption" color="text.secondary">OAs a Gerar</Typography>
        </Paper>
        {preview.unidades.map((u) => (
          <Paper key={u.numero} sx={{ px: 3, py: 2, borderRadius: 2, textAlign: "center" }}>
            <Typography sx={{ fontSize: "1.5rem", fontWeight: 700 }}>{u.totalCapitulos}</Typography>
            <Typography variant="caption" color="text.secondary" noWrap sx={{ maxWidth: 100, display: "block" }}>
              U{u.numero}
            </Typography>
          </Paper>
        ))}
      </Box>
      {preview.avisos.length > 0 && (
        <Alert severity="warning" sx={{ mb: 2 }}>{preview.avisos.map((a, i) => <div key={i}>{a}</div>)}</Alert>
      )}
      <Card sx={{ mb: 3 }}>
        <CardContent sx={{ p: 0, pb: "0 !important" }}>
          <Box sx={{ p: 2.5, borderBottom: "1px solid", borderColor: "divider" }}>
            <Typography fontWeight={700}>Amostra ({preview.amostra.length} primeiros capítulos)</Typography>
          </Box>
          <Table size="small">
            <TableHead>
              <TableRow sx={{ bgcolor: "#f8fafc" }}>
                {["Unidade", "Cap.", "Nome", "CH Ass. (min)", "Objetivos", "OAs"].map((h) => (
                  <TableCell key={h} sx={{ fontWeight: 700, fontSize: "0.75rem", color: "text.secondary", py: 1.5 }}>{h}</TableCell>
                ))}
              </TableRow>
            </TableHead>
            <TableBody>
              {preview.amostra.map((cap, i) => (
                <TableRow key={i} sx={{ "&:hover": { bgcolor: "action.hover" } }}>
                  <TableCell sx={{ py: 1.5 }}>U{cap.unidade}</TableCell>
                  <TableCell>C{cap.numero}</TableCell>
                  <TableCell sx={{ maxWidth: 220 }}>
                    <Typography variant="body2" fontWeight={500} noWrap>{cap.nome}</Typography>
                  </TableCell>
                  <TableCell>{cap.chAssincrona || "—"}</TableCell>
                  <TableCell>
                    <Chip label={`${cap.objetivos.length} OE${cap.objetivos.length !== 1 ? "s" : ""}`}
                      size="small" sx={{ bgcolor: "#f3e8ff", color: "#7c3aed", fontWeight: 600, fontSize: "0.7rem" }} />
                  </TableCell>
                  <TableCell>
                    {cap.oaDefs.length > 0 ? (
                      <Chip
                        label={`${cap.oaDefs.reduce((s, d) => s + d.quantidade, 0)} OA${cap.oaDefs.reduce((s, d) => s + d.quantidade, 0) !== 1 ? "s" : ""}`}
                        size="small"
                        sx={{ bgcolor: "#fff7ed", color: "#f59e0b", fontWeight: 600, fontSize: "0.7rem" }}
                      />
                    ) : (
                      <Chip label="—" size="small" sx={{ bgcolor: "#fff5f5", color: "#ef4444", fontSize: "0.7rem" }} />
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
      <Box sx={{ display: "flex", justifyContent: "space-between" }}>
        <Button onClick={onVoltar} startIcon={<ArrowBackIcon />}>Voltar</Button>
        <Button variant="contained" onClick={onConfirmar} disabled={loadConfirm} sx={{ fontWeight: 700 }}>
          {loadConfirm
            ? <CircularProgress size={20} sx={{ color: "white" }} />
            : `Criar Curso e Importar ${preview.totalOAs} OAs`}
        </Button>
      </Box>
    </Box>
  );
}
