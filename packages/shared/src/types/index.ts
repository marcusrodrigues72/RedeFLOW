// ─── Auth ─────────────────────────────────────────────────────────────────────

export type PapelGlobal = "ADMIN" | "COLABORADOR" | "LEITOR";
export type PapelEtapa  =
  | "COORDENADOR_PRODUCAO"
  | "CONTEUDISTA" | "DESIGNER_INSTRUCIONAL" | "PROFESSOR_ATOR"
  | "PROFESSOR_TECNICO" | "ACESSIBILIDADE" | "EDITOR_VIDEO" | "DESIGNER_GRAFICO"
  | "PRODUTOR_FINAL" | "VALIDADOR_FINAL";
export type TipoOA = "VIDEO" | "SLIDE" | "QUIZ" | "EBOOK" | "PLANO_AULA" | "TAREFA" | "INFOGRAFICO" | "TIMELINE" | "ANIMACAO";
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
  digestDiarioAtivo?: boolean;
  capacidadeHorasSemanais?: number;
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
  progressoPct: number;
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
  id:           string;
  numero:       number;
  nome:         string;
  chSincrona:   string | null;
  chAssincrona: string | null;
  chAtividades: string | null;
  capitulos: {
    id:           string;
    numero:       number;
    nome:         string;
    chSincrona:   string | null;
    chAssincrona: string | null;
    chAtividades: string | null;
    _count: { oas: number; comentarios: number };
    objetivos: ObjetivoResumo[];
  }[];
}

export interface ConfigAlertaCurso {
  id:                   string;
  cursoId:              string;
  diasAntecedencia:     number;
  alertDeadlineVencido: boolean;
  alertPrazoProximo:    boolean;
  alertEtapaLiberada:   boolean;
  alertMencao:          boolean;
  updatedAt:            string;
}

export interface CursoDetalhe extends Omit<CursoResumo, "_count"> {
  unidades: UnidadeResumo[];
  membros: {
    usuarioId:       string;
    papel:           PapelGlobal;
    papeisProducao:  string[];
    notifEmailAtivo: boolean;
    notifInAppAtivo: boolean;
    usuario:         UsuarioPublico;
  }[];
  coordenadorProducaoId: string | null;
  coordenadorProducao: { id: string; nome: string; fotoUrl: string | null } | null;
  matrizValidadaEm: string | null;
  matrizValidadaPorId: string | null;
  matrizValidadaPor: { id: string; nome: string } | null;
  configAlerta: ConfigAlertaCurso | null;
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
  oasBloqueados: number;
  emProducao: number;
}

export interface ProximaEntrega {
  etapaId: string;
  oaId: string;
  oaCodigo: string;
  etapaNome: string;
  responsavelNome: string | null;
  responsavelFotoUrl: string | null;
  deadlinePrevisto: string;
  diasRestantes: number;
  cursoId: string;
  cursoNome: string;
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
  templateGerado: boolean;
  templateOrganizado: boolean;
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
        coordenadorProducaoId: string | null;
        coordenadorProducao: { id: string; nome: string; fotoUrl: string | null } | null;
        matrizValidadaEm: string | null;
        matrizValidadaPorId: string | null;
      };
    };
  };
  etapas: EtapaOADetalhe[];
}

export interface CHResponsavelItem {
  usuarioId:     string;
  nome:          string;
  email:         string;
  fotoUrl:       string | null;
  totalOAs:      number;
  chSincHoras:   number;
  chAssincHoras: number;
  chTotalHoras:  number;
}

export interface MeuTrabalhoResponse {
  items: OADetalhe[];
  stats: { concluidosEstaSemana: number };
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
  id:                      string;
  nome:                    string;
  email:                   string;
  papelGlobal:             PapelGlobal;
  ativo:                   boolean;
  fotoUrl:                 string | null;
  createdAt:               string;
  capacidadeHorasSemanais: number;
}

// ─── Dashboard Detalhe ────────────────────────────────────────────────────────

export type DashboardDetalheTipo = "em_producao" | "concluidos" | "atrasos" | "cursos" | "bloqueados";

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

// ─── Desvio de Deadline ───────────────────────────────────────────────────────

export interface DesvioDeadlineItem {
  oaId:             string;
  oaCodigo:         string;
  etapa:            string;
  responsavel:      string | null;
  deadlinePrevisto: string;
  deadlineReal:     string;
  desvioDias:       number;
}

export interface DesvioDeadlineResumo {
  etapa:       string;
  total:       number;
  noPrazo:     number;
  adiantado:   number;
  atrasado:    number;
  desvioMedio: number;
}

export interface RelatorioDesvio {
  items:  DesvioDeadlineItem[];
  resumo: DesvioDeadlineResumo[];
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

// ─── MI Histórico (RF-M2-05) ──────────────────────────────────────────────────

export interface MIAlteracao {
  tipo:      string; // CAPITULO_ADICIONADO | CAPITULO_REMOVIDO | CAPITULO_MODIFICADO
  descricao: string; // ex: "U1C3: chAssincrona 20h → 25h, 1 OA adicionado"
}

export interface MIHistoricoResumo {
  id:          string;
  resumo:      string | null;
  alteracoes:  MIAlteracao[] | null;
  createdAt:   string;
  importadoPor: { id: string; nome: string; fotoUrl: string | null };
}

export interface MIHistoricoDetalhe extends MIHistoricoResumo {
  snapshot: unknown; // MICapitulo[] serializado
}

// ─── Comentário MI (RF-M2-06) ─────────────────────────────────────────────────

export interface ComentarioMI {
  id:        string;
  texto:     string;
  editado:   boolean;
  createdAt: string;
  mencoes:   string[];
  parentId:  string | null;
  autor:     { id: string; nome: string; fotoUrl: string | null };
  respostas?: ComentarioMI[];
}

// ─── Import ───────────────────────────────────────────────────────────────────

export interface ImportPreview {
  totalOAs: number;
  unidades: { numero: number; totalOAs: number }[];
  amostra: { codigo: string; tipo: string; progressoPct: number; unidade: number; capitulo: number }[];
  avisos: string[];
  responsaveisNaoEncontrados: string[];
}

export interface NovoUsuarioCriado {
  nomeNaPlanilha:  string;
  nome:            string;
  email:           string;
  senhaTemporaria: string;
}

export interface ImportResult {
  message:             string;
  criados:             number;
  atualizados:         number;
  ignorados:           number;
  avisos:              string[];
  novosUsuariosCriados: NovoUsuarioCriado[];
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
  avisos?: string[];
}

// ─── Sugestão de Alocação ─────────────────────────────────────────────────────

export interface MembroCapacidade {
  usuarioId:            string;
  nome:                 string;
  email:                string;
  fotoUrl:              string | null;
  papeisProducao:       string[];
  capacidade:           number;   // horas/semana disponíveis globalmente
  horasCompromissadas:  number;   // já alocadas em todos os cursos ativos
  horasDisponiveis:     number;
  percentualOcupado:    number;
  etapasPendentesTotal: number;
}

export interface PapelCandidatos {
  papel:      string;
  candidatos: MembroCapacidade[];
}

export interface SugestaoItem {
  papel:             string;
  responsavelId:     string;
  responsavelNome:   string;
  percentualOcupado: number;
}

export interface SugestaoAlocacao {
  membros:           MembroCapacidade[];
  porPapel:          PapelCandidatos[];
  sugestao:          SugestaoItem[];
  oasPendentesSetup: number;
}

export interface AplicarSugestaoResult {
  totalAtualizado: number;
  message:         string;
}

// ─── Burndown ─────────────────────────────────────────────────────────────────

export interface BurndownPonto {
  data:       string;   // "YYYY-MM-DD"
  planejado:  number;   // OAs restantes no ideal
  realizado:  number | null; // OAs restantes real (null = data futura)
}

export interface RelatorioBurndown {
  cursoId:    string;
  cursoNome:  string;
  dataInicio: string;
  dataFim:    string;
  totalOAs:   number;
  series:     BurndownPonto[];
}

// ─── Progresso por Unidade ────────────────────────────────────────────────────

export interface RelatorioCapituloProgresso {
  numero:      number;
  nome:        string;
  totalOAs:    number;
  concluidos:  number;
  atrasados:   number;
  progressoPct: number;
}

export interface RelatorioUnidadeProgresso {
  numero:      number;
  nome:        string;
  totalOAs:    number;
  concluidos:  number;
  atrasados:   number;
  progressoPct: number;
  capitulos:   RelatorioCapituloProgresso[];
}

export type RelatorioProgressoUnidades = RelatorioUnidadeProgresso[];

// ─── Pipeline Admin ───────────────────────────────────────────────────────────

export interface EtapaDefinicaoAdmin {
  id:           string;
  nome:         string;
  tipoOA:       TipoOA | null;
  papel:        string;
  ordem:        number;
  obrigatorio:  boolean;
  ativo:        boolean;
  temArtefato:  boolean;
  esforcoHoras: number;
  createdAt:    string;
}

export interface CalcularDeadlinesResult {
  totalAtualizadas: number;
  avisos:           string[];
}
