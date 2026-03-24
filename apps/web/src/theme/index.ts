// Azure Ethos — Design System RedeFLOW (MUI v6)
// Baseado em DESIGN.md: Editorial, Academic Curator, Intentional Asymmetry
import { createTheme } from "@mui/material/styles";

export const theme = createTheme({
  cssVariables: false, // usar abordagem clássica sem CSS vars por ora

  palette: {
    primary: {
      main: "#2b7cee",
      light: "#5b9ef4",
      dark: "#1a5dbf",
      contrastText: "#ffffff",
    },
    warning:  { main: "#f59e0b" }, // In Progress / Revisão pedagógica
    success:  { main: "#10b981" }, // Concluído (Emerald)
    error:    { main: "#ef4444" },
    background: {
      default: "#f8f9fb", // surface_dim — floor da aplicação
      paper:   "#ffffff", // surface — cards e sidebar
    },
    text: {
      primary:   "#0f172a", // slate-900 (nunca black puro)
      secondary: "#64748b", // slate-500
      disabled:  "#94a3b8", // slate-400
    },
    divider: "#f1f5f9", // slate-100 "ghost border"
  },

  typography: {
    fontFamily: "'Inter', sans-serif",
    h1: { fontSize: "1.875rem", fontWeight: 800, color: "#0f172a", lineHeight: 1.2 },
    h2: { fontSize: "1.5rem",   fontWeight: 700, color: "#0f172a", lineHeight: 1.3 },
    h3: { fontSize: "1.25rem",  fontWeight: 700, color: "#0f172a" },
    h4: { fontSize: "1.125rem", fontWeight: 600, color: "#0f172a" },
    h5: { fontSize: "1rem",     fontWeight: 600, color: "#0f172a" },
    h6: { fontSize: "0.875rem", fontWeight: 600, color: "#0f172a" },
    body1:   { fontSize: "0.875rem",  fontWeight: 400, color: "#0f172a" },
    body2:   { fontSize: "0.8125rem", fontWeight: 400, color: "#64748b" },
    caption: {
      fontSize: "0.6875rem",
      fontWeight: 500,
      letterSpacing: "0.06em",
      textTransform: "uppercase",
      color: "#64748b",
    },
    button: { fontSize: "0.875rem", fontWeight: 600, textTransform: "none", letterSpacing: "0.01em" },
  },

  shape: { borderRadius: 12 },

  components: {
    MuiCssBaseline: {
      styleOverrides: {
        body: { backgroundColor: "#f8f9fb", scrollbarWidth: "thin" },
      },
    },

    MuiCard: {
      styleOverrides: {
        root: {
          borderRadius: 16,
          boxShadow: "0 1px 3px 0 rgb(0 0 0 / 0.04), 0 1px 2px -1px rgb(0 0 0 / 0.04)",
          border: "none",
        },
      },
    },

    MuiButton: {
      styleOverrides: {
        root: { borderRadius: 12, padding: "8px 20px", fontWeight: 600 },
        containedPrimary: {
          boxShadow: "0 4px 14px 0 rgb(43 124 238 / 0.25)",
          "&:hover": { boxShadow: "0 6px 20px 0 rgb(43 124 238 / 0.35)" },
        },
      },
    },

    MuiTextField: {
      defaultProps: { variant: "outlined", size: "small" },
      styleOverrides: {
        root: {
          "& .MuiOutlinedInput-root": {
            borderRadius: 10,
            backgroundColor: "#ffffff",
            "& fieldset": { borderColor: "#e2e8f0" },
            "&:hover fieldset": { borderColor: "#cbd5e1" },
          },
        },
      },
    },

    MuiChip: {
      styleOverrides: {
        root: { borderRadius: 20, fontWeight: 500, fontSize: "0.75rem" }, // Pill
      },
    },

    MuiPaper: {
      styleOverrides: { root: { backgroundImage: "none" } },
    },

    MuiTooltip: {
      styleOverrides: { tooltip: { borderRadius: 8, fontSize: "0.75rem" } },
    },

    MuiLinearProgress: {
      styleOverrides: {
        root: { borderRadius: 4, backgroundColor: "#f1f5f9" }, // recessed
        bar:  { borderRadius: 4 },
      },
    },

    MuiListItemButton: {
      styleOverrides: {
        root: { borderRadius: 8, "&.Mui-selected": { fontWeight: 600 } },
      },
    },
  },
});
