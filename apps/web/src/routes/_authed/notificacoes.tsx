import { useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import {
  Box, Typography, Paper, Tabs, Tab, List, ListItem,
  ListItemButton, Button, Chip, CircularProgress,
  Divider, Stack, Tooltip, IconButton, ToggleButton, ToggleButtonGroup,
  Card, CardContent, Avatar,
} from "@mui/material";
import OpenInNewOutlinedIcon       from "@mui/icons-material/OpenInNewOutlined";
import NotificationsNoneIcon       from "@mui/icons-material/NotificationsNone";
import ErrorOutlineIcon            from "@mui/icons-material/ErrorOutline";
import AccessTimeOutlinedIcon      from "@mui/icons-material/AccessTimeOutlined";
import LockOpenOutlinedIcon        from "@mui/icons-material/LockOpenOutlined";
import AlternateEmailOutlinedIcon  from "@mui/icons-material/AlternateEmailOutlined";
import DoneAllOutlinedIcon         from "@mui/icons-material/DoneAllOutlined";
import { useNotificacoes, useMarcarTodasLidas, useMarcarLida } from "@/lib/api/notificacoes";
import type { Notificacao } from "shared";

export const Route = createFileRoute("/_authed/notificacoes")({
  component: CentralNotificacoesPage,
});

// ─── Configuração por tipo ────────────────────────────────────────────────────

type TipoFiltro = "TODAS" | "DEADLINE_VENCIDO" | "PRAZO_PROXIMO" | "ETAPA_LIBERADA" | "MENCAO";

interface TipoConfig {
  label:    string;
  icon:     React.ReactNode;
  color:    string;    // MUI color token ou hex
  bgColor:  string;
  border:   string;
  chip:     "error" | "warning" | "info" | "success" | "default";
}

const TIPO_CONFIG: Record<string, TipoConfig> = {
  DEADLINE_VENCIDO: {
    label:   "Prazo vencido",
    icon:    <ErrorOutlineIcon />,
    color:   "#dc2626",
    bgColor: "#fff5f5",
    border:  "#ef4444",
    chip:    "error",
  },
  PRAZO_PROXIMO: {
    label:   "Prazo próximo",
    icon:    <AccessTimeOutlinedIcon />,
    color:   "#d97706",
    bgColor: "#fffbeb",
    border:  "#f59e0b",
    chip:    "warning",
  },
  ETAPA_LIBERADA: {
    label:   "Etapa liberada",
    icon:    <LockOpenOutlinedIcon />,
    color:   "#0891b2",
    bgColor: "#f0f9ff",
    border:  "#06b6d4",
    chip:    "info",
  },
  MENCAO: {
    label:   "Menção",
    icon:    <AlternateEmailOutlinedIcon />,
    color:   "#059669",
    bgColor: "#f0fdf4",
    border:  "#10b981",
    chip:    "success",
  },
};

const TABS: { value: TipoFiltro; label: string; icon: React.ReactNode }[] = [
  { value: "TODAS",            label: "Todas",          icon: <NotificationsNoneIcon fontSize="small" /> },
  { value: "DEADLINE_VENCIDO", label: "Prazo vencido",  icon: <ErrorOutlineIcon fontSize="small" /> },
  { value: "PRAZO_PROXIMO",    label: "Prazo próximo",  icon: <AccessTimeOutlinedIcon fontSize="small" /> },
  { value: "ETAPA_LIBERADA",   label: "Etapa liberada", icon: <LockOpenOutlinedIcon fontSize="small" /> },
  { value: "MENCAO",           label: "Menção",         icon: <AlternateEmailOutlinedIcon fontSize="small" /> },
];

// ─── Agrupamento por data ─────────────────────────────────────────────────────

function grupoData(data: Date): string {
  const hoje = new Date();
  const diff  = Math.floor((hoje.getTime() - data.getTime()) / 86_400_000);
  if (diff === 0) return "Hoje";
  if (diff === 1) return "Ontem";
  if (diff <= 7)  return "Esta semana";
  if (diff <= 30) return "Este mês";
  return "Mais antigas";
}

function agrupar(notifs: Notificacao[]): { grupo: string; items: Notificacao[] }[] {
  const map = new Map<string, Notificacao[]>();
  const ordem = ["Hoje", "Ontem", "Esta semana", "Este mês", "Mais antigas"];
  for (const n of notifs) {
    const g = grupoData(new Date(n.createdAt));
    if (!map.has(g)) map.set(g, []);
    map.get(g)!.push(n);
  }
  return ordem.filter((g) => map.has(g)).map((g) => ({ grupo: g, items: map.get(g)! }));
}

// ─── Card de notificação ──────────────────────────────────────────────────────

function NotifCard({ n, onMarcar, onNavegar }: {
  n:         Notificacao;
  onMarcar:  (id: string) => void;
  onNavegar: (n: Notificacao) => void;
}) {
  const cfg = TIPO_CONFIG[n.tipo];

  return (
    <ListItem
      disablePadding
      secondaryAction={
        n.entidadeTipo === "OA" && n.entidadeId ? (
          <Tooltip title="Abrir OA">
            <IconButton
              edge="end" size="small"
              onClick={() => onNavegar(n)}
              sx={{ mr: 0.5, color: "text.disabled", "&:hover": { color: "primary.main" } }}
            >
              <OpenInNewOutlinedIcon sx={{ fontSize: 16 }} />
            </IconButton>
          </Tooltip>
        ) : null
      }
    >
      <ListItemButton
        onClick={() => onNavegar(n)}
        sx={{
          px: 0, py: 0,
          pr: n.entidadeTipo === "OA" ? 5 : 0,
          alignItems: "stretch",
          "&:hover": { bgcolor: "transparent" },
        }}
      >
        {/* Barra colorida lateral */}
        <Box sx={{
          width: 4, flexShrink: 0, borderRadius: "4px 0 0 4px",
          bgcolor: n.lida ? "transparent" : (cfg?.border ?? "primary.main"),
          mr: 0,
        }} />

        {/* Ícone do tipo */}
        <Box sx={{
          display: "flex", alignItems: "center", justifyContent: "center",
          width: 44, flexShrink: 0,
          bgcolor: n.lida ? "transparent" : (cfg?.bgColor ?? "#f0f7ff"),
        }}>
          <Avatar
            sx={{
              width: 28, height: 28,
              bgcolor: n.lida ? "grey.100" : (cfg?.bgColor ?? "#eff6ff"),
              color:   n.lida ? "text.disabled" : (cfg?.color ?? "primary.main"),
            }}
          >
            {cfg ? (
              <Box sx={{ fontSize: 15, display: "flex" }}>{cfg.icon}</Box>
            ) : (
              <NotificationsNoneIcon sx={{ fontSize: 15 }} />
            )}
          </Avatar>
        </Box>

        {/* Conteúdo */}
        <Box sx={{
          flex: 1, px: 2, py: 1.5,
          bgcolor: n.lida ? "transparent" : (cfg?.bgColor ? cfg.bgColor + "66" : "#f0f7ff"),
          minWidth: 0,
        }}>
          <Stack direction="row" alignItems="flex-start" spacing={1} mb={0.25} flexWrap="wrap">
            <Typography
              variant="body2"
              fontWeight={n.lida ? 400 : 700}
              sx={{ fontSize: "0.8375rem", flex: 1, minWidth: 0 }}
            >
              {n.titulo}
            </Typography>
            {!n.lida && (
              <Box sx={{ width: 7, height: 7, borderRadius: "50%", bgcolor: "primary.main", mt: 0.75, flexShrink: 0 }} />
            )}
          </Stack>

          {n.corpo && (
            <Typography variant="caption" color="text.secondary" sx={{ display: "block", mb: 0.5 }}>
              {n.corpo}
            </Typography>
          )}

          <Stack direction="row" alignItems="center" spacing={1} flexWrap="wrap">
            {cfg && (
              <Chip
                label={cfg.label}
                size="small"
                color={cfg.chip}
                variant="outlined"
                sx={{ height: 17, fontSize: "0.6rem", fontWeight: 600 }}
              />
            )}
            <Typography variant="caption" color="text.disabled" sx={{ fontSize: "0.7rem" }}>
              {new Date(n.createdAt).toLocaleString("pt-BR", {
                day: "2-digit", month: "2-digit",
                hour: "2-digit", minute: "2-digit",
              })}
            </Typography>
            {!n.lida && (
              <Button
                size="small"
                onClick={(e) => { e.stopPropagation(); onMarcar(n.id); }}
                sx={{ fontSize: "0.7rem", py: 0, px: 0.75, minWidth: 0, color: "text.disabled", textTransform: "none" }}
              >
                Marcar como lida
              </Button>
            )}
          </Stack>
        </Box>
      </ListItemButton>
    </ListItem>
  );
}

// ─── Cards de resumo ──────────────────────────────────────────────────────────

function ResumoCards({ notifs }: { notifs: Notificacao[] }) {
  const naoLidas = notifs.filter((n) => !n.lida).length;
  const stats = [
    { tipo: "DEADLINE_VENCIDO", count: notifs.filter((n) => n.tipo === "DEADLINE_VENCIDO" && !n.lida).length },
    { tipo: "PRAZO_PROXIMO",    count: notifs.filter((n) => n.tipo === "PRAZO_PROXIMO"    && !n.lida).length },
    { tipo: "ETAPA_LIBERADA",   count: notifs.filter((n) => n.tipo === "ETAPA_LIBERADA"   && !n.lida).length },
    { tipo: "MENCAO",           count: notifs.filter((n) => n.tipo === "MENCAO"           && !n.lida).length },
  ].filter((s) => s.count > 0);

  if (naoLidas === 0) return null;

  return (
    <Stack direction="row" spacing={1.5} mb={3} flexWrap="wrap" useFlexGap>
      <Card variant="outlined" sx={{ flex: "0 0 auto", borderRadius: 2, minWidth: 120 }}>
        <CardContent sx={{ p: "12px 16px !important", textAlign: "center" }}>
          <Typography variant="h4" fontWeight={800} color="primary.main">{naoLidas}</Typography>
          <Typography variant="caption" color="text.secondary">não lidas</Typography>
        </CardContent>
      </Card>
      {stats.map((s) => {
        const cfg = TIPO_CONFIG[s.tipo]!;
        return (
          <Card key={s.tipo} variant="outlined" sx={{ flex: "0 0 auto", borderRadius: 2, borderColor: cfg.border, minWidth: 110 }}>
            <CardContent sx={{ p: "12px 16px !important", textAlign: "center" }}>
              <Stack direction="row" alignItems="center" justifyContent="center" spacing={0.75} mb={0.25}>
                <Box sx={{ color: cfg.color, display: "flex", fontSize: 16 }}>{cfg.icon}</Box>
                <Typography variant="h5" fontWeight={700} sx={{ color: cfg.color }}>{s.count}</Typography>
              </Stack>
              <Typography variant="caption" color="text.secondary" sx={{ fontSize: "0.68rem" }}>{cfg.label}</Typography>
            </CardContent>
          </Card>
        );
      })}
    </Stack>
  );
}

// ─── Página principal ─────────────────────────────────────────────────────────

export default function CentralNotificacoesPage() {
  const navigate = useNavigate();

  const [tipoAtivo,  setTipoAtivo]  = useState<TipoFiltro>("TODAS");
  const [lidaFiltro, setLidaFiltro] = useState<"todas" | "nao_lidas" | "lidas">("todas");

  const tipo = tipoAtivo === "TODAS" ? undefined : tipoAtivo;
  const lida = lidaFiltro === "todas" ? undefined : lidaFiltro === "lidas";

  const { data: notifs = [], isLoading } = useNotificacoes(tipo, lida);
  // busca sem filtro para ter o total real não lidas (para os cards de resumo)
  const { data: todas  = [] }            = useNotificacoes();

  const { mutate: marcarTodas, isPending: marcandoTodas } = useMarcarTodasLidas();
  const { mutate: marcarUma } = useMarcarLida();

  const naoLidas = todas.filter((n) => !n.lida).length;
  const grupos   = agrupar(notifs);

  const handleNavegar = (n: Notificacao) => {
    if (!n.lida) marcarUma(n.id);
    if (n.entidadeTipo === "OA" && n.entidadeId) {
      navigate({ to: "/oas/$oaId", params: { oaId: n.entidadeId } });
    }
  };

  return (
    <Box sx={{ maxWidth: 820, mx: "auto" }}>
      {/* Cabeçalho */}
      <Stack direction="row" alignItems="flex-start" justifyContent="space-between" mb={3} flexWrap="wrap" gap={1.5}>
        <Box>
          <Typography variant="h5" fontWeight={700}>Central de Notificações</Typography>
          <Typography variant="body2" color="text.secondary" mt={0.5}>
            {naoLidas > 0
              ? `${naoLidas} notificaç${naoLidas === 1 ? "ão não lida" : "ões não lidas"}`
              : "Tudo em dia — nenhuma notificação não lida"}
          </Typography>
        </Box>
        <Tooltip title={naoLidas === 0 ? "Nenhuma pendente" : "Marcar todas como lidas"}>
          <span>
            <Button
              variant="outlined" size="small"
              startIcon={marcandoTodas ? <CircularProgress size={14} /> : <DoneAllOutlinedIcon />}
              onClick={() => marcarTodas()}
              disabled={marcandoTodas || naoLidas === 0}
              sx={{ fontWeight: 600 }}
            >
              Marcar todas como lidas
            </Button>
          </span>
        </Tooltip>
      </Stack>

      {/* Cards de resumo (só quando há não lidas) */}
      <ResumoCards notifs={todas} />

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
                  {t.value !== "TODAS" && (() => {
                    const c = todas.filter((n) => n.tipo === t.value && !n.lida).length;
                    return c > 0 ? (
                      <Chip label={c} size="small" color="error"
                        sx={{ height: 16, fontSize: "0.6rem", minWidth: 16, ml: 0.25 }} />
                    ) : null;
                  })()}
                  {t.value === "TODAS" && naoLidas > 0 && (
                    <Chip label={naoLidas} size="small" color="error"
                      sx={{ height: 16, fontSize: "0.6rem", minWidth: 16, ml: 0.25 }} />
                  )}
                </Stack>
              }
              sx={{ minHeight: 48, textTransform: "none", fontSize: "0.8375rem" }}
            />
          ))}
        </Tabs>

        {/* Filtro lida/não lida */}
        <Box sx={{ px: 2.5, py: 1.25, borderBottom: "1px solid", borderColor: "divider", bgcolor: "grey.50",
          display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <ToggleButtonGroup
            value={lidaFiltro} exclusive size="small"
            onChange={(_, v) => { if (v) setLidaFiltro(v); }}
          >
            {[
              { v: "todas",     l: "Todas" },
              { v: "nao_lidas", l: "Não lidas" },
              { v: "lidas",     l: "Lidas" },
            ].map(({ v, l }) => (
              <ToggleButton key={v} value={v} sx={{ px: 2, fontSize: "0.75rem", textTransform: "none" }}>{l}</ToggleButton>
            ))}
          </ToggleButtonGroup>
          <Typography variant="caption" color="text.disabled">
            {notifs.length} notificaç{notifs.length !== 1 ? "ões" : "ão"}
          </Typography>
        </Box>

        {/* Lista agrupada */}
        {isLoading ? (
          <Box sx={{ p: 6, textAlign: "center" }}>
            <CircularProgress />
          </Box>
        ) : grupos.length === 0 ? (
          <Box sx={{ p: 7, textAlign: "center" }}>
            {tipoAtivo !== "TODAS" && TIPO_CONFIG[tipoAtivo] ? (
              <Box sx={{ color: TIPO_CONFIG[tipoAtivo].color, mb: 1.5, fontSize: 40, display: "flex", justifyContent: "center" }}>
                {TIPO_CONFIG[tipoAtivo].icon}
              </Box>
            ) : (
              <NotificationsNoneIcon sx={{ fontSize: 40, color: "text.disabled", mb: 1.5 }} />
            )}
            <Typography variant="body2" color="text.secondary">
              {lidaFiltro === "nao_lidas"
                ? "Nenhuma notificação não lida nesta categoria."
                : "Nenhuma notificação encontrada."}
            </Typography>
          </Box>
        ) : (
          <List disablePadding>
            {grupos.map(({ grupo, items }, gi) => (
              <Box key={grupo}>
                {/* Cabeçalho do grupo */}
                <Box sx={{ px: 2.5, py: 0.875, bgcolor: "#f8fafc", borderBottom: "1px solid", borderColor: "divider",
                  display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                  <Typography variant="caption" fontWeight={700} color="text.secondary" sx={{ letterSpacing: "0.06em" }}>
                    {grupo.toUpperCase()}
                  </Typography>
                  <Typography variant="caption" color="text.disabled">
                    {items.length} item{items.length !== 1 ? "s" : ""}
                  </Typography>
                </Box>

                {/* Itens do grupo */}
                {items.map((n, i) => (
                  <Box key={n.id}>
                    <NotifCard n={n} onMarcar={marcarUma} onNavegar={handleNavegar} />
                    {i < items.length - 1 && <Divider />}
                  </Box>
                ))}

                {gi < grupos.length - 1 && <Divider sx={{ borderWidth: 2, borderColor: "divider" }} />}
              </Box>
            ))}
          </List>
        )}
      </Paper>
    </Box>
  );
}
