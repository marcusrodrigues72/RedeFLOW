import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import {
  Box, Typography, Grid2 as Grid, Card, CardContent, CardActionArea,
  Button, TextField, InputAdornment, Chip, LinearProgress, Avatar,
  AvatarGroup, Skeleton, Dialog, DialogTitle, DialogContent,
  DialogActions, Tooltip, Alert, IconButton,
} from "@mui/material";
import AddIcon          from "@mui/icons-material/Add";
import SearchIcon       from "@mui/icons-material/Search";
import FileUploadIcon   from "@mui/icons-material/FileUpload";
import SchoolIcon       from "@mui/icons-material/School";
import ContentCopyIcon  from "@mui/icons-material/ContentCopy";
import { useState }     from "react";
import { useCursos, useCriarCurso, useDuplicarCurso } from "@/lib/api/cursos";
import { useAuthStore } from "@/stores/auth.store";
import type { CursoResumo, StatusCurso } from "shared";

export const Route = createFileRoute("/_authed/cursos/")({
  component: CursosPage,
});

const STATUS_LABELS: Record<StatusCurso, { label: string; color: string; bg: string }> = {
  ATIVO:     { label: "Ativo",     color: "#10b981", bg: "#f0fdf4" },
  RASCUNHO:  { label: "Rascunho",  color: "#64748b", bg: "#f8fafc" },
  ARQUIVADO: { label: "Arquivado", color: "#94a3b8", bg: "#f1f5f9" },
};

function CursosPage() {
  const { data: cursos = [], isLoading } = useCursos();
  const navigate                         = useNavigate();
  const user                             = useAuthStore((s) => s.user);
  const isAdmin                          = user?.papelGlobal === "ADMIN";

  const [search,          setSearch]          = useState("");
  const [filtroStatus,    setFiltroStatus]    = useState<StatusCurso | "TODOS">("TODOS");
  const [abrirNovo,       setAbrirNovo]       = useState(false);
  const [cursoDuplicar,   setCursoDuplicar]   = useState<CursoResumo | null>(null);

  const cursosFiltrados = cursos.filter((c) => {
    const matchSearch = c.nome.toLowerCase().includes(search.toLowerCase())
      || c.codigo.toLowerCase().includes(search.toLowerCase());
    const matchStatus = filtroStatus === "TODOS" || c.status === filtroStatus;
    return matchSearch && matchStatus;
  });

  return (
    <Box>
      {/* ── Header ──────────────────────────────────────────────────────────── */}
      <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", mb: 3 }}>
        <Box>
          <Typography sx={{ fontSize: "1.5rem", fontWeight: 800, color: "text.primary" }}>
            Gestão de Cursos
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 0.25 }}>
            {cursos.length} curso{cursos.length !== 1 ? "s" : ""} cadastrado{cursos.length !== 1 ? "s" : ""}
          </Typography>
        </Box>
        <Box sx={{ display: "flex", gap: 1.5 }}>
          <Button
            component={Link} to="/cursos/importar"
            variant="outlined" startIcon={<FileUploadIcon />} sx={{ fontWeight: 600 }}
          >
            Importar Planilha
          </Button>
          <Button
            variant="contained" startIcon={<AddIcon />}
            onClick={() => setAbrirNovo(true)} sx={{ fontWeight: 700 }}
          >
            Novo Curso
          </Button>
        </Box>
      </Box>

      {/* ── Filtros ─────────────────────────────────────────────────────────── */}
      <Box sx={{ display: "flex", gap: 2, mb: 3, alignItems: "center", flexWrap: "wrap" }}>
        <TextField
          placeholder="Buscar curso..."
          size="small"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          sx={{ minWidth: 260 }}
          slotProps={{
            input: {
              startAdornment: (
                <InputAdornment position="start">
                  <SearchIcon sx={{ fontSize: 18, color: "text.disabled" }} />
                </InputAdornment>
              ),
            },
          }}
        />
        {(["TODOS", "ATIVO", "RASCUNHO", "ARQUIVADO"] as const).map((s) => (
          <Chip
            key={s}
            label={s === "TODOS" ? "Todos" : STATUS_LABELS[s as StatusCurso].label}
            onClick={() => setFiltroStatus(s)}
            variant={filtroStatus === s ? "filled" : "outlined"}
            sx={{
              fontWeight: 600,
              bgcolor: filtroStatus === s ? "primary.main" : "transparent",
              color: filtroStatus === s ? "white" : "text.secondary",
              borderColor: filtroStatus === s ? "primary.main" : "divider",
              "&:hover": { bgcolor: filtroStatus === s ? "primary.dark" : "action.hover" },
            }}
          />
        ))}
      </Box>

      {/* ── Grid de Cards ────────────────────────────────────────────────────── */}
      {isLoading ? (
        <Grid container spacing={2.5}>
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <Grid key={i} size={{ xs: 12, sm: 6, md: 4 }}>
              <Skeleton height={200} sx={{ borderRadius: 2 }} />
            </Grid>
          ))}
        </Grid>
      ) : cursosFiltrados.length === 0 ? (
        <EmptyState onImportar={() => navigate({ to: "/cursos/importar" })} onNovo={() => setAbrirNovo(true)} />
      ) : (
        <Grid container spacing={2.5}>
          {cursosFiltrados.map((curso) => (
            <Grid key={curso.id} size={{ xs: 12, sm: 6, md: 4 }}>
              <CursoCard
                curso={curso}
                isAdmin={isAdmin}
                onDuplicar={() => setCursoDuplicar(curso)}
              />
            </Grid>
          ))}
        </Grid>
      )}

      {/* ── Dialogs ─────────────────────────────────────────────────────────── */}
      <NovoCursoDialog
        open={abrirNovo}
        onClose={() => setAbrirNovo(false)}
        onSuccess={(id) => navigate({ to: `/cursos/${id}` })}
      />
      <DuplicarCursoDialog
        curso={cursoDuplicar}
        onClose={() => setCursoDuplicar(null)}
        onSuccess={(id) => { setCursoDuplicar(null); navigate({ to: `/cursos/${id}` }); }}
      />
    </Box>
  );
}

// ─── Curso Card ───────────────────────────────────────────────────────────────
function CursoCard({ curso, isAdmin, onDuplicar }: { curso: CursoResumo; isAdmin: boolean; onDuplicar: () => void }) {
  const s = STATUS_LABELS[curso.status] ?? STATUS_LABELS.RASCUNHO;

  return (
    <Card sx={{ height: "100%", "&:hover": { boxShadow: "0 4px 20px 0 rgb(0 0 0 / 0.08)" }, transition: "box-shadow 0.2s", position: "relative" }}>
      {isAdmin && (
        <Tooltip title="Duplicar curso">
          <IconButton
            size="small"
            onClick={(e) => { e.stopPropagation(); onDuplicar(); }}
            sx={{
              position: "absolute", top: 8, right: 8, zIndex: 2,
              color: "text.disabled", bgcolor: "background.paper",
              "&:hover": { color: "primary.main", bgcolor: "#eff6ff" },
              boxShadow: "0 1px 3px rgba(0,0,0,0.1)",
            }}
          >
            <ContentCopyIcon sx={{ fontSize: 16 }} />
          </IconButton>
        </Tooltip>
      )}
      <CardActionArea component={Link} to={`/cursos/${curso.id}`} sx={{ height: "100%", display: "flex", flexDirection: "column", alignItems: "stretch", p: 0 }}>
        <CardContent sx={{ p: 3, flex: 1, display: "flex", flexDirection: "column" }}>
          {/* Top row */}
          <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", mb: 2 }}>
            <Box sx={{ bgcolor: "#eff6ff", p: 1, borderRadius: 1.5, display: "flex" }}>
              <SchoolIcon sx={{ color: "primary.main", fontSize: 20 }} />
            </Box>
            <Chip label={s.label} size="small" sx={{ bgcolor: s.bg, color: s.color, fontWeight: 600, fontSize: "0.7rem" }} />
          </Box>

          {/* Nome e código */}
          <Typography fontWeight={700} sx={{ fontSize: "0.9375rem", lineHeight: 1.3, mb: 0.5, flex: 1 }}>
            {curso.nome}
          </Typography>
          <Typography variant="caption" color="text.disabled" sx={{ mb: 2, fontFamily: "monospace" }}>
            {curso.codigo}
          </Typography>

          {/* Progresso */}
          <Box sx={{ mb: 2 }}>
            <Box sx={{ display: "flex", justifyContent: "space-between", mb: 0.5 }}>
              <Typography variant="caption" color="text.secondary">Progresso</Typography>
              <Typography variant="caption" fontWeight={600}>{curso.progressoPct}%</Typography>
            </Box>
            <LinearProgress
              variant="determinate"
              value={curso.progressoPct}
              sx={{
                height: 5,
                "& .MuiLinearProgress-bar": {
                  bgcolor: curso.progressoPct >= 80 ? "#10b981" : curso.progressoPct >= 40 ? "#f59e0b" : "primary.main",
                },
              }}
            />
          </Box>

          {/* Meta */}
          <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <Typography variant="caption" color="text.secondary">
              {curso._count.unidades} unidade{curso._count.unidades !== 1 ? "s" : ""}
            </Typography>
            {curso.membros.length > 0 && (
              <Tooltip title={`${curso.membros.length} membro(s)`}>
                <AvatarGroup max={3} sx={{ "& .MuiAvatar-root": { width: 24, height: 24, fontSize: "0.65rem", border: "1.5px solid white" } }}>
                  {curso.membros.map((m) => (
                    <Avatar key={m.usuarioId} sx={{ bgcolor: "primary.light" }} />
                  ))}
                </AvatarGroup>
              </Tooltip>
            )}
          </Box>
        </CardContent>
      </CardActionArea>
    </Card>
  );
}

// ─── Dialog Duplicar Curso ────────────────────────────────────────────────────
function DuplicarCursoDialog({ curso, onClose, onSuccess }: {
  curso: CursoResumo | null;
  onClose: () => void;
  onSuccess: (id: string) => void;
}) {
  const { mutate, isPending } = useDuplicarCurso();
  const [codigo, setCodigo]   = useState("");
  const [nome,   setNome]     = useState("");
  const [erro,   setErro]     = useState<string | null>(null);

  const handleOpen = () => {
    if (curso) {
      setCodigo(`${curso.codigo}-v2`);
      setNome(`${curso.nome} (Cópia)`);
      setErro(null);
    }
  };

  return (
    <Dialog
      open={!!curso}
      onClose={onClose}
      TransitionProps={{ onEnter: handleOpen }}
      maxWidth="sm"
      fullWidth
      PaperProps={{ sx: { borderRadius: 3 } }}
    >
      <DialogTitle sx={{ fontWeight: 700 }}>
        Duplicar Curso
      </DialogTitle>
      <DialogContent sx={{ pt: "12px !important" }}>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2.5 }}>
          Cria uma cópia da estrutura do curso <strong>{curso?.nome}</strong> — unidades, capítulos, OAs e pipeline — sem dados de produção (responsáveis, deadlines e links zerados).
        </Typography>
        {erro && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setErro(null)}>{erro}</Alert>}
        <TextField
          fullWidth label="Código do novo curso" placeholder="ex: MICRO-GERAL-01-v2"
          value={codigo} onChange={(e) => setCodigo(e.target.value)}
          sx={{ mb: 2 }}
        />
        <TextField
          fullWidth label="Nome do novo curso"
          value={nome} onChange={(e) => setNome(e.target.value)}
        />
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 3 }}>
        <Button onClick={onClose} disabled={isPending}>Cancelar</Button>
        <Button
          variant="contained"
          startIcon={<ContentCopyIcon />}
          disabled={isPending || !codigo.trim() || !nome.trim()}
          onClick={() => {
            if (!curso) return;
            setErro(null);
            mutate(
              { cursoId: curso.id, nome: nome.trim(), codigo: codigo.trim() },
              {
                onSuccess: (novo) => onSuccess(novo.id),
                onError: (err: unknown) => {
                  const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
                  setErro(msg ?? "Erro ao duplicar curso.");
                },
              }
            );
          }}
          sx={{ fontWeight: 700 }}
        >
          {isPending ? "Duplicando…" : "Duplicar Curso"}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

// ─── Empty State ──────────────────────────────────────────────────────────────
function EmptyState({ onImportar, onNovo }: { onImportar: () => void; onNovo: () => void }) {
  return (
    <Box sx={{ textAlign: "center", py: 8 }}>
      <Box sx={{ bgcolor: "#eff6ff", width: 72, height: 72, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", mx: "auto", mb: 2 }}>
        <SchoolIcon sx={{ color: "primary.main", fontSize: 36 }} />
      </Box>
      <Typography variant="h4" sx={{ mb: 1 }}>Nenhum curso encontrado</Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 3, maxWidth: 360, mx: "auto" }}>
        Importe as planilhas do iRede para começar a gerenciar a produção de conteúdo.
      </Typography>
      <Box sx={{ display: "flex", gap: 2, justifyContent: "center" }}>
        <Button variant="contained" startIcon={<FileUploadIcon />} onClick={onImportar} sx={{ fontWeight: 700 }}>
          Importar Planilha
        </Button>
        <Button variant="outlined" startIcon={<AddIcon />} onClick={onNovo}>
          Criar manualmente
        </Button>
      </Box>
    </Box>
  );
}

// ─── Dialog Novo Curso ────────────────────────────────────────────────────────
function NovoCursoDialog({ open, onClose, onSuccess }: { open: boolean; onClose: () => void; onSuccess: (id: string) => void }) {
  const { mutate, isPending } = useCriarCurso();
  const [codigo, setCodigo]   = useState("");
  const [nome, setNome]       = useState("");
  const [erros, setErros]     = useState<Record<string, string>>({});

  const handleSalvar = () => {
    const e: Record<string, string> = {};
    if (!codigo.trim()) e["codigo"] = "Código obrigatório.";
    if (!nome.trim())   e["nome"]   = "Nome obrigatório.";
    if (Object.keys(e).length) { setErros(e); return; }

    mutate(
      { codigo: codigo.trim(), nome: nome.trim() },
      {
        onSuccess: (curso) => { onClose(); onSuccess(curso.id); },
        onError:   () => setErros({ geral: "Erro ao criar curso." }),
      }
    );
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth PaperProps={{ sx: { borderRadius: 3 } }}>
      <DialogTitle sx={{ fontWeight: 700 }}>Novo Curso</DialogTitle>
      <DialogContent sx={{ pt: "12px !important" }}>
        <TextField
          fullWidth label="Código" placeholder="ex: MICRO-GERAL-01"
          value={codigo} onChange={(e) => setCodigo(e.target.value)}
          error={!!erros["codigo"]} helperText={erros["codigo"]}
          sx={{ mb: 2 }}
        />
        <TextField
          fullWidth label="Nome do Curso"
          value={nome} onChange={(e) => setNome(e.target.value)}
          error={!!erros["nome"]} helperText={erros["nome"] ?? erros["geral"]}
        />
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 3 }}>
        <Button onClick={onClose} disabled={isPending}>Cancelar</Button>
        <Button variant="contained" onClick={handleSalvar} disabled={isPending} sx={{ fontWeight: 700 }}>
          {isPending ? "Criando…" : "Criar Curso"}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
