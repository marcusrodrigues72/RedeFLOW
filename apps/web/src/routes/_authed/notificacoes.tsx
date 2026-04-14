import { useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import {
  Box, Typography, Paper, Tabs, Tab, List, ListItem,
  ListItemButton, ListItemText, Button, Chip, CircularProgress,
  Divider, Stack, Tooltip, IconButton, ToggleButton, ToggleButtonGroup,
} from "@mui/material";
import CheckCircleOutlineIcon      from "@mui/icons-material/CheckCircleOutline";
import OpenInNewOutlinedIcon       from "@mui/icons-material/OpenInNewOutlined";
import NotificationsNoneIcon       from "@mui/icons-material/NotificationsNone";
import ErrorOutlineIcon            from "@mui/icons-material/ErrorOutline";
import AccessTimeOutlinedIcon      from "@mui/icons-material/AccessTimeOutlined";
import LockOpenOutlinedIcon        from "@mui/icons-material/LockOpenOutlined";
import AlternateEmailOutlinedIcon  from "@mui/icons-material/AlternateEmailOutlined";
import { useNotificacoes, useMarcarTodasLidas, useMarcarLida } from "@/lib/api/notificacoes";
import type { Notificacao } from "shared";

export const Route = createFileRoute("/_authed/notificacoes")({
  component: CentralNotificacoesPage,
});

// ─── Tipos de notificação ─────────────────────────────────────────────────────

type TipoFiltro = "TODAS" | "DEADLINE_VENCIDO" | "PRAZO_PROXIMO" | "ETAPA_LIBERADA" | "MENCAO";

const TABS: { value: TipoFiltro; label: string; icon: React.ReactNode }[] = [
  { value: "TODAS",            label: "Todas",          icon: <NotificationsNoneIcon fontSize="small" /> },
  { value: "DEADLINE_VENCIDO", label: "Prazo vencido",  icon: <ErrorOutlineIcon fontSize="small" /> },
  { value: "PRAZO_PROXIMO",    label: "Prazo próximo",  icon: <AccessTimeOutlinedIcon fontSize="small" /> },
  { value: "ETAPA_LIBERADA",   label: "Etapa liberada", icon: <LockOpenOutlinedIcon fontSize="small" /> },
  { value: "MENCAO",           label: "Menção",         icon: <AlternateEmailOutlinedIcon fontSize="small" /> },
];

const TIPO_COLOR: Record<string, "error" | "warning" | "info" | "success" | "default"> = {
  DEADLINE_VENCIDO: "error",
  PRAZO_PROXIMO:    "warning",
  ETAPA_LIBERADA:   "info",
  MENCAO:           "success",
};

const TIPO_LABEL: Record<string, string> = {
  DEADLINE_VENCIDO: "Prazo vencido",
  PRAZO_PROXIMO:    "Prazo próximo",
  ETAPA_LIBERADA:   "Etapa liberada",
  MENCAO:           "Menção",
};

// ─── Componente ───────────────────────────────────────────────────────────────

export default function CentralNotificacoesPage() {
  const navigate = useNavigate();

  const [tipoAtivo, setTipoAtivo] = useState<TipoFiltro>("TODAS");
  const [lidaFiltro, setLidaFiltro] = useState<"todas" | "nao_lidas" | "lidas">("todas");

  const tipo = tipoAtivo === "TODAS" ? undefined : tipoAtivo;
  const lida = lidaFiltro === "todas" ? undefined : lidaFiltro === "lidas";

  const { data: notifs = [], isLoading } = useNotificacoes(tipo, lida);
  const { mutate: marcarTodas, isPending: marcandoTodas } = useMarcarTodasLidas();
  const { mutate: marcarUma } = useMarcarLida();

  const naoLidas = notifs.filter((n) => !n.lida).length;

  const handleClick = (n: Notificacao) => {
    if (!n.lida) marcarUma(n.id);
    if (n.entidadeTipo === "OA" && n.entidadeId) {
      navigate({ to: "/oas/$oaId", params: { oaId: n.entidadeId } });
    }
  };

  return (
    <Box sx={{ maxWidth: 800, mx: "auto" }}>
      {/* Cabeçalho */}
      <Stack direction="row" alignItems="center" justifyContent="space-between" mb={3}>
        <Box>
          <Typography variant="h5" fontWeight={700}>Central de Notificações</Typography>
          {naoLidas > 0 && (
            <Typography variant="body2" color="text.secondary" mt={0.5}>
              {naoLidas} notificaç{naoLidas === 1 ? "ão não lida" : "ões não lidas"}
            </Typography>
          )}
        </Box>
        <Tooltip title="Marcar todas como lidas">
          <span>
            <Button
              variant="outlined"
              size="small"
              startIcon={marcandoTodas ? <CircularProgress size={14} /> : <CheckCircleOutlineIcon />}
              onClick={() => marcarTodas()}
              disabled={marcandoTodas || naoLidas === 0}
            >
              Marcar todas como lidas
            </Button>
          </span>
        </Tooltip>
      </Stack>

      <Paper variant="outlined" sx={{ borderRadius: 3, overflow: "hidden" }}>
        {/* Tabs por tipo */}
        <Tabs
          value={tipoAtivo}
          onChange={(_, v) => setTipoAtivo(v)}
          variant="scrollable"
          scrollButtons="auto"
          sx={{ borderBottom: "1px solid", borderColor: "divider", px: 1 }}
        >
          {TABS.map((t) => (
            <Tab
              key={t.value}
              value={t.value}
              label={
                <Stack direction="row" alignItems="center" gap={0.75}>
                  {t.icon}
                  {t.label}
                </Stack>
              }
              sx={{ minHeight: 48, textTransform: "none", fontSize: "0.8375rem" }}
            />
          ))}
        </Tabs>

        {/* Filtro lida/não lida */}
        <Box sx={{ px: 2.5, py: 1.5, borderBottom: "1px solid", borderColor: "divider", bgcolor: "grey.50" }}>
          <ToggleButtonGroup
            value={lidaFiltro}
            exclusive
            onChange={(_, v) => { if (v) setLidaFiltro(v); }}
            size="small"
          >
            <ToggleButton value="todas"     sx={{ px: 2, fontSize: "0.75rem", textTransform: "none" }}>Todas</ToggleButton>
            <ToggleButton value="nao_lidas" sx={{ px: 2, fontSize: "0.75rem", textTransform: "none" }}>Não lidas</ToggleButton>
            <ToggleButton value="lidas"     sx={{ px: 2, fontSize: "0.75rem", textTransform: "none" }}>Lidas</ToggleButton>
          </ToggleButtonGroup>
        </Box>

        {/* Lista */}
        {isLoading ? (
          <Box sx={{ p: 5, textAlign: "center" }}>
            <CircularProgress />
          </Box>
        ) : notifs.length === 0 ? (
          <Box sx={{ p: 6, textAlign: "center" }}>
            <NotificationsNoneIcon sx={{ fontSize: 40, color: "text.disabled", mb: 1 }} />
            <Typography variant="body2" color="text.secondary">Nenhuma notificação encontrada.</Typography>
          </Box>
        ) : (
          <List disablePadding>
            {notifs.map((n, i) => (
              <Box key={n.id}>
                <ListItem
                  disablePadding
                  secondaryAction={
                    n.entidadeTipo === "OA" && n.entidadeId ? (
                      <Tooltip title="Abrir OA">
                        <IconButton
                          edge="end"
                          size="small"
                          onClick={() => handleClick(n)}
                          sx={{ mr: 0.5 }}
                        >
                          <OpenInNewOutlinedIcon sx={{ fontSize: 16 }} />
                        </IconButton>
                      </Tooltip>
                    ) : null
                  }
                >
                  <ListItemButton
                    onClick={() => handleClick(n)}
                    sx={{
                      px: 2.5, py: 1.75,
                      bgcolor: n.lida ? "transparent" : "#f0f7ff",
                      alignItems: "flex-start",
                      pr: n.entidadeTipo === "OA" ? 6 : 2.5,
                    }}
                  >
                    {/* Indicador não lida */}
                    {!n.lida && (
                      <Box sx={{ width: 7, height: 7, borderRadius: "50%", bgcolor: "primary.main",
                        mt: 1, mr: 1.5, flexShrink: 0 }} />
                    )}
                    {n.lida && <Box sx={{ width: 7, mr: 1.5, flexShrink: 0 }} />}

                    <ListItemText
                      primary={
                        <Stack direction="row" alignItems="center" gap={1} flexWrap="wrap">
                          <Typography
                            variant="body2"
                            fontWeight={n.lida ? 400 : 700}
                            sx={{ fontSize: "0.8375rem" }}
                          >
                            {n.titulo}
                          </Typography>
                          <Chip
                            label={TIPO_LABEL[n.tipo] ?? n.tipo}
                            size="small"
                            color={TIPO_COLOR[n.tipo] ?? "default"}
                            variant="outlined"
                            sx={{ height: 18, fontSize: "0.65rem", fontWeight: 600 }}
                          />
                        </Stack>
                      }
                      secondary={
                        <Box mt={0.5}>
                          {n.corpo && (
                            <Typography variant="caption" color="text.secondary" sx={{ display: "block" }}>
                              {n.corpo}
                            </Typography>
                          )}
                          <Typography variant="caption" color="text.disabled" sx={{ mt: 0.25, display: "block" }}>
                            {new Date(n.createdAt).toLocaleString("pt-BR", {
                              day:    "2-digit",
                              month:  "2-digit",
                              year:   "numeric",
                              hour:   "2-digit",
                              minute: "2-digit",
                            })}
                          </Typography>
                        </Box>
                      }
                      sx={{ m: 0 }}
                    />
                  </ListItemButton>
                </ListItem>
                {i < notifs.length - 1 && <Divider />}
              </Box>
            ))}
          </List>
        )}
      </Paper>
    </Box>
  );
}
