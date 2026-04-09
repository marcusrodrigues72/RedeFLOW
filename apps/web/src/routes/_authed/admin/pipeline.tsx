import { createFileRoute } from "@tanstack/react-router";
import {
  Box, Typography, Card, CardContent, Table, TableHead,
  TableRow, TableCell, TableBody, Chip, Skeleton, Alert,
  TextField, Tooltip, IconButton, Switch,
} from "@mui/material";
import SaveOutlinedIcon  from "@mui/icons-material/SaveOutlined";
import { useState }      from "react";
import { usePipeline, useAtualizarEtapaDefinicao } from "@/lib/api/usuarios";
import type { EtapaDefinicaoAdmin } from "shared";

export const Route = createFileRoute("/_authed/admin/pipeline")({
  component: PipelinePage,
});

const TIPO_OA_LABEL: Record<string, string> = {
  VIDEO:       "Vídeo",
  SLIDE:       "Slide",
  QUIZ:        "Quiz",
  EBOOK:       "E-book",
  PLANO_AULA:  "Plano de Aula",
  TAREFA:      "Tarefa",
  INFOGRAFICO: "Infográfico",
  TIMELINE:    "Timeline",
};

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

function PipelinePage() {
  const { data: etapas = [], isLoading, isError } = usePipeline();

  // Agrupa por tipoOA (null = "Todos os tipos")
  const grupos = new Map<string, EtapaDefinicaoAdmin[]>();
  for (const e of etapas) {
    const key = e.tipoOA ?? "__todos__";
    if (!grupos.has(key)) grupos.set(key, []);
    grupos.get(key)!.push(e);
  }

  return (
    <Box>
      <Box sx={{ mb: 3 }}>
        <Typography sx={{ fontSize: "1.375rem", fontWeight: 800 }}>Pipeline de Produção</Typography>
        <Typography variant="caption" color="text.disabled">
          Configure o esforço estimado (horas/OA) por etapa. Esses valores são usados no cálculo automático de deadlines e na sugestão de alocação.
        </Typography>
      </Box>

      {isLoading ? (
        [1, 2, 3].map((i) => <Skeleton key={i} height={60} sx={{ mb: 1, borderRadius: 2 }} />)
      ) : isError ? (
        <Alert severity="error">Erro ao carregar definições de pipeline.</Alert>
      ) : (
        Array.from(grupos.entries()).map(([tipoKey, items]) => (
          <Box key={tipoKey} sx={{ mb: 3 }}>
            <Typography variant="caption" fontWeight={700} color="text.secondary"
              sx={{ textTransform: "uppercase", letterSpacing: 1, display: "block", mb: 1 }}>
              {tipoKey === "__todos__" ? "Comum a todos os tipos de OA" : TIPO_OA_LABEL[tipoKey] ?? tipoKey}
            </Typography>
            <Card>
              <CardContent sx={{ p: 0, pb: "0 !important" }}>
                <Table size="small">
                  <TableHead>
                    <TableRow sx={{ bgcolor: "#f8fafc" }}>
                      {["Ord.", "Etapa", "Papel", "Esforço (h/OA)", "Ativo", ""].map((h) => (
                        <TableCell key={h} sx={{ fontWeight: 700, fontSize: "0.72rem", color: "text.secondary", py: 1.25 }}>{h}</TableCell>
                      ))}
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {items.map((etapa) => (
                      <EtapaRow key={etapa.id} etapa={etapa} />
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </Box>
        ))
      )}
    </Box>
  );
}

function EtapaRow({ etapa }: { etapa: EtapaDefinicaoAdmin }) {
  const { mutate: atualizar, isPending } = useAtualizarEtapaDefinicao();
  const [esforco, setEsforco] = useState(String(etapa.esforcoHoras));
  const [ativo,   setAtivo]   = useState(etapa.ativo);

  const dirty = Number(esforco) !== etapa.esforcoHoras || ativo !== etapa.ativo;

  const handleSave = () => {
    const val = Math.max(0.5, Math.min(200, Number(esforco)));
    setEsforco(String(val));
    atualizar({ id: etapa.id, data: { esforcoHoras: val, ativo } });
  };

  return (
    <TableRow sx={{ "&:hover": { bgcolor: "action.hover" }, opacity: etapa.ativo ? 1 : 0.5 }}>
      <TableCell sx={{ py: 1, color: "text.disabled", fontFamily: "monospace", fontSize: "0.75rem" }}>
        {etapa.ordem}
      </TableCell>
      <TableCell sx={{ py: 1 }}>
        <Typography variant="body2" fontWeight={500}>{etapa.nome}</Typography>
      </TableCell>
      <TableCell sx={{ py: 1 }}>
        <Chip
          label={PAPEL_LABEL[etapa.papel] ?? etapa.papel}
          size="small"
          sx={{ bgcolor: "#eff6ff", color: "primary.main", fontWeight: 600, fontSize: "0.65rem" }}
        />
      </TableCell>
      <TableCell sx={{ py: 1, width: 140 }}>
        <TextField
          size="small"
          type="number"
          value={esforco}
          onChange={(e) => setEsforco(e.target.value)}
          onBlur={() => setEsforco(String(Math.max(0.5, Math.min(200, Number(esforco)))))}
          inputProps={{ min: 0.5, max: 200, step: 0.5 }}
          sx={{ width: 90, "& .MuiInputBase-input": { fontSize: "0.8125rem", py: 0.5, px: 1 } }}
          InputProps={{
            endAdornment: <Typography variant="caption" color="text.disabled" sx={{ ml: 0.5, whiteSpace: "nowrap" }}>h</Typography>,
          }}
        />
      </TableCell>
      <TableCell sx={{ py: 1 }}>
        <Tooltip title={ativo ? "Desativar etapa" : "Ativar etapa"}>
          <Switch
            size="small"
            checked={ativo}
            onChange={(e) => setAtivo(e.target.checked)}
          />
        </Tooltip>
      </TableCell>
      <TableCell sx={{ py: 1 }} align="right">
        {dirty && (
          <Tooltip title="Salvar alterações">
            <IconButton size="small" color="primary" onClick={handleSave} disabled={isPending}>
              <SaveOutlinedIcon sx={{ fontSize: 16 }} />
            </IconButton>
          </Tooltip>
        )}
      </TableCell>
    </TableRow>
  );
}
