import * as XLSX from "xlsx";
import { prisma } from "../lib/prisma.js";
import { logger } from "../lib/logger.js";

// ─── Mapeamentos ──────────────────────────────────────────────────────────────

const TIPO_MAP: Record<string, string> = {
  // Vídeo
  "roteiro de vídeo": "VIDEO", "roteiro de video": "VIDEO",
  "vídeo": "VIDEO", "video": "VIDEO",
  "videoaula": "VIDEO", "podcast": "VIDEO",
  // Slide
  "slide": "SLIDE", "slides": "SLIDE",
  "apresentação": "SLIDE", "apresentacao": "SLIDE",
  // Quiz
  "quiz": "QUIZ",
  "questionário": "QUIZ", "questionario": "QUIZ",
  "avaliação": "QUIZ", "avaliacao": "QUIZ", "prova": "QUIZ",
  // E-book
  "ebook": "EBOOK", "e-book": "EBOOK", "e book": "EBOOK",
  "livro": "EBOOK", "apostila": "EBOOK",
  // Plano de Aula
  "plano de aula": "PLANO_AULA", "plano aula": "PLANO_AULA",
  // Tarefa (atividades interativas)
  "tarefa": "TAREFA",
  "fórum": "TAREFA", "forum": "TAREFA",
  "fórum de apresentação": "TAREFA", "forum de apresentacao": "TAREFA",
  "atividade": "TAREFA", "atividade interativa": "TAREFA",
  "discussão": "TAREFA", "discussao": "TAREFA",
  "projeto": "TAREFA", "seminário": "TAREFA", "seminario": "TAREFA",
};

const STATUS_ETAPA_MAP: Record<string, string> = {
  "concluído":               "CONCLUIDA",
  "concluido":               "CONCLUIDA",
  "concluído com atraso":    "CONCLUIDA",
  "concluido com atraso":    "CONCLUIDA",
  "em andamento":            "EM_ANDAMENTO",
  "atrasado":                "EM_ANDAMENTO",
  "pendente":                "PENDENTE",
  "":                        "PENDENTE",
};

function mapTipo(raw: string): string {
  return TIPO_MAP[raw.trim().toLowerCase()] ?? "SLIDE";
}

function mapStatusEtapa(raw: string): string {
  return STATUS_ETAPA_MAP[raw.trim().toLowerCase()] ?? "PENDENTE";
}

function parseDate(raw: string): Date | null {
  const s = raw?.trim();
  if (!s) return null;

  // YYYY-MM-DD (ISO — formato padrão do xlsx quando a célula está formatada assim)
  const iso = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (iso) {
    const dt = new Date(+iso[1]!, +iso[2]! - 1, +iso[3]!);
    return isNaN(dt.getTime()) ? null : dt;
  }

  // DD/MM/YYYY
  const dmy = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  if (dmy) {
    const dt = new Date(+dmy[3]!, +dmy[2]! - 1, +dmy[1]!);
    return isNaN(dt.getTime()) ? null : dt;
  }

  // MM/DD/YY (locale US do Excel)
  const mdy = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2})$/);
  if (mdy) {
    const y = +mdy[3]!;
    const dt = new Date(y < 50 ? 2000 + y : 1900 + y, +mdy[1]! - 1, +mdy[2]!);
    return isNaN(dt.getTime()) ? null : dt;
  }

  return null;
}

// ─── Tipos ────────────────────────────────────────────────────────────────────

export interface MCRow {
  unidade: number;
  capitulo: number;
  codigo: string;
  tipo: string;
  progressoPct: number;
  linkObjeto: string;
  // etapas
  conteudistaNome: string;
  conteudistaDL: Date | null;
  conteudiostaStatus: string;
  diNome: string;
  diDL: Date | null;
  diStatus: string;
  profAtorNome: string;
  profAtorDL: Date | null;
  profAtorStatus: string;
  profTecNome: string;
  profTecDL: Date | null;
  profTecStatus: string;
  acessNome: string;
  acessDL: Date | null;
  acessStatus: string;
  prodNome: string;
  prodDL: Date | null;
  prodStatus: string;
  linkFinal: string;
  validadorNome: string;
  validDL: Date | null;
  validStatus: string;
}

export interface ImportPreview {
  totalOAs: number;
  unidades: { numero: number; totalOAs: number }[];
  amostra: MCRow[];
  avisos: string[];
  responsaveisNaoEncontrados: string[];
}

/** Retorna todos os nomes únicos de responsáveis presentes nas linhas da MC */
export function extractNomesResponsaveis(rows: MCRow[]): string[] {
  const nomes = new Set<string>();
  for (const row of rows) {
    for (const nome of [
      row.conteudistaNome, row.diNome, row.profAtorNome,
      row.profTecNome, row.acessNome, row.prodNome, row.validadorNome,
    ]) {
      if (nome?.trim()) nomes.add(nome.trim());
    }
  }
  return Array.from(nomes).sort();
}

// ─── Tipos MI ─────────────────────────────────────────────────────────────────

export interface MIOADef {
  oeNumero: number;
  tipo: string;       // VIDEO | SLIDE | QUIZ | etc.
  quantidade: number;
}

export interface MICapitulo {
  unidade: number;
  unidadeNome: string;
  numero: number;
  nome: string;
  conteudoResumo: string;
  chSincrona: number;      // minutos
  chAssincrona: number;    // minutos
  chAtividades: number;    // minutos
  periodoDias: number;
  ferramentas: string;
  atividadeFormativa: string;
  atividadeSomativa: string;
  feedback: string;
  objetivos: {
    numero: number;
    descricao: string;
    nivelBloom: string;
    papeisAtores: string;
  }[];
  oaDefs: MIOADef[];  // OAs a gerar
}

export interface MIPreview {
  totalCapitulos: number;
  totalObjetivos: number;
  totalOAs: number;
  unidades: { numero: number; nome: string; totalCapitulos: number }[];
  amostra: MICapitulo[];
  avisos: string[];
}

export interface MIResult {
  capitulosAtualizados: number;
  objetivosCriados: number;
  oasCriados: number;
  oasIgnorados: number;
}

// ─── Mapeamento dinâmico de colunas ───────────────────────────────────────────

interface ColMap {
  unidade: number; capitulo: number; codigo: number; tipo: number;
  pct: number; linkObjeto: number;
  conteudistaNome: number; conteudistaDL: number; conteudiostaStatus: number;
  diNome: number; diDL: number; diStatus: number;
  profAtorNome: number; profAtorDL: number; profAtorStatus: number;
  profTecNome: number; profTecDL: number; profTecStatus: number;
  acessNome: number; acessDL: number; acessStatus: number;
  prodNome: number; prodDL: number; prodStatus: number;
  linkFinal: number; validadorNome: number; validDL: number; validStatus: number;
}

/** Índices fixos para CSV (mantém compatibilidade) */
const CSV_COL_MAP: ColMap = {
  unidade: 0, capitulo: 1, codigo: 2, tipo: 3, pct: 5, linkObjeto: 6,
  conteudistaNome: 7,  conteudistaDL: 8,   conteudiostaStatus: 9,
  diNome: 10,          diDL: 11,            diStatus: 12,
  profAtorNome: 13,    profAtorDL: 14,      profAtorStatus: 15,
  profTecNome: 16,     profTecDL: 17,       profTecStatus: 18,
  acessNome: 19,       acessDL: 20,         acessStatus: 21,
  prodNome: 22,        prodDL: 23,          prodStatus: 24,
  linkFinal: 25,       validadorNome: 26,   validDL: 27, validStatus: 28,
};

/** Normaliza header: minúsculas, sem acentos, sem emojis/non-ASCII */
function normH(s: string): string {
  return (s ?? "")
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")   // remove acentos
    .replace(/[^\x00-\x7F]/g, " ")                       // remove emojis/non-ASCII
    .toLowerCase()
    .replace(/\s+/g, " ").trim();
}

/**
 * Detecta os índices de cada coluna a partir do cabeçalho real da aba,
 * tornando o parser imune a colunas extras ou reordenações.
 */
function buildColMap(headerRow: string[]): ColMap {
  const h = headerRow.map(normH);

  /** Retorna o índice da primeira célula que passa no padrão, pesquisando a partir de `from+1` */
  const after = (pat: RegExp, from = -1): number => {
    for (let i = from + 1; i < h.length; i++) {
      if (pat.test(h[i]!)) return i;
    }
    return -1;
  };

  // ── Colunas simples ────────────────────────────────────────────────────────
  const unidade    = after(/^unidade$/);
  const capitulo   = after(/capitulo/);
  const codigo     = after(/codigo/);
  const tipo       = after(/^tipo/);
  const pct        = after(/^%$/);
  const linkObjeto = after(/^objeto$/);          // "🔗 Objeto" → normaliza p/ "objeto"
  const linkFinal  = after(/objeto.*final/);     // "🔗Objeto Final" → "objeto final"

  // ── Conteudista ────────────────────────────────────────────────────────────
  const conteudistaNome    = after(/^conteudist/);
  const conteudistaDL      = after(/deadline.*conteudi|conteudi.*deadline/);
  const conteudiostaStatus = after(/status.*conteudi|conteudi.*status/);

  // ── DI (Designer Instrucional) — vem DEPOIS da seção Conteudista ──────────
  const diBase   = Math.max(conteudistaNome, conteudistaDL, conteudiostaStatus);
  const diNome   = after(/^di$/, diBase);
  const diDL     = after(/deadline.*di$|^deadline di$/, diBase);
  const diStatus = after(/status.*di$|^status di$/, diBase);

  // ── Prof. Ator / Gravação ──────────────────────────────────────────────────
  const gravBase       = Math.max(diNome, diDL, diStatus);
  const profAtorNome   = after(/prof.*ator|^ator$/, gravBase);
  const profAtorDL     = after(/deadline.*grav|deadline.*ator/, gravBase);
  const profAtorStatus = after(/status.*grav|status.*ator/, gravBase);

  // ── Revisor Técnico ────────────────────────────────────────────────────────
  const revBase        = Math.max(gravBase, profAtorNome, profAtorDL, profAtorStatus);
  const profTecNome    = after(/revisor/, revBase);
  const profTecDL      = after(/deadline.*revis/, revBase);
  const profTecStatus  = after(/status.*revis/, revBase);

  // ── Acessibilidade ─────────────────────────────────────────────────────────
  const acessBase    = Math.max(revBase, profTecNome, profTecDL, profTecStatus);
  const acessNome    = after(/acess/, acessBase);
  const acessDL      = after(/deadline.*acess/, acessBase);
  const acessStatus  = after(/status.*acess/, acessBase);

  // ── Produtor Final ─────────────────────────────────────────────────────────
  const prodBase     = Math.max(acessBase, acessNome, acessDL, acessStatus);
  const prodNome     = after(/^produtor$/, prodBase);
  const prodDL       = after(/deadline.*prod/, prodBase);
  const prodStatus   = after(/status.*prod/, prodBase);

  // ── Validação Final ────────────────────────────────────────────────────────
  const validBase     = Math.max(prodBase, prodNome, prodDL, prodStatus);
  const validadorNome = after(/valid/, validBase);
  const validDL       = after(/deadline.*(valid|final)/, validBase);
  const validStatus   = after(/status.*(valid|final)/, validBase);

  return {
    unidade, capitulo, codigo, tipo, pct, linkObjeto,
    conteudistaNome, conteudistaDL, conteudiostaStatus,
    diNome, diDL, diStatus,
    profAtorNome, profAtorDL, profAtorStatus,
    profTecNome, profTecDL, profTecStatus,
    acessNome, acessDL, acessStatus,
    prodNome, prodDL, prodStatus,
    linkFinal, validadorNome, validDL, validStatus,
  };
}

function g(row: string[], idx: number): string {
  return idx >= 0 ? (row[idx] ?? "") : "";
}

function mapRow(c: string[], m: ColMap): MCRow {
  return {
    unidade:             parseInt(g(c, m.unidade))  || 0,
    capitulo:            parseInt(g(c, m.capitulo)) || 0,
    codigo:              g(c, m.codigo).trim(),
    tipo:                mapTipo(g(c, m.tipo)),
    progressoPct:        parseFloat(g(c, m.pct).replace("%", "")) || 0,
    linkObjeto:          g(c, m.linkObjeto).trim(),
    conteudistaNome:     g(c, m.conteudistaNome).trim(),
    conteudistaDL:       parseDate(g(c, m.conteudistaDL)),
    conteudiostaStatus:  mapStatusEtapa(g(c, m.conteudiostaStatus)),
    diNome:              g(c, m.diNome).trim(),
    diDL:                parseDate(g(c, m.diDL)),
    diStatus:            mapStatusEtapa(g(c, m.diStatus)),
    profAtorNome:        g(c, m.profAtorNome).trim(),
    profAtorDL:          parseDate(g(c, m.profAtorDL)),
    profAtorStatus:      mapStatusEtapa(g(c, m.profAtorStatus)),
    profTecNome:         g(c, m.profTecNome).trim(),
    profTecDL:           parseDate(g(c, m.profTecDL)),
    profTecStatus:       mapStatusEtapa(g(c, m.profTecStatus)),
    acessNome:           g(c, m.acessNome).trim(),
    acessDL:             parseDate(g(c, m.acessDL)),
    acessStatus:         mapStatusEtapa(g(c, m.acessStatus)),
    prodNome:            g(c, m.prodNome).trim(),
    prodDL:              parseDate(g(c, m.prodDL)),
    prodStatus:          mapStatusEtapa(g(c, m.prodStatus)),
    linkFinal:           g(c, m.linkFinal).trim(),
    validadorNome:       g(c, m.validadorNome).trim(),
    validDL:             parseDate(g(c, m.validDL)),
    validStatus:         mapStatusEtapa(g(c, m.validStatus)),
  };
}

// ─── Parse ────────────────────────────────────────────────────────────────────

export function parseBuffer(buffer: Buffer, filename: string): MCRow[] {
  const isCSV = filename.toLowerCase().endsWith(".csv");

  if (isCSV) {
    const text = buffer.toString("utf-8").replace(/^\uFEFF/, "");
    const rows = text.split(/\r?\n/).map((l) => l.split(";")).filter((r) => r.length > 2);
    return rows
      .slice(1)
      .filter((r) => r[0]?.trim() && !isNaN(Number(r[0]?.trim())))
      .map((c) => mapRow(c, CSV_COL_MAP));
  }

  // ── XLSX: processa cada aba separadamente com ColMap dinâmico ──────────────
  const wb = XLSX.read(buffer, { type: "buffer", cellDates: true });
  const result: MCRow[] = [];

  for (const sheetName of wb.SheetNames) {
    const ws = wb.Sheets[sheetName]!;
    const sheetRows = XLSX.utils.sheet_to_json<string[]>(ws, {
      header: 1, raw: false, defval: "",
    }) as string[][];

    if (sheetRows.length < 2) continue;

    const colMap  = buildColMap(sheetRows[0]!);
    const dataRows = sheetRows
      .slice(1)
      .filter((r) => r[0]?.trim() && !isNaN(Number(r[0]?.trim())));

    result.push(...dataRows.map((c) => mapRow(c, colMap)));
  }

  return result;
}

export function buildPreview(rows: MCRow[]): ImportPreview {
  const unidadeMap = new Map<number, number>();
  const avisos: string[] = [];

  for (const r of rows) {
    unidadeMap.set(r.unidade, (unidadeMap.get(r.unidade) ?? 0) + 1);
    if (!r.codigo) avisos.push(`Linha sem código de OA (U${r.unidade}C${r.capitulo})`);
  }

  return {
    totalOAs: rows.length,
    unidades: Array.from(unidadeMap.entries()).map(([numero, totalOAs]) => ({ numero, totalOAs })),
    amostra: rows.slice(0, 5),
    avisos: [...new Set(avisos)].slice(0, 10),
    responsaveisNaoEncontrados: [], // preenchido pelo controller após comparar com membros do curso
  };
}

// ─── Persistência ─────────────────────────────────────────────────────────────

export async function persistMC(rows: MCRow[], cursoId: string): Promise<{ criados: number; atualizados: number; ignorados: number; avisos: string[] }> {
  const avisosMC: string[] = [];

  // Busca etapas definição
  const etapasDef = await prisma.etapaDefinicao.findMany({ where: { ativo: true } });

  const getEtapaDef = (papel: string, tipo?: string) =>
    etapasDef.find((e) =>
      e.papel === papel && (e.tipoOA === null || e.tipoOA === tipo)
    );

  // Carrega membros do curso para resolver nomes → IDs
  const membros = await prisma.cursoMembro.findMany({
    where:   { cursoId },
    include: { usuario: { select: { id: true, nome: true } } },
  });
  const nomesNaoResolvidos = new Set<string>();
  const resolveResponsavel = (nome: string): string | null => {
    if (!nome?.trim()) return null;
    const n = nome.trim().toLowerCase();
    const m = membros.find((mb) =>
      mb.usuario.nome.toLowerCase() === n ||
      mb.usuario.nome.toLowerCase().startsWith(n)
    );
    if (!m) nomesNaoResolvidos.add(nome.trim());
    return m?.usuarioId ?? null;
  };

  let criados    = 0;
  let atualizados = 0;
  let ignorados  = 0;

  // Cache unidades e capítulos para evitar N+1
  const unidadeCache  = new Map<number, string>();
  const capituloCache = new Map<string, string>();

  // Dados de etapas a sincronizar por papel (sem COORDENADOR_PRODUCAO — não vem na MC)
  const etapasMC = (row: MCRow) => [
    { papel: "CONTEUDISTA",          status: row.conteudiostaStatus, dl: row.conteudistaDL,  resp: row.conteudistaNome, ordem: 1 },
    { papel: "DESIGNER_INSTRUCIONAL",status: row.diStatus,           dl: row.diDL,           resp: row.diNome,          ordem: 2 },
    { papel: "PROFESSOR_ATOR",       status: row.profAtorStatus,     dl: row.profAtorDL,     resp: row.profAtorNome,    ordem: 3 },
    { papel: "PROFESSOR_TECNICO",    status: row.profTecStatus,      dl: row.profTecDL,      resp: row.profTecNome,     ordem: 4 },
    { papel: "ACESSIBILIDADE",       status: row.acessStatus,        dl: row.acessDL,        resp: row.acessNome,       ordem: 5 },
    { papel: "PRODUTOR_FINAL",       status: row.prodStatus,         dl: row.prodDL,         resp: row.prodNome,        ordem: 6 },
    { papel: "VALIDADOR_FINAL",      status: row.validStatus,        dl: row.validDL,        resp: row.validadorNome,   ordem: 7 },
  ];

  for (const row of rows) {
    try {
      // ── Unidade ──────────────────────────────────────────────────────────
      if (!unidadeCache.has(row.unidade)) {
        const uni = await prisma.unidade.upsert({
          where: { cursoId_numero: { cursoId, numero: row.unidade } },
          update: {},
          create: { cursoId, numero: row.unidade, nome: `Unidade ${row.unidade}` },
        });
        unidadeCache.set(row.unidade, uni.id);
      }
      const unidadeId = unidadeCache.get(row.unidade)!;

      // ── Capítulo ─────────────────────────────────────────────────────────
      const capKey = `${unidadeId}:${row.capitulo}`;
      if (!capituloCache.has(capKey)) {
        const cap = await prisma.capitulo.upsert({
          where: { unidadeId_numero: { unidadeId, numero: row.capitulo } },
          update: {},
          create: { unidadeId, numero: row.capitulo, nome: `Capítulo ${row.capitulo}` },
        });
        capituloCache.set(capKey, cap.id);
      }
      const capituloId = capituloCache.get(capKey)!;

      // ── Status global do OA ──────────────────────────────────────────────
      let statusOA: "PENDENTE" | "EM_ANDAMENTO" | "CONCLUIDO" = "PENDENTE";
      if (row.progressoPct >= 100) statusOA = "CONCLUIDO";
      else if (row.progressoPct > 0) statusOA = "EM_ANDAMENTO";

      // ── OA já existe? ─────────────────────────────────────────────────────
      const existing = await prisma.objetoAprendizagem.findUnique({
        where:   { codigo: row.codigo },
        select:  {
          id: true,
          capitulo: { select: { unidade: { select: { cursoId: true } } } },
          etapas:   { include: { etapaDef: true }, orderBy: { ordem: "asc" } },
        },
      });

      if (existing) {
        if (existing.capitulo?.unidade?.cursoId !== cursoId) {
          // OA órfão de outro curso — remove para recriar neste curso
          logger.warn({ codigo: row.codigo, cursoId }, "persistMC: removendo OA órfão de curso anterior");
          await prisma.objetoAprendizagem.delete({ where: { id: existing.id } });
          // Continua para criar abaixo
        } else {
          // ── ATUALIZA OA existente ────────────────────────────────────────
          await prisma.objetoAprendizagem.update({
            where: { id: existing.id },
            data: {
              status:          statusOA,
              progressoPct:    Math.round(row.progressoPct),
              linkObjeto:      row.linkObjeto   || null,
              linkObjetoFinal: row.linkFinal    || null,
              deadlineFinal:   row.validDL,
            },
          });

          // Atualiza etapas existentes por papel
          for (const upd of etapasMC(row)) {
            const etapa = existing.etapas.find((e) => e.etapaDef.papel === upd.papel);
            if (!etapa) continue;
            const responsavelId = resolveResponsavel(upd.resp);
            await prisma.etapaOA.update({
              where: { id: etapa.id },
              data: {
                status:          upd.status as any,
                deadlinePrevisto: upd.dl,
                deadlineReal:    upd.status === "CONCLUIDA" ? upd.dl : null,
                ...(responsavelId ? { responsavelId } : {}),
              },
            });
          }

          atualizados++;
          continue;
        }
      }

      // ── Cria OA ───────────────────────────────────────────────────────────
      const oa = await prisma.objetoAprendizagem.create({
        data: {
          capituloId,
          codigo:          row.codigo,
          tipo:            row.tipo as any,
          numero:          parseInt(row.codigo.match(/\d+$/)?.[0] ?? "1"),
          status:          statusOA,
          progressoPct:    Math.round(row.progressoPct),
          linkObjeto:      row.linkObjeto || null,
          linkObjetoFinal: row.linkFinal  || null,
          deadlineFinal:   row.validDL,
        },
      });

      // ── Cria EtapaOAs ─────────────────────────────────────────────────────
      const etapasParaCriar = [
        { papel: "COORDENADOR_PRODUCAO", status: "PENDENTE", dl: null as Date | null, ordem: 0 },
        ...etapasMC(row),
      ];

      for (const etapa of etapasParaCriar) {
        const def = getEtapaDef(etapa.papel, row.tipo);
        if (!def) continue;
        const responsavelId = 'resp' in etapa ? resolveResponsavel((etapa as any).resp) : null;
        await prisma.etapaOA.create({
          data: {
            oaId:             oa.id,
            etapaDefId:       def.id,
            status:           etapa.status as any,
            deadlinePrevisto: etapa.dl,
            deadlineReal:     etapa.status === "CONCLUIDA" ? etapa.dl : null,
            ordem:            etapa.ordem,
            ...(responsavelId ? { responsavelId } : {}),
          },
        });
      }

      criados++;
    } catch (err) {
      logger.warn({ err, codigo: row.codigo }, "Erro ao importar OA — pulando.");
      ignorados++;
    }
  }

  for (const nome of nomesNaoResolvidos) {
    avisosMC.push(`Responsável "${nome}" não encontrado no time do projeto — etapas atribuídas a este nome ficaram sem responsável.`);
  }

  return { criados, atualizados, ignorados, avisos: avisosMC };
}

// ─── Parse MI ─────────────────────────────────────────────────────────────────

const TIPO_LETRA: Record<string, string> = {
  VIDEO: "V", SLIDE: "S", QUIZ: "Q", EBOOK: "E", PLANO_AULA: "P", TAREFA: "T",
  INFOGRAFICO: "I", TIMELINE: "L",
};

const BLOOM_MAP: Record<string, string> = {
  "lembrar":     "LEMBRAR",
  "remembering": "LEMBRAR",
  "compreender": "COMPREENDER",
  "entendimento":"COMPREENDER",
  "understanding":"COMPREENDER",
  "aplicar":     "APLICAR",
  "applying":    "APLICAR",
  "analisar":    "ANALISAR",
  "analyzing":   "ANALISAR",
  "avaliar":     "AVALIAR",
  "evaluating":  "AVALIAR",
  "criar":       "CRIAR",
  "creating":    "CRIAR",
};

function mapBloom(raw: string): string | null {
  if (!raw?.trim()) return null;
  const lower = raw.trim().toLowerCase();
  for (const [key, val] of Object.entries(BLOOM_MAP)) {
    if (lower.includes(key)) return val;
  }
  return null;
}

function resolveIdem(value: string, previous: string): string {
  if (!value?.trim() || value.trim().toLowerCase() === "idem") return previous;
  return value.trim();
}

function parseMinutes(raw: string): number {
  if (!raw?.trim()) return 0;
  // Formato HH:MM
  if (raw.includes(":")) {
    const [h, m] = raw.split(":").map(Number);
    return (h ?? 0) * 60 + (m ?? 0);
  }
  return parseInt(raw) || 0;
}

/**
 * Trata tipos compostos como "Roteiro de Vídeo + Slides".
 * Retorna array de tipos reconhecidos; usa correspondência parcial como fallback.
 */
function mapTiposMI(raw: string): string[] {
  const partes = raw.split(/\s*\+\s*/).map((p) => p.trim().toLowerCase()).filter(Boolean);
  const tipos: string[] = [];
  for (const p of partes) {
    if (TIPO_MAP[p]) { tipos.push(TIPO_MAP[p]!); continue; }
    // Correspondência parcial por palavra-chave
    if (/v[íi]deo|video|roteiro/.test(p)) { tipos.push("VIDEO"); continue; }
    if (/slide/.test(p))                  { tipos.push("SLIDE"); continue; }
    if (/quiz|question|avalia/.test(p))   { tipos.push("QUIZ"); continue; }
    if (/plano.*aula|aula.*plano/.test(p)){ tipos.push("PLANO_AULA"); continue; }
    if (/f[óo]rum|forum|atividade|discuss/.test(p)) { tipos.push("TAREFA"); continue; }
    if (/ebook|e-book|livro|apostila/.test(p)) { tipos.push("EBOOK"); continue; }
    // Tipo não reconhecido — registra como TAREFA para não perder o OA
    tipos.push("TAREFA");
  }
  return tipos;
}

/** Mapeamento dinâmico de colunas da MI por cabeçalho */
interface MIColMap {
  capNum: number; nome: number; conteudo: number;
  oeNum: number;  oeDesc: number; bloom: number; papeis: number;
  tipoOA: number; qtdOA: number;
  chSin: number;  chAss: number; periodo: number;
  ferramentas: number; atividadeFormativa: number; atividadeSomativa: number;
  chAtv: number; feedback: number;
}

function buildMIColMap(headerRow: string[]): MIColMap {
  const h    = headerRow.map(normH);
  const find = (pat: RegExp) => h.findIndex((v) => pat.test(v));

  // Capítulo — tenta "n capitulo" (Nº Capítulo) primeiro; fallback para qualquer "capitulo"
  const capNum = (() => {
    const byN = find(/^n[ \t].*capitulo/);
    return byN >= 0 ? byN : find(/\bcapitulo\b/);
  })();

  // OA tipo — aceita plural/singular/abreviações comuns
  const tipoOA = (() => {
    // Tenta ordem de especificidade decrescente
    for (const pat of [
      /^objetos de aprendizagem$/, // exato padrão original
      /^objeto de aprendizagem$/,  // singular
      /objeto.*aprendizagem/,      // qualquer variação com ambas as palavras
      /^tipo.*\boa\b/,             // "Tipo OA", "Tipo de OA"
      /^oa$/,                      // coluna chamada apenas "OA"
    ]) {
      const idx = find(pat);
      if (idx >= 0) return idx;
    }
    return -1;
  })();

  // Quantidade de OAs — aceita variações de "Nº Objetos de Aprendizagem"
  const qtdOA = (() => {
    for (const pat of [
      /n.*objetos de aprendizagem/,
      /n.*objeto.*aprendizagem/,
      /n.*\boas?\b/,
      /qtd.*\boas?\b/,
      /quantidade.*\boas?\b/,
    ]) {
      const idx = find(pat);
      if (idx >= 0) return idx;
    }
    return -1;
  })();

  return {
    capNum,
    nome:               find(/nome.*capitulo/),
    conteudo:           find(/^conte/),
    // Objetivo — "n objetivo" (Nº OE), não "objetivo educacional"
    oeNum:              find(/^n[ \t].*objetivo/),
    oeDesc:             find(/^objetivo educacional$/),
    bloom:              find(/nivel.*trb|^trb$|bloom/),
    papeis:             find(/papeis|atores/),
    tipoOA,
    qtdOA,
    chSin:              find(/ch sincrona/),
    chAss:              find(/ch assincrona/),
    periodo:            find(/periodo/),
    ferramentas:        find(/^ferramentas$/),
    atividadeFormativa: find(/atividade formativa/),
    atividadeSomativa:  find(/atividade somativa/),
    chAtv:              find(/ch atividades/),
    feedback:           find(/^feedback$/),
  };
}

export function parseMI(buffer: Buffer, filename: string): MICapitulo[] {
  const wb = XLSX.read(buffer, { type: "buffer", cellDates: true });
  const result: MICapitulo[] = [];

  for (const sheetName of wb.SheetNames) {
    const unidadeMatch = sheetName.match(/(\d+)/);
    if (!unidadeMatch) continue;
    const unidadeNum  = parseInt(unidadeMatch[1]!);
    const unidadeNome = sheetName.trim();

    const ws   = wb.Sheets[sheetName]!;
    const rows = XLSX.utils.sheet_to_json<string[]>(ws, {
      header: 1, raw: false, defval: "",
    }) as string[][];

    // Localiza linha de cabeçalho pela presença de "Nº Capítulo" (ou variação).
    // Estratégia 1: célula que contenha "capitulo" E comece com "n" (Nº Capítulo)
    // Estratégia 2: linha que contenha AMBAS as palavras "capitulo" E "objetivo" em células distintas
    let headerIdx = rows.findIndex((r) => {
      const cells = r.map((c) => normH(c?.toString() ?? ""));
      const hasCapN = cells.some((n) => /capitulo/.test(n) && /^n\b/.test(n));
      if (hasCapN) return true;
      const hasCap = cells.some((n) => /\bcapitulo\b/.test(n));
      const hasObj = cells.some((n) => /\bobjetivo\b/.test(n));
      return hasCap && hasObj;
    });
    if (headerIdx === -1) headerIdx = 7; // fallback

    const colMap   = buildMIColMap(rows[headerIdx] ?? []);
    // Usa o índice detectado para capNum; fallback para 1 (posição real nos arquivos padrão)
    const capColIdx = colMap.capNum >= 0 ? colMap.capNum : 1;

    if (colMap.capNum < 0) {
      logger.warn(
        { sheetName, headerIdx, capColIdx },
        "parseMI: coluna 'Nº Capítulo' não detectada — usando fallback coluna 1."
      );
    }

    const dataRows = rows
      .slice(headerIdx + 1)
      .filter((r) => r[capColIdx]?.trim() && !isNaN(Number(r[capColIdx]?.trim())));

    // Fallback: se tipoOA não foi encontrado pelo cabeçalho, tenta detectar por conteúdo
    // (busca uma coluna onde ≥2 células contêm valores reconhecidos de tipo de OA)
    if (colMap.tipoOA < 0 && dataRows.length > 0) {
      const tipoKeys = new Set(Object.keys(TIPO_MAP).map(normH));
      const sampleRows = dataRows.slice(0, Math.min(30, dataRows.length));
      const ncols = rows[headerIdx]?.length ?? 30;
      for (let ci = 0; ci < ncols; ci++) {
        const hits = sampleRows.filter((r) => {
          const v = normH(r[ci]?.toString() ?? "");
          return v && tipoKeys.has(v);
        }).length;
        if (hits >= 2) {
          colMap.tipoOA = ci;
          logger.info(
            { sheetName, colIdx: ci, headerCell: rows[headerIdx]?.[ci] },
            "parseMI: coluna tipoOA detectada por conteúdo (fallback)"
          );
          break;
        }
      }
    }

    if (colMap.tipoOA < 0) {
      logger.warn(
        { sheetName, headerRow: rows[headerIdx]?.slice(0, 25) },
        "parseMI: coluna tipoOA não detectada nem por cabeçalho nem por conteúdo — OAs não serão gerados nesta aba."
      );
    }
    logger.debug(
      { sheetName, headerIdx, tipoOA: colMap.tipoOA, qtdOA: colMap.qtdOA, capNum: colMap.capNum, oeDesc: colMap.oeDesc },
      "parseMI: mapeamento de colunas"
    );

    const capMap     = new Map<number, MICapitulo>();
    const prevValues = Array(rows[headerIdx]?.length ?? 20).fill("") as string[];

    for (const row of dataRows) {
      const r = row.map((v, i) => resolveIdem(v?.toString() ?? "", prevValues[i] ?? ""));
      r.forEach((v, i) => { if (v) prevValues[i] = v; });

      // Helper: lê célula pelo índice detectado; retorna "" se coluna não foi encontrada
      const gc = (idx: number) => (idx >= 0 ? (r[idx] ?? "") : "");

      const capNum = parseInt(gc(capColIdx));
      if (!capNum) continue;

      const oeNum  = parseInt(gc(colMap.oeNum))  || 1;
      const oeDesc = gc(colMap.oeDesc);
      const bloom  = mapBloom(gc(colMap.bloom));
      const papeis = gc(colMap.papeis);
      const chSin  = parseMinutes(gc(colMap.chSin));
      const chAss  = parseMinutes(gc(colMap.chAss));
      const chAtv  = parseMinutes(gc(colMap.chAtv));
      const periodo = parseInt(gc(colMap.periodo)) || 0;

      if (!capMap.has(capNum)) {
        capMap.set(capNum, {
          unidade:            unidadeNum,
          unidadeNome,
          numero:             capNum,
          nome:               gc(colMap.nome) || `Capítulo ${capNum}`,
          conteudoResumo:     gc(colMap.conteudo),
          chSincrona:         0,
          chAssincrona:       0,
          chAtividades:       0,
          periodoDias:        periodo,
          ferramentas:        gc(colMap.ferramentas),
          atividadeFormativa: gc(colMap.atividadeFormativa),
          atividadeSomativa:  gc(colMap.atividadeSomativa),
          feedback:           gc(colMap.feedback),
          objetivos:          [],
          oaDefs:             [],
        });
      }

      const cap = capMap.get(capNum)!;
      cap.chSincrona   += chSin;
      cap.chAssincrona += chAss;
      cap.chAtividades += chAtv;
      // Atualiza periodoDias se encontrar valor não-zero em qualquer linha do capítulo
      if (periodo > 0 && cap.periodoDias === 0) cap.periodoDias = periodo;

      if (oeDesc && !cap.objetivos.some((o) => o.numero === oeNum && o.descricao === oeDesc)) {
        cap.objetivos.push({ numero: oeNum, descricao: oeDesc, nivelBloom: bloom ?? "", papeisAtores: papeis });
      }

      const tipoRaw = gc(colMap.tipoOA).trim();
      // Quantidade: usa o valor da planilha; se vazio/zero, assume 1 (padrão PU43)
      const qtd     = parseInt(gc(colMap.qtdOA)) || 1;

      if (tipoRaw) {
        for (const tipo of mapTiposMI(tipoRaw)) {
          cap.oaDefs.push({ oeNumero: oeNum, tipo, quantidade: qtd });
        }
      }
    }

    result.push(...capMap.values());
  }

  return result;
}

export function buildMIPreview(caps: MICapitulo[]): MIPreview {
  const avisos: string[] = [];
  const unidadeMap = new Map<number, { nome: string; total: number }>();

  for (const cap of caps) {
    const u = unidadeMap.get(cap.unidade);
    if (u) { u.total++; }
    else    { unidadeMap.set(cap.unidade, { nome: `Unidade ${cap.unidade}`, total: 1 }); }
    if (!cap.nome || cap.nome.startsWith("Capítulo")) {
      avisos.push(`U${cap.unidade}C${cap.numero}: nome do capítulo não encontrado.`);
    }
    if (cap.oaDefs.length === 0) {
      avisos.push(`U${cap.unidade}C${cap.numero}: nenhum OA detectado (verifique a coluna "Objetos de Aprendizagem").`);
    }
  }

  const totalObjetivos = caps.reduce((s, c) => s + c.objetivos.length, 0);
  const totalOAs       = caps.reduce((s, c) => s + c.oaDefs.reduce((q, d) => q + d.quantidade, 0), 0);

  return {
    totalCapitulos: caps.length,
    totalObjetivos,
    totalOAs,
    unidades: Array.from(unidadeMap.entries()).map(([numero, { nome, total }]) => ({
      numero, nome, totalCapitulos: total,
    })),
    amostra: caps.slice(0, 3),
    avisos:  [...new Set(avisos)].slice(0, 10),
  };
}

// ─── Cálculo de deadlines por etapa ───────────────────────────────────────────

/** Fração do periodoDias do capítulo em que cada etapa deve ser concluída */
const FRACAO_ETAPA: Record<string, number> = {
  COORDENADOR_PRODUCAO:  0.10,  // Setup: primeiros ~10% do período
  CONTEUDISTA:           0.40,
  DESIGNER_INSTRUCIONAL: 0.55,
  PROFESSOR_ATOR:        0.65,
  PROFESSOR_TECNICO:     0.75,
  ACESSIBILIDADE:        0.82,
  EDITOR_VIDEO:          0.88,
  DESIGNER_GRAFICO:      0.88,
  PRODUTOR_FINAL:        0.90,
  VALIDADOR_FINAL:       1.00,
};

function addDias(date: Date, dias: number): Date {
  const d = new Date(date);
  d.setDate(d.getDate() + dias);
  return d;
}

function deadlineEtapa(inicio: Date | null, periodoDias: number, papel: string): Date | null {
  if (!inicio || periodoDias <= 0) return null;
  const frac = FRACAO_ETAPA[papel] ?? 1.0;
  return addDias(inicio, Math.round(frac * periodoDias));
}

export async function persistMI(caps: MICapitulo[], cursoId: string, options: { dataInicio?: Date } = {}): Promise<MIResult> {
  let capitulosAtualizados = 0;
  let objetivosCriados = 0;
  let oasCriados = 0;
  let oasIgnorados = 0;

  const etapasDef = await prisma.etapaDefinicao.findMany({ where: { ativo: true } });
  const getEtapaDef = (papel: string, tipo?: string) =>
    etapasDef.find((e) => e.papel === papel && (e.tipoOA === null || e.tipoOA === tipo));

  // Pré-calcula a data de início de cada capítulo com base no dataInicio + periodoDias acumulados
  const capInicioMap  = new Map<string, Date | null>();
  const capPeriodoMap = new Map<string, number>();   // período efetivo (com fallback)
  if (options.dataInicio) {
    const sorted = [...caps].sort((a, b) => a.unidade - b.unidade || a.numero - b.numero);

    // Período médio dos capítulos que têm valor — usado como fallback para os sem período
    const periodosConhecidos = sorted.map((c) => c.periodoDias).filter((p) => p > 0);
    const periodoFallback = periodosConhecidos.length > 0
      ? Math.round(periodosConhecidos.reduce((s, v) => s + v, 0) / periodosConhecidos.length)
      : 14;  // 14 dias se nenhum capítulo tiver período definido

    let diasAcumulados = 0;
    for (const cap of sorted) {
      const key    = `${cap.unidade}:${cap.numero}`;
      const periodo = cap.periodoDias > 0 ? cap.periodoDias : periodoFallback;
      capInicioMap.set(key, addDias(options.dataInicio, diasAcumulados));
      capPeriodoMap.set(key, periodo);
      diasAcumulados += periodo;
    }
  }

  const unidadeCache = new Map<number, string>();

  for (const cap of caps) {
    try {
      // Unidade
      if (!unidadeCache.has(cap.unidade)) {
        const uni = await prisma.unidade.upsert({
          where:  { cursoId_numero: { cursoId, numero: cap.unidade } },
          update: { nome: cap.unidadeNome },
          create: { cursoId, numero: cap.unidade, nome: cap.unidadeNome },
        });
        unidadeCache.set(cap.unidade, uni.id);
      }
      const unidadeId = unidadeCache.get(cap.unidade)!;

      // Capítulo — upsert com dados reais da MI
      const capitulo = await prisma.capitulo.upsert({
        where: { unidadeId_numero: { unidadeId, numero: cap.numero } },
        update: {
          nome:              cap.nome,
          conteudoResumo:    cap.conteudoResumo || null,
          chSincrona:        cap.chSincrona > 0 ? cap.chSincrona / 60 : null,
          chAssincrona:      cap.chAssincrona > 0 ? cap.chAssincrona / 60 : null,
          chAtividades:      cap.chAtividades > 0 ? cap.chAtividades / 60 : null,
          periodoDias:       cap.periodoDias > 0 ? cap.periodoDias : null,
          ferramentas:       cap.ferramentas || null,
          atividadeFormativa:cap.atividadeFormativa || null,
          atividadeSomativa: cap.atividadeSomativa || null,
          feedback:          cap.feedback || null,
        },
        create: {
          unidadeId,
          numero:            cap.numero,
          nome:              cap.nome,
          conteudoResumo:    cap.conteudoResumo || null,
          chSincrona:        cap.chSincrona > 0 ? cap.chSincrona / 60 : null,
          chAssincrona:      cap.chAssincrona > 0 ? cap.chAssincrona / 60 : null,
          chAtividades:      cap.chAtividades > 0 ? cap.chAtividades / 60 : null,
          periodoDias:       cap.periodoDias > 0 ? cap.periodoDias : null,
          ferramentas:       cap.ferramentas || null,
          atividadeFormativa:cap.atividadeFormativa || null,
          atividadeSomativa: cap.atividadeSomativa || null,
          feedback:          cap.feedback || null,
        },
      });
      capitulosAtualizados++;

      // Objetivos educacionais — recria para este capítulo
      await prisma.objetivoEducacional.deleteMany({ where: { capituloId: capitulo.id } });
      for (const oe of cap.objetivos) {
        if (!oe.descricao) continue;
        await prisma.objetivoEducacional.create({
          data: {
            capituloId:  capitulo.id,
            numero:      oe.numero,
            descricao:   oe.descricao,
            nivelBloom:  oe.nivelBloom ? (oe.nivelBloom as any) : null,
            papeisAtores:oe.papeisAtores || null,
          },
        });
        objetivosCriados++;
      }

      // Data de início do capítulo (para cálculo de deadlines)
      const capKey    = `${cap.unidade}:${cap.numero}`;
      const capInicio = capInicioMap.get(capKey) ?? null;
      const periodo   = capPeriodoMap.get(capKey) ?? 0;
      const deadlineFinalCap = capInicio && periodo > 0
        ? addDias(capInicio, periodo)
        : null;

      // Gera OAs a partir das definições da MI
      for (const def of cap.oaDefs) {
        const letra = TIPO_LETRA[def.tipo] ?? "S";
        for (let n = 1; n <= def.quantidade; n++) {
          const codigo = `U${cap.unidade}C${cap.numero}O${def.oeNumero}${letra}${n}`;
          const existing = await prisma.objetoAprendizagem.findUnique({
            where:  { codigo },
            select: { id: true, capitulo: { select: { unidade: { select: { cursoId: true } } } } },
          });
          if (existing) {
            if (existing.capitulo?.unidade?.cursoId === cursoId) {
              // Mesmo curso: OA já importado, pula normalmente
              oasIgnorados++; continue;
            }
            // OA órfão de curso diferente (excluído sem cascade) — remove para recriar
            logger.warn({ codigo, cursoId }, "persistMI: removendo OA órfão de curso anterior");
            await prisma.objetoAprendizagem.delete({ where: { id: existing.id } });
          }

          const oa = await prisma.objetoAprendizagem.create({
            data: {
              capituloId:   capitulo.id,
              codigo,
              tipo:         def.tipo as any,
              numero:       n,
              status:       "PENDENTE",
              progressoPct: 0,
              deadlineFinal: deadlineFinalCap,
            },
          });

          // Cria etapas do pipeline com deadlines calculados
          // Pipeline por tipo: VIDEO tem gravação+edição; demais têm acessibilidade+diagramação
          // Todos os tipos começam com Setup de Produção (ordem 0 — coordenador administrativo)
          const etapasParaCriar = def.tipo === "VIDEO"
            ? [
                { papel: "COORDENADOR_PRODUCAO",  ordem: 0 },
                { papel: "CONTEUDISTA",           ordem: 1 },
                { papel: "DESIGNER_INSTRUCIONAL", ordem: 2 },
                { papel: "PROFESSOR_ATOR",        ordem: 3 },
                { papel: "EDITOR_VIDEO",          ordem: 4 },
                { papel: "VALIDADOR_FINAL",       ordem: 5 },
              ]
            : [
                { papel: "COORDENADOR_PRODUCAO",  ordem: 0 },
                { papel: "CONTEUDISTA",           ordem: 1 },
                { papel: "DESIGNER_INSTRUCIONAL", ordem: 2 },
                { papel: "ACESSIBILIDADE",        ordem: 3 },
                { papel: "DESIGNER_GRAFICO",      ordem: 4 },
                { papel: "VALIDADOR_FINAL",       ordem: 5 },
              ];

          for (const etapa of etapasParaCriar) {
            const etapaDef = getEtapaDef(etapa.papel, def.tipo);
            if (!etapaDef) continue;
            await prisma.etapaOA.create({
              data: {
                oaId:             oa.id,
                etapaDefId:       etapaDef.id,
                status:           "PENDENTE",
                ordem:            etapa.ordem,
                deadlinePrevisto: deadlineEtapa(capInicio, periodo, etapa.papel),
              },
            });
          }
          oasCriados++;
        }
      }
    } catch (err) {
      logger.warn({ err, cap: `U${cap.unidade}C${cap.numero}` }, "Erro ao importar capítulo MI — pulando.");
    }
  }

  return { capitulosAtualizados, objetivosCriados, oasCriados, oasIgnorados };
}
