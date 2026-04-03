import type { ReactNode } from "react";
import { useState } from "react";
import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import {
  Box, Typography, Avatar, Divider, IconButton,
  Tooltip, Badge, Button, Chip, Popover, List,
  ListItem, ListItemText, ListItemButton, CircularProgress,
} from "@mui/material";
import DashboardOutlinedIcon      from "@mui/icons-material/DashboardOutlined";
import SchoolOutlinedIcon         from "@mui/icons-material/SchoolOutlined";
import AssignmentOutlinedIcon     from "@mui/icons-material/AssignmentOutlined";
import BarChartOutlinedIcon       from "@mui/icons-material/BarChartOutlined";
import PeopleOutlinedIcon         from "@mui/icons-material/PeopleOutlined";
import CalendarMonthOutlinedIcon  from "@mui/icons-material/CalendarMonthOutlined";
import NotificationsNoneIcon      from "@mui/icons-material/NotificationsNone";
import CheckCircleOutlineIcon     from "@mui/icons-material/CheckCircleOutline";
import LogoutOutlinedIcon         from "@mui/icons-material/LogoutOutlined";
import AddIcon                    from "@mui/icons-material/Add";
import { useAuthStore } from "@/stores/auth.store";
import { api } from "@/lib/api";
import { useNaoLidasCount, useNotificacoes, useMarcarTodasLidas, useMarcarLida } from "@/lib/api/notificacoes";

const SIDEBAR_W = 256;

interface NavItem { label: string; to: string; icon: ReactNode; exact?: boolean; adminOnly?: boolean }

const NAV: NavItem[] = [
  { label: "Dashboard",    to: "/",             icon: <DashboardOutlinedIcon fontSize="small" />, exact: true },
  { label: "Cursos",       to: "/cursos",       icon: <SchoolOutlinedIcon fontSize="small" /> },
  { label: "Meu Trabalho", to: "/meu-trabalho", icon: <AssignmentOutlinedIcon fontSize="small" /> },
  { label: "Relatórios",   to: "/relatorios",   icon: <BarChartOutlinedIcon fontSize="small" /> },
  { label: "Alocação",     to: "/alocacao",     icon: <CalendarMonthOutlinedIcon fontSize="small" /> },
  { label: "Equipe",       to: "/admin/usuarios", icon: <PeopleOutlinedIcon fontSize="small" />, adminOnly: true },
];

export default function AppLayout({ children }: { children: ReactNode }) {
  const user                     = useAuthStore((s) => s.user);
  const { logout, refreshToken } = useAuthStore();
  const navigate                 = useNavigate();
  const { location }             = useRouterState();
  const pathname                 = location.pathname;
  const isAdmin                  = user?.papelGlobal === "ADMIN";

  // Notificações
  const { data: naoLidas = 0 }                     = useNaoLidasCount();
  const [anchorEl, setAnchorEl]                    = useState<HTMLElement | null>(null);
  const { data: notifs = [], isLoading: loadNotif } = useNotificacoes();
  const { mutate: marcarTodas, isPending: marcando } = useMarcarTodasLidas();
  const { mutate: marcarUma }                        = useMarcarLida();

  const handleLogout = async () => {
    try { await api.post("/auth/logout", { refreshToken }); } catch { /* ignora */ }
    logout();
    await navigate({ to: "/login" });
  };

  const isActive = (to: string, exact?: boolean) =>
    exact ? pathname === to : pathname.startsWith(to);

  return (
    <Box sx={{ display: "flex", minHeight: "100vh", bgcolor: "background.default" }}>

      {/* ── Sidebar ────────────────────────────────────────────────────────── */}
      <Box
        component="aside"
        sx={{
          width: SIDEBAR_W, flexShrink: 0,
          bgcolor: "background.paper",
          borderRight: "1px solid", borderColor: "divider",
          display: "flex", flexDirection: "column",
          position: "fixed", height: "100vh", zIndex: 200,
        }}
      >
        {/* Marca */}
        <Box sx={{ px: 3, pt: 3, pb: 2 }}>
          <Typography sx={{ fontWeight: 900, fontSize: "1.25rem", color: "primary.main", letterSpacing: "-0.02em" }}>
            RedeFLOW
          </Typography>
          <Typography variant="caption" color="text.disabled">iRede EAD</Typography>
        </Box>

        {/* CTA */}
        <Box sx={{ px: 2, pb: 2 }}>
          <Button
            component={Link} to="/cursos/importar"
            variant="contained" fullWidth startIcon={<AddIcon />}
            sx={{ borderRadius: 2, fontWeight: 700, py: 1 }}
          >
            Importar Planilha
          </Button>
        </Box>

        <Divider />

        {/* Navegação */}
        <Box sx={{ flex: 1, py: 1.5, overflowY: "auto" }}>
          <Typography variant="caption" sx={{ px: 3, py: 1, display: "block", color: "text.disabled", letterSpacing: "0.08em" }}>
            MENU
          </Typography>

          {NAV.filter((item) => !item.adminOnly || isAdmin).map((item) => {
            const active = isActive(item.to, item.exact);
            return (
              <Box key={item.to} component={Link} to={item.to} sx={{ textDecoration: "none", display: "block", px: 1.5, mb: 0.5 }}>
                <Box
                  sx={{
                    display: "flex", alignItems: "center", gap: 1.5,
                    px: 1.5, py: 1, borderRadius: 2,
                    bgcolor: active ? "primary.main" : "transparent",
                    color: active ? "white" : "text.secondary",
                    borderLeft: active ? "3px solid rgba(255,255,255,0.6)" : "3px solid transparent",
                    transition: "all 0.15s",
                    "&:hover": { bgcolor: active ? "primary.dark" : "action.hover", color: active ? "white" : "text.primary" },
                  }}
                >
                  <Box sx={{ color: "inherit", display: "flex" }}>{item.icon}</Box>
                  <Typography sx={{ fontSize: "0.875rem", fontWeight: active ? 600 : 400, color: "inherit" }}>
                    {item.label}
                  </Typography>
                </Box>
              </Box>
            );
          })}

          <Typography variant="caption" sx={{ px: 3, pt: 2, pb: 1, display: "block", color: "text.disabled", letterSpacing: "0.08em" }}>
            DEPARTAMENTOS
          </Typography>
          {["Graduação", "Pós-Graduação", "Cursos Livres"].map((dep) => (
            <Box key={dep} sx={{ px: 3, py: 0.75, display: "flex", alignItems: "center", gap: 1, cursor: "default" }}>
              <Box sx={{ width: 8, height: 8, borderRadius: "50%", bgcolor: "divider" }} />
              <Typography variant="body2" color="text.disabled" sx={{ fontSize: "0.8125rem" }}>{dep}</Typography>
            </Box>
          ))}
        </Box>

        {/* Perfil */}
        <Divider />
        <Box sx={{ p: 2, display: "flex", alignItems: "center", gap: 1.5 }}>
          <Box
            component={Link} to="/perfil"
            sx={{ display: "flex", alignItems: "center", gap: 1.5, flex: 1, minWidth: 0, textDecoration: "none",
              borderRadius: 2, px: 1, py: 0.5, mx: -1,
              "&:hover": { bgcolor: "action.hover" }, transition: "background 0.15s" }}
          >
            <Avatar
              src={user?.fotoUrl ?? undefined}
              sx={{ width: 34, height: 34, bgcolor: "primary.main", fontSize: "0.8125rem", fontWeight: 700 }}
            >
              {user?.nome?.[0]?.toUpperCase()}
            </Avatar>
            <Box sx={{ flex: 1, minWidth: 0 }}>
              <Typography variant="body2" fontWeight={600} noWrap sx={{ fontSize: "0.8125rem", color: "text.primary" }}>
                {user?.nome}
              </Typography>
              <Box sx={{ display: "flex", alignItems: "center", gap: 0.5 }}>
                <Box sx={{ width: 6, height: 6, borderRadius: "50%", bgcolor: "#10b981" }} />
                <Typography variant="caption" color="text.disabled" sx={{ fontSize: "0.7rem" }}>Online</Typography>
              </Box>
            </Box>
          </Box>
          <Tooltip title="Sair">
            <IconButton size="small" onClick={handleLogout} aria-label="Sair">
              <LogoutOutlinedIcon sx={{ fontSize: 18 }} />
            </IconButton>
          </Tooltip>
        </Box>
      </Box>

      {/* ── Main ───────────────────────────────────────────────────────────── */}
      <Box component="main" sx={{ flex: 1, ml: `${SIDEBAR_W}px`, display: "flex", flexDirection: "column", minHeight: "100vh" }}>

        {/* Topbar */}
        <Box
          component="header"
          sx={{
            height: 56, position: "sticky", top: 0, zIndex: 100,
            bgcolor: "background.paper",
            borderBottom: "1px solid", borderColor: "divider",
            display: "flex", alignItems: "center", justifyContent: "space-between",
            px: 4,
          }}
        >
          <Typography variant="caption" color="text.secondary" sx={{ letterSpacing: "0.05em" }}>
            {getBreadcrumb(pathname)}
          </Typography>

          <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
            <Tooltip title="Notificações">
              <IconButton
                size="small" aria-label="Notificações"
                onClick={(e) => setAnchorEl(e.currentTarget)}
              >
                <Badge
                  badgeContent={naoLidas || undefined}
                  color="error"
                  sx={{ "& .MuiBadge-badge": { fontSize: "0.6rem", minWidth: 16, height: 16 } }}
                >
                  <NotificationsNoneIcon sx={{ fontSize: 20 }} />
                </Badge>
              </IconButton>
            </Tooltip>
            <Chip
              label={isAdmin ? "Admin" : "Colaborador"}
              size="small"
              sx={{ bgcolor: "#eff6ff", color: "primary.main", fontWeight: 600, fontSize: "0.7rem" }}
            />
          </Box>
        </Box>

        {/* Conteúdo */}
        <Box sx={{ flex: 1, p: 4, maxWidth: 1400, width: "100%" }}>
          {children}
        </Box>
      </Box>

      {/* ── Popover de Notificações ─────────────────────────────────────────── */}
      <Popover
        open={Boolean(anchorEl)}
        anchorEl={anchorEl}
        onClose={() => setAnchorEl(null)}
        anchorOrigin={{ vertical: "bottom", horizontal: "right" }}
        transformOrigin={{ vertical: "top", horizontal: "right" }}
        PaperProps={{ sx: { width: 360, maxHeight: 480, borderRadius: 3, boxShadow: "0 8px 32px rgba(0,0,0,0.12)" } }}
      >
        {/* Cabeçalho */}
        <Box sx={{ px: 2.5, py: 1.75, display: "flex", alignItems: "center", justifyContent: "space-between",
          borderBottom: "1px solid", borderColor: "divider" }}>
          <Typography fontWeight={700} sx={{ fontSize: "0.9rem" }}>
            Notificações {naoLidas > 0 && <Chip label={naoLidas} size="small" color="error" sx={{ ml: 0.5, height: 18, fontSize: "0.6rem" }} />}
          </Typography>
          {naoLidas > 0 && (
            <Tooltip title="Marcar todas como lidas">
              <IconButton size="small" onClick={() => marcarTodas()} disabled={marcando}>
                {marcando ? <CircularProgress size={16} /> : <CheckCircleOutlineIcon sx={{ fontSize: 18 }} />}
              </IconButton>
            </Tooltip>
          )}
        </Box>

        {/* Lista */}
        {loadNotif ? (
          <Box sx={{ p: 3, textAlign: "center" }}>
            <CircularProgress size={24} />
          </Box>
        ) : notifs.length === 0 ? (
          <Box sx={{ p: 4, textAlign: "center" }}>
            <Typography variant="body2" color="text.secondary">Nenhuma notificação.</Typography>
          </Box>
        ) : (
          <List disablePadding sx={{ overflowY: "auto", maxHeight: 380 }}>
            {notifs.map((n, i) => (
              <Box key={n.id}>
                <ListItem disablePadding>
                  <ListItemButton
                    onClick={() => { if (!n.lida) marcarUma(n.id); }}
                    sx={{ px: 2.5, py: 1.5, bgcolor: n.lida ? "transparent" : "#f0f7ff", alignItems: "flex-start" }}
                  >
                    {!n.lida && (
                      <Box sx={{ width: 6, height: 6, borderRadius: "50%", bgcolor: "primary.main",
                        mt: 0.75, mr: 1.5, flexShrink: 0 }} />
                    )}
                    <ListItemText
                      primary={
                        <Typography variant="body2" fontWeight={n.lida ? 400 : 700} sx={{ fontSize: "0.825rem" }}>
                          {n.titulo}
                        </Typography>
                      }
                      secondary={
                        <Box>
                          {n.corpo && (
                            <Typography variant="caption" color="text.secondary" sx={{ display: "block", mt: 0.25 }}>
                              {n.corpo}
                            </Typography>
                          )}
                          <Typography variant="caption" color="text.disabled" sx={{ mt: 0.25, display: "block" }}>
                            {new Date(n.createdAt).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}
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
      </Popover>
    </Box>
  );
}

function getBreadcrumb(path: string): string {
  if (path === "/")                        return "REDEFLOW · DASHBOARD";
  if (path.startsWith("/cursos/importar"))         return "REDEFLOW · CURSOS · IMPORTAR";
  if (path.includes("/setup-producao"))            return "REDEFLOW · CURSOS · SETUP DE PRODUÇÃO";
  if (path.startsWith("/cursos/"))                 return "REDEFLOW · CURSOS · DETALHE";
  if (path.startsWith("/cursos"))          return "REDEFLOW · CURSOS";
  if (path.startsWith("/meu-trabalho"))    return "REDEFLOW · MEU TRABALHO";
  if (path.startsWith("/relatorios"))      return "REDEFLOW · RELATÓRIOS";
  if (path.startsWith("/alocacao"))        return "REDEFLOW · ALOCAÇÃO DO TIME";
  if (path.startsWith("/oas/"))            return "REDEFLOW · OAs · DETALHE";
  if (path.startsWith("/admin/usuarios"))  return "REDEFLOW · EQUIPE";
  if (path.startsWith("/perfil"))          return "REDEFLOW · MEU PERFIL";
  return "REDEFLOW";
}
