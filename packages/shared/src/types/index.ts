// ─── Auth ─────────────────────────────────────────────────────────────────────

export type PapelGlobal = "ADMIN" | "COLABORADOR" | "LEITOR";
export type PapelEtapa  =
  | "CONTEUDISTA" | "DESIGNER_INSTRUCIONAL" | "PROFESSOR_ATOR"
  | "PROFESSOR_TECNICO" | "ACESSIBILIDADE" | "EDITOR_VIDEO" | "DESIGNER_GRAFICO"
  | "PRODUTOR_FINAL" | "VALIDADOR_FINAL";
export type TipoOA = "VIDEO" | "SLIDE" | "QUIZ" | "EBOOK" | "PLANO_AULA" | "TAREFA" | "INFOGRAFICO" | "TIMELINE";
export type StatusOA = "PENDENTE" | "EM_ANDAMENTO" | "BLOQUEADO" | "CONCLUIDO";
export type StatusEtapa = "PENDENTE" | "EM_ANDAMENTO" | "CONCLUIDA" | "BLOQUEADA";
export type StatusCurso = "RASCUNHO" | "ATIVO" | "ARQUIVADO";

export interface UsuarioPublico {
  id: string;
  nome: string;
  email: string;
  papelGlobal: PapelGlobal;
  fotoUrl: string | null;
  notifEmailAtivo?: boolean;
}

export interface AuthTokens { accessToken: string; refreshToken: string }
export interface AuthResponse { user: UsuarioPublico; accessToken: string; refreshToken: string }

// ─── Curso ────────────────────────────────────────────────────────────────────

export interface CursoResumo {
  id: string;
  codigo: string;
  nome: string;
  descricao: string | null;
  status: StatusCurso;
  chTotalPlanejada: number;
  dataInicio: string | null;
  dataFim: string | null;
  createdAt: string;
  _count: { unidades: number };
  membros: { usuarioId: string; papel: PapelGlobal }[];
}

export interface ObjetivoResumo {
  id: string;
  numero: number;
  descricao: string;
  nivelBloom: string | null;
}

export interface UnidadeResumo {
  id: string;
  numero: number;
  nome: string;
  capitulos: {
    id: string;
    numero: number;
    nome: string;
    chAssincrona: string | null;
    chSincrona: string | null;
    _count: { oas: number };
    objetivos: ObjetivoResumo[];
  }[];
}

export interface CursoDetalhe extends Omit<CursoResumo, "_count"> {
  unidades: UnidadeResumo[];
  membros: {
    usuarioId: string;
    papel: PapelGlobal;
    usuario: UsuarioPublico;
  }[];
}

// ─── OA ───────────────────────────────────────────────────────────────────────

export interface OAResumo {
  id: string;
  codigo: string;
  tipo: TipoOA;
  titulo: string | null;
  status: StatusOA;
  progressoPct: number;
  deadlineFinal: string | null;
  capitulo: {
    numero: number;
    nome: string;
    unidade: { numero: number; nome: string };
  };
  etapas: {
    id: string;
    status: StatusEtapa;
    ordem: number;
    deadlinePrevisto: string | null;
    bloqueada: boolean;
    responsavel: UsuarioPublico | null;
    etapaDef: { nome: string; papel: string };
  }[];
}

// ─── Dashboard ────────────────────────────────────────────────────────────────

export interface DashboardStats {
  totalCursos: number;
  cursosAtivos: number;
  totalOAs: number;
  oasConcluidos: number;
  progressoPct: number;
  oasAtrasados: number;
  emProducao: number;
}

// ─── OA Detalhe ───────────────────────────────────────────────────────────────

export interface EtapaOADetalhe {
  id: string;
  ordem: number;
  status: StatusEtapa;
  deadlinePrevisto: string | null;
  deadlineReal: string | null;
  bloqueada: boolean;
  linkArtefato: string | null;
  responsavel: UsuarioPublico | null;
  responsavelId: string | null;
  responsavelSecundario: UsuarioPublico | null;
  responsavelSecundarioId: string | null;
  etapaDef: { id: string; nome: string; papel: string; temArtefato: boolean };
}

export interface OADetalhe {
  id: string;
  codigo: string;
  tipo: TipoOA;
  numero: number;
  titulo: string | null;
  status: StatusOA;
  progressoPct: number;
  linkObjeto: string | null;
  linkObjetoFinal: string | null;
  deadlineFinal: string | null;
  capitulo: {
    id: string;
    numero: number;
    nome: string;
    unidade: {
      id: string;
      numero: number;
      nome: string;
      curso: {
        id: string;
        nome: string;
        codigo: string;
        membros: { usuarioId: string; papel: PapelGlobal; usuario: UsuarioPublico }[];
      };
    };
  };
  etapas: EtapaOADetalhe[];
}

// ─── Comentário ───────────────────────────────────────────────────────────────

export interface ComentarioOA {
  id:        string;
  texto:     string;
  oaId:      string | null;
  etapaOaId: string | null;
  editado:   boolean;
  createdAt: string;
  autor: { id: string; nome: string; fotoUrl: string | null };
}

// ─── Relatórios ───────────────────────────────────────────────────────────────

export interface RelatorioCurso {
  id: string;
  nome: string;
  codigo: string;
  status: StatusCurso;
  totalOAs: number;
  oasConcluidos: number;
  oasAtrasados: number;
  progressoPct: number;
  dataInicioEstimada: string | null;
  dataFimEstimada: string | null;
}

export interface RelatorioPipelineStatus {
  porStatusOA: { status: StatusOA;    total: number }[];
  porEtapa:    {
    etapa:        string;
    papel:        string;
    ordem:        number;
    pendente:     number;
    emAndamento:  number;
    concluida:    number;
    bloqueada:    number;
    total:        number;
  }[];
}

export interface RelatorioAtrasoResponsavel {
  nome:    string;
  email:   string;
  total:   number;
  detalhes: { oa: string; etapa: string; diasAtraso: number }[];
}

// ─── Notificação ──────────────────────────────────────────────────────────────

export interface Notificacao {
  id:           string;
  tipo:         string;
  titulo:       string;
  corpo:        string | null;
  lida:         boolean;
  entidadeTipo: string | null;
  entidadeId:   string | null;
  createdAt:    string;
}

// ─── Usuário Admin ────────────────────────────────────────────────────────────

export interface UsuarioAdmin {
  id:          string;
  nome:        string;
  email:       string;
  papelGlobal: PapelGlobal;
  ativo:       boolean;
  fotoUrl:     string | null;
  createdAt:   string;
}

// ─── Dashboard Detalhe ────────────────────────────────────────────────────────

export type DashboardDetalheTipo = "em_producao" | "concluidos" | "atrasos" | "cursos";

export interface DashboardDetalheOA {
  id: string;
  codigo: string;
  tipo: TipoOA;
  status: StatusOA;
  progressoPct: number;
  deadlineFinal: string | null;
  curso: { id: string; nome: string; codigo: string };
  unidade: { nome: string };
  capitulo: { nome: string };
  etapaAtual: { nome: string; responsavel: string | null; deadlinePrevisto: string | null } | null;
}

export interface DashboardDetalheAtraso {
  oaId: string;
  oaCodigo: string;
  etapa: string;
  responsavel: string | null;
  diasAtraso: number;
  deadlinePrevisto: string;
  curso: { id: string; nome: string };
  unidade: { nome: string };
  capitulo: { nome: string };
}

// ─── Alocação ─────────────────────────────────────────────────────────────────

export interface EtapaAlocacao {
  etapaId:          string;
  oaId:             string;
  oaCodigo:         string;
  etapaNome:        string;
  papel:            string;
  deadlinePrevisto: string | null;
  deadlineInicio:   string | null;   // deadline da etapa anterior (estimativa de início)
  status:           StatusEtapa;
  cursoCodigo:      string;
}

export interface ResponsavelAlocacao {
  usuarioId:   string;
  nome:        string;
  email:       string;
  fotoUrl:     string | null;
  emAndamento: number;
  pendente:    number;
  etapas:      EtapaAlocacao[];
}

export interface RelatorioAlocacao {
  porPapel:        { papel: string; label: string; emAndamento: number; pendente: number }[];
  porResponsavel:  ResponsavelAlocacao[];
}

// ─── Audit Log ────────────────────────────────────────────────────────────────

export interface AuditLogEntry {
  id:           string;
  acao:         string;
  entidadeTipo: string;
  entidadeId:   string;
  payloadAntes:  Record<string, unknown> | null;
  payloadDepois: Record<string, unknown> | null;
  ip:           string | null;
  createdAt:    string;
  usuario:      { id: string; nome: string; fotoUrl: string | null } | null;
}

// ─── Import ───────────────────────────────────────────────────────────────────

export interface ImportPreview {
  totalOAs: number;
  unidades: { numero: number; totalOAs: number }[];
  amostra: { codigo: string; tipo: string; progressoPct: number; unidade: number; capitulo: number }[];
  avisos: string[];
}

export interface ImportResult {
  message: string;
  criados: number;
  ignorados: number;
}

export interface MIPreview {
  totalCapitulos: number;
  totalObjetivos: number;
  totalOAs: number;
  unidades: { numero: number; nome: string; totalCapitulos: number }[];
  amostra: {
    unidade: number;
    numero: number;
    nome: string;
    chAssincrona: number;
    objetivos: { numero: number; descricao: string; nivelBloom: string }[];
    oaDefs: { oeNumero: number; tipo: string; quantidade: number }[];
  }[];
  avisos: string[];
}

export interface AtribuicaoPreview  { totalEtapas: number }
export interface AtribuicaoResult   { totalAtualizado: number }

export interface MIResult {
  message: string;
  cursoId: string;
  capitulosAtualizados: number;
  objetivosCriados: number;
  oasCriados: number;
  oasIgnorados: number;
}
