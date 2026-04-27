import { createFileRoute } from "@tanstack/react-router";
import {
  Box, Typography, Button, Card, CardContent, Table, TableHead,
  TableRow, TableCell, TableBody, Chip, Skeleton, Alert,
  Dialog, DialogTitle, DialogContent, DialogActions,
  TextField, FormControlLabel, Switch, FormGroup, Checkbox,
  Tooltip, IconButton, Stack, Select, MenuItem, FormControl,
  InputLabel, FormHelperText,
} from "@mui/material";
import AddIcon            from "@mui/icons-material/Add";
import DeleteOutlineIcon  from "@mui/icons-material/DeleteOutline";
import PlayArrowIcon      from "@mui/icons-material/PlayArrow";
import EditOutlinedIcon   from "@mui/icons-material/EditOutlined";
import ContentCopyIcon    from "@mui/icons-material/ContentCopy";
import { useState }       from "react";
import {
  useWebhooks, useCriarWebhook, useAtualizarWebhook, useExcluirWebhook, useTestarWebhook,
} from "@/lib/api/usuarios";
import { useCursos }      from "@/lib/api/cursos";
import type { WebhookItem, WebhookEvento } from "shared";
import { WEBHOOK_EVENTOS, WEBHOOK_EVENTO_LABEL } from "shared";

export const Route = createFileRoute("/_authed/admin/webhooks")({
  component: WebhooksPage,
});

// ─── Form padrão ─────────────────────────────────────────────────────────────

const FORM_VAZIO = {
  nome:    "",
  url:     "",
  segredo: "",
  eventos: [] as WebhookEvento[],
  ativo:   true,
  cursoId: "" as string,
};

type FormState = typeof FORM_VAZIO;

// ─── Componente principal ─────────────────────────────────────────────────────

function WebhooksPage() {
  const { data: webhooks = [], isLoading, isError } = useWebhooks();
  const { data: cursos  = [] } = useCursos();
  const criarMutation     = useCriarWebhook();
  const atualizarMutation = useAtualizarWebhook();
  const excluirMutation   = useExcluirWebhook();
  const testarMutation    = useTestarWebhook();

  const [dialogo, setDialogo]       = useState<"criar" | "editar" | null>(null);
  const [editando, setEditando]     = useState<WebhookItem | null>(null);
  const [form, setForm]             = useState<FormState>(FORM_VAZIO);
  const [erroForm, setErroForm]     = useState<string | null>(null);
  const [feedback, setFeedback]     = useState<{ tipo: "success" | "error"; msg: string } | null>(null);
  const [excluirId, setExcluirId]   = useState<string | null>(null);

  // ── Abrir diálogo ───────────────────────────────────────────────────────────

  function abrirCriar() {
    setEditando(null);
    setForm(FORM_VAZIO);
    setErroForm(null);
    setDialogo("criar");
  }

  function abrirEditar(wh: WebhookItem) {
    setEditando(wh);
    setForm({
      nome:    wh.nome,
      url:     wh.url,
      segredo: "", // nunca pré-preenchido por segurança
      eventos: wh.eventos,
      ativo:   wh.ativo,
      cursoId: wh.cursoId ?? "",
    });
    setErroForm(null);
    setDialogo("editar");
  }

  function fechar() {
    setDialogo(null);
    setEditando(null);
    setErroForm(null);
  }

  // ── Toggle de evento ────────────────────────────────────────────────────────

  function toggleEvento(ev: WebhookEvento) {
    setForm((f) => ({
      ...f,
      eventos: f.eventos.includes(ev)
        ? f.eventos.filter((e) => e !== ev)
        : [...f.eventos, ev],
    }));
  }

  // ── Salvar ──────────────────────────────────────────────────────────────────

  async function salvar() {
    if (!form.nome.trim())          { setErroForm("Informe um nome."); return; }
    if (!form.url.trim())           { setErroForm("Informe a URL."); return; }
    if (form.eventos.length === 0)  { setErroForm("Selecione ao menos um evento."); return; }

    try {
      const payload = {
        nome:    form.nome.trim(),
        url:     form.url.trim(),
        segredo: form.segredo.trim() || null,
        eventos: form.eventos,
        ativo:   form.ativo,
        cursoId: form.cursoId || null,
      };

      if (dialogo === "criar") {
        await criarMutation.mutateAsync(payload);
        setFeedback({ tipo: "success", msg: "Webhook criado com sucesso!" });
      } else if (editando) {
        await atualizarMutation.mutateAsync({ id: editando.id, data: payload });
        setFeedback({ tipo: "success", msg: "Webhook atualizado com sucesso!" });
      }
      fechar();
    } catch {
      setErroForm("Erro ao salvar o webhook. Verifique a URL e tente novamente.");
    }
  }

  // ── Excluir ─────────────────────────────────────────────────────────────────

  async function excluir() {
    if (!excluirId) return;
    try {
      await excluirMutation.mutateAsync(excluirId);
      setFeedback({ tipo: "success", msg: "Webhook removido." });
    } catch {
      setFeedback({ tipo: "error", msg: "Erro ao remover webhook." });
    } finally {
      setExcluirId(null);
    }
  }

  // ── Testar ──────────────────────────────────────────────────────────────────

  async function testar(id: string) {
    try {
      const res = await testarMutation.mutateAsync(id);
      setFeedback({ tipo: "success", msg: `Evento de teste "${res.evento}" enviado para ${res.url}` });
    } catch {
      setFeedback({ tipo: "error", msg: "Falha ao enviar evento de teste. Verifique se a URL é acessível." });
    }
  }

  // ── Render ──────────────────────────────────────────────────────────────────

  return (
    <Box>
      {/* Cabeçalho */}
      <Box sx={{ mb: 3, display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 2 }}>
        <Box>
          <Typography sx={{ fontSize: "1.375rem", fontWeight: 800 }}>Webhooks</Typography>
          <Typography variant="caption" color="text.disabled">
            Emita eventos para sistemas externos (ex: Slack) quando OAs forem concluídos ou atrasados.
          </Typography>
        </Box>
        <Button variant="contained" startIcon={<AddIcon />} onClick={abrirCriar} size="small">
          Novo Webhook
        </Button>
      </Box>

      {/* Feedback global */}
      {feedback && (
        <Alert
          severity={feedback.tipo}
          onClose={() => setFeedback(null)}
          sx={{ mb: 2 }}
        >
          {feedback.msg}
        </Alert>
      )}

      {/* Tabela */}
      <Card variant="outlined">
        <CardContent sx={{ p: 0, "&:last-child": { pb: 0 } }}>
          {isError ? (
            <Alert severity="error" sx={{ m: 2 }}>Erro ao carregar webhooks.</Alert>
          ) : isLoading ? (
            <Box sx={{ p: 2 }}>
              {[1, 2, 3].map((i) => <Skeleton key={i} height={48} sx={{ mb: 1 }} />)}
            </Box>
          ) : webhooks.length === 0 ? (
            <Box sx={{ p: 4, textAlign: "center" }}>
              <Typography color="text.disabled" variant="body2">
                Nenhum webhook configurado. Clique em "Novo Webhook" para começar.
              </Typography>
            </Box>
          ) : (
            <Table size="small">
              <TableHead>
                <TableRow sx={{ bgcolor: "action.hover" }}>
                  <TableCell><b>Nome</b></TableCell>
                  <TableCell><b>URL</b></TableCell>
                  <TableCell><b>Eventos</b></TableCell>
                  <TableCell><b>Curso</b></TableCell>
                  <TableCell align="center"><b>Ativo</b></TableCell>
                  <TableCell align="right"><b>Ações</b></TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {webhooks.map((wh) => (
                  <TableRow key={wh.id} hover>
                    <TableCell sx={{ fontWeight: 600 }}>{wh.nome}</TableCell>
                    <TableCell>
                      <Stack direction="row" alignItems="center" gap={0.5}>
                        <Typography
                          variant="caption"
                          sx={{
                            fontFamily: "monospace",
                            maxWidth: 260,
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                            whiteSpace: "nowrap",
                            display: "block",
                          }}
                        >
                          {wh.url}
                        </Typography>
                        <Tooltip title="Copiar URL">
                          <IconButton
                            size="small"
                            onClick={() => navigator.clipboard.writeText(wh.url)}
                          >
                            <ContentCopyIcon sx={{ fontSize: 14 }} />
                          </IconButton>
                        </Tooltip>
                      </Stack>
                    </TableCell>
                    <TableCell>
                      <Stack direction="row" gap={0.5} flexWrap="wrap">
                        {wh.eventos.map((ev) => (
                          <Chip
                            key={ev}
                            label={WEBHOOK_EVENTO_LABEL[ev]}
                            size="small"
                            color={ev === "oa.concluido" ? "success" : "warning"}
                            variant="outlined"
                          />
                        ))}
                      </Stack>
                    </TableCell>
                    <TableCell>
                      {wh.curso ? (
                        <Typography variant="caption" color="text.secondary">
                          {wh.curso.codigo} — {wh.curso.nome}
                        </Typography>
                      ) : (
                        <Chip label="Global" size="small" variant="outlined" />
                      )}
                    </TableCell>
                    <TableCell align="center">
                      <Switch
                        checked={wh.ativo}
                        size="small"
                        onChange={async (e) => {
                          try {
                            await atualizarMutation.mutateAsync({ id: wh.id, data: { ativo: e.target.checked } });
                          } catch {
                            setFeedback({ tipo: "error", msg: "Erro ao atualizar status." });
                          }
                        }}
                      />
                    </TableCell>
                    <TableCell align="right">
                      <Stack direction="row" justifyContent="flex-end" gap={0.5}>
                        <Tooltip title="Enviar evento de teste">
                          <IconButton
                            size="small"
                            color="primary"
                            onClick={() => testar(wh.id)}
                            disabled={testarMutation.isPending}
                          >
                            <PlayArrowIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>
                        <Tooltip title="Editar">
                          <IconButton size="small" onClick={() => abrirEditar(wh)}>
                            <EditOutlinedIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>
                        <Tooltip title="Excluir">
                          <IconButton size="small" color="error" onClick={() => setExcluirId(wh.id)}>
                            <DeleteOutlineIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>
                      </Stack>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Documentação rápida */}
      <Card variant="outlined" sx={{ mt: 3 }}>
        <CardContent>
          <Typography variant="subtitle2" fontWeight={700} gutterBottom>Como funciona</Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
            O RedeFLOW envia um <code>HTTP POST</code> com JSON para a URL configurada quando o evento ocorre.
            O payload tem o formato:
          </Typography>
          <Box
            component="pre"
            sx={{
              bgcolor: "action.hover",
              borderRadius: 1,
              p: 1.5,
              fontSize: "0.75rem",
              overflowX: "auto",
              mb: 1,
            }}
          >
{`{
  "evento":    "oa.concluido",
  "timestamp": "2026-04-27T10:00:00.000Z",
  "dados": {
    "oaId":        "...",
    "oaCodigo":    "U1C1OV1",
    "oaTitulo":    "Introdução ao Tema",
    "cursoId":     "...",
    "concluidoEm": "2026-04-27T10:00:00.000Z"
  }
}`}
          </Box>
          <Typography variant="body2" color="text.secondary">
            Quando um <b>segredo</b> é configurado, o header <code>X-RedeFlow-Signature: sha256=&lt;hmac&gt;</code> é
            enviado para que você possa verificar a autenticidade da requisição.
          </Typography>
        </CardContent>
      </Card>

      {/* Diálogo Criar / Editar */}
      <Dialog open={dialogo !== null} onClose={fechar} maxWidth="sm" fullWidth>
        <DialogTitle>{dialogo === "criar" ? "Novo Webhook" : "Editar Webhook"}</DialogTitle>
        <DialogContent sx={{ display: "flex", flexDirection: "column", gap: 2, pt: "12px !important" }}>
          {erroForm && <Alert severity="error">{erroForm}</Alert>}

          <TextField
            label="Nome"
            value={form.nome}
            onChange={(e) => setForm((f) => ({ ...f, nome: e.target.value }))}
            size="small"
            fullWidth
            placeholder="Ex: Slack #pipeline"
          />

          <TextField
            label="URL do Endpoint"
            value={form.url}
            onChange={(e) => setForm((f) => ({ ...f, url: e.target.value }))}
            size="small"
            fullWidth
            placeholder="https://hooks.slack.com/services/..."
            helperText="URL que receberá o HTTP POST com o payload do evento."
          />

          <TextField
            label="Segredo HMAC (opcional)"
            value={form.segredo}
            onChange={(e) => setForm((f) => ({ ...f, segredo: e.target.value }))}
            size="small"
            fullWidth
            type="password"
            placeholder={dialogo === "editar" ? "Deixe em branco para manter o atual" : "Mínimo 8 caracteres"}
            helperText="Usado para assinar o payload com SHA-256. Verifique com X-RedeFlow-Signature."
          />

          <Box>
            <Typography variant="caption" color="text.secondary" fontWeight={600} display="block" sx={{ mb: 0.5 }}>
              Eventos
            </Typography>
            <FormGroup row>
              {WEBHOOK_EVENTOS.map((ev) => (
                <FormControlLabel
                  key={ev}
                  control={
                    <Checkbox
                      checked={form.eventos.includes(ev)}
                      onChange={() => toggleEvento(ev)}
                      size="small"
                    />
                  }
                  label={
                    <Typography variant="body2">
                      {WEBHOOK_EVENTO_LABEL[ev]}{" "}
                      <Typography component="span" variant="caption" color="text.disabled">
                        ({ev})
                      </Typography>
                    </Typography>
                  }
                />
              ))}
            </FormGroup>
          </Box>

          <FormControl size="small" fullWidth>
            <InputLabel>Filtrar por Curso (opcional)</InputLabel>
            <Select
              value={form.cursoId}
              onChange={(e) => setForm((f) => ({ ...f, cursoId: e.target.value }))}
              label="Filtrar por Curso (opcional)"
            >
              <MenuItem value=""><em>Global — todos os cursos</em></MenuItem>
              {cursos.map((c) => (
                <MenuItem key={c.id} value={c.id}>
                  {c.codigo} — {c.nome}
                </MenuItem>
              ))}
            </Select>
            <FormHelperText>
              Deixe em branco para receber eventos de qualquer curso.
            </FormHelperText>
          </FormControl>

          <FormControlLabel
            control={
              <Switch
                checked={form.ativo}
                onChange={(e) => setForm((f) => ({ ...f, ativo: e.target.checked }))}
                size="small"
              />
            }
            label="Ativo"
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={fechar} color="inherit">Cancelar</Button>
          <Button
            onClick={salvar}
            variant="contained"
            disabled={criarMutation.isPending || atualizarMutation.isPending}
          >
            {dialogo === "criar" ? "Criar" : "Salvar"}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Diálogo Confirmar Exclusão */}
      <Dialog open={excluirId !== null} onClose={() => setExcluirId(null)} maxWidth="xs" fullWidth>
        <DialogTitle>Remover Webhook</DialogTitle>
        <DialogContent>
          <Typography>Tem certeza que deseja remover este webhook? Esta ação não pode ser desfeita.</Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setExcluirId(null)} color="inherit">Cancelar</Button>
          <Button
            onClick={excluir}
            color="error"
            variant="contained"
            disabled={excluirMutation.isPending}
          >
            Remover
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
