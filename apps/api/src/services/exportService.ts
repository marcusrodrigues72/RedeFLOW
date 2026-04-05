import * as XLSX from "xlsx";
import { prisma } from "../lib/prisma.js";

// ─── Export: Atrasos por Responsável ──────────────────────────────────────────

export async function exportAtrasos(cursoId?: string): Promise<Buffer> {
  const oaFilter = cursoId
    ? { capitulo: { unidade: { cursoId } } }
    : {};

  const etapas = await prisma.etapaOA.findMany({
    where: {
      status:           { in: ["PENDENTE", "EM_ANDAMENTO"] },
      deadlinePrevisto: { lt: new Date() },
      responsavelId:    { not: null },
      oa:               oaFilter,
    },
    select: {
      deadlinePrevisto: true,
      responsavel:      { select: { nome: true, email: true } },
      etapaDef:         { select: { nome: true } },
      oa: {
        select: {
          codigo: true,
          capitulo: { select: { unidade: { select: { curso: { select: { nome: true, codigo: true } } } } } },
        },
      },
    },
    orderBy: { deadlinePrevisto: "asc" },
  });

  const hoje = new Date();
  const rows = etapas.map((e) => {
    const dias = e.deadlinePrevisto
      ? Math.ceil((hoje.getTime() - new Date(e.deadlinePrevisto).getTime()) / 86_400_000)
      : 0;
    return [
      e.responsavel?.nome ?? "",
      e.responsavel?.email ?? "",
      e.oa.capitulo.unidade.curso.nome,
      e.oa.codigo,
      e.etapaDef.nome,
      fmtDate(e.deadlinePrevisto),
      dias,
    ];
  });

  const headers = ["Responsável", "E-mail", "Curso", "OA", "Etapa", "Deadline", "Dias em Atraso"];
  const ws = XLSX.utils.aoa_to_sheet([headers, ...rows]);
  ws["!cols"] = [{ wch: 24 }, { wch: 30 }, { wch: 30 }, { wch: 16 }, { wch: 24 }, { wch: 14 }, { wch: 16 }];

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Atrasos");
  return XLSX.write(wb, { type: "buffer", bookType: "xlsx" }) as Buffer;
}

// ─── Export: Progresso por Curso ──────────────────────────────────────────────

export async function exportProgressoCursos(cursoId?: string): Promise<Buffer> {
  const cursos = await prisma.curso.findMany({
    where: cursoId ? { id: cursoId } : {},
    select: { id: true, nome: true, codigo: true, status: true },
    orderBy: { nome: "asc" },
  });

  type AggRow = { cursoId: string; total: bigint; concluidos: bigint; atrasados: bigint };
  const cursoIds = cursos.map((c) => c.id);
  const aggs = cursoIds.length > 0
    ? await prisma.$queryRaw<AggRow[]>`
        SELECT u."cursoId",
               COUNT(DISTINCT oa.id)                                                       AS total,
               COUNT(DISTINCT CASE WHEN oa.status = 'CONCLUIDO'          THEN oa.id END)  AS concluidos,
               COUNT(DISTINCT CASE WHEN e.status IN ('PENDENTE','EM_ANDAMENTO')
                                    AND e."deadlinePrevisto" < NOW()      THEN e.id  END)  AS atrasados
        FROM "unidades" u
        JOIN "capitulos" c              ON c."unidadeId"  = u.id
        JOIN "objetos_aprendizagem" oa  ON oa."capituloId" = c.id
        LEFT JOIN "etapas_oa" e         ON e."oaId"        = oa.id
        WHERE u."cursoId" = ANY(${cursoIds})
        GROUP BY u."cursoId"
      `
    : [];

  const aggMap = new Map(aggs.map((r) => [r.cursoId, r]));

  const STATUS_LABEL: Record<string, string> = { ATIVO: "Ativo", RASCUNHO: "Rascunho", ARQUIVADO: "Arquivado" };
  const rows = cursos.map((c) => {
    const agg     = aggMap.get(c.id);
    const total   = Number(agg?.total     ?? 0);
    const concl   = Number(agg?.concluidos ?? 0);
    const atraso  = Number(agg?.atrasados  ?? 0);
    const pct     = total > 0 ? Math.round((concl / total) * 100) : 0;
    return [c.codigo, c.nome, STATUS_LABEL[c.status] ?? c.status, total, concl, atraso, `${pct}%`];
  });

  const headers = ["Código", "Curso", "Status", "Total OAs", "Concluídos", "Atrasados", "Progresso"];
  const ws = XLSX.utils.aoa_to_sheet([headers, ...rows]);
  ws["!cols"] = [{ wch: 14 }, { wch: 36 }, { wch: 12 }, { wch: 12 }, { wch: 12 }, { wch: 12 }, { wch: 12 }];

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Progresso");
  return XLSX.write(wb, { type: "buffer", bookType: "xlsx" }) as Buffer;
}

// ─── Export: Desvio Deadline ──────────────────────────────────────────────────

export async function exportDesvio(cursoId?: string): Promise<Buffer> {
  const oaFilter = cursoId
    ? { capitulo: { unidade: { cursoId } } }
    : {};

  const etapas = await prisma.etapaOA.findMany({
    where: {
      deadlinePrevisto: { not: null },
      deadlineReal:     { not: null },
      oa:               oaFilter,
    },
    select: {
      deadlinePrevisto: true,
      deadlineReal:     true,
      status:           true,
      responsavel:      { select: { nome: true } },
      etapaDef:         { select: { nome: true } },
      oa: {
        select: {
          codigo: true,
          capitulo: { select: { unidade: { select: { curso: { select: { nome: true } } } } } },
        },
      },
    },
    orderBy: { deadlineReal: "asc" },
  });

  const rows = etapas.map((e) => {
    const prev  = e.deadlinePrevisto!;
    const real  = e.deadlineReal!;
    const desvio = Math.round((real.getTime() - prev.getTime()) / 86_400_000);
    return [
      e.oa.capitulo.unidade.curso.nome,
      e.oa.codigo,
      e.etapaDef.nome,
      e.responsavel?.nome ?? "—",
      fmtDate(prev),
      fmtDate(real),
      desvio,
      desvio > 0 ? "Em atraso" : desvio < 0 ? "Adiantado" : "No prazo",
    ];
  });

  const headers = ["Curso", "OA", "Etapa", "Responsável", "DL Previsto", "DL Real", "Desvio (dias)", "Situação"];
  const ws = XLSX.utils.aoa_to_sheet([headers, ...rows]);
  ws["!cols"] = [{ wch: 30 }, { wch: 16 }, { wch: 24 }, { wch: 22 }, { wch: 14 }, { wch: 14 }, { wch: 14 }, { wch: 14 }];

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Desvio de Deadline");
  return XLSX.write(wb, { type: "buffer", bookType: "xlsx" }) as Buffer;
}

// ─── Mapeamentos de saída ─────────────────────────────────────────────────────

const TIPO_LABEL: Record<string, string> = {
  VIDEO:      "Vídeo",
  SLIDE:      "Slide",
  QUIZ:       "Quiz",
  EBOOK:      "Ebook",
  PLANO_AULA: "Plano de Aula",
  TAREFA:     "Tarefa",
};

const STATUS_ETAPA_LABEL: Record<string, string> = {
  PENDENTE:     "Pendente",
  EM_ANDAMENTO: "Em Andamento",
  CONCLUIDA:    "Concluído",
  BLOQUEADA:    "Bloqueado",
};

function fmtDate(d: Date | null | undefined): string {
  if (!d) return "";
  const day   = String(d.getDate()).padStart(2, "0");
  const month = String(d.getMonth() + 1).padStart(2, "0");
  return `${day}/${month}/${d.getFullYear()}`;
}

function entregaLabel(deadlineReal: Date | null | undefined, deadlinePrevisto: Date | null | undefined): string {
  if (!deadlineReal) return "";
  if (!deadlinePrevisto) return "No prazo";
  return deadlineReal <= deadlinePrevisto ? "No prazo" : "Em atraso";
}

// ─── Definição das colunas (ordem exata da planilha de referência) ─────────────

// Cabeçalho idêntico ao das planilhas de referência (U2+)
const HEADERS = [
  "Unidade",
  "Capítulo",
  "Código do Objeto",
  "Tipo de Objeto",
  "Progresso",
  "% ",                         // espaço intencional (igual ao original)
  "🔗 Objeto",
  // ── Conteudista ────────────────────────────────────────────────────────────
  "Conteudista",
  "Deadline Conteudi",
  "Status Conteudista",
  "Deadline Real",              // data real de entrega do conteudista
  "Entrega Conteudista",        // "No prazo" / "Em atraso"
  // ── DI ─────────────────────────────────────────────────────────────────────
  "DI",
  "Deadline DI",
  "Status DI",
  // ── Prof. Ator / Gravação ──────────────────────────────────────────────────
  "Prof. Ator",
  "Deadline Gravação",
  "Status Gravação",
  // ── Professor Técnico ──────────────────────────────────────────────────────
  "Professor Técnico",
  "Deadline Revisão",
  "Status Revisão",
  // ── Acessibilidade ─────────────────────────────────────────────────────────
  "Produtor Acessi",
  "Deadline Acessibili",
  "Status Acessibilidade",
  // ── Produtor Final ─────────────────────────────────────────────────────────
  "Produtor",
  "Deadline Produtor",
  "Status Produtor",
  // ── Objeto Final + Validação ───────────────────────────────────────────────
  "🔗Objeto Final",
  "Validação Final",
  "Deadline Final",
  "Status Validação Final",
];

const COL_WIDTHS: XLSX.ColInfo[] = [
  { wch: 9  }, // Unidade
  { wch: 9  }, // Capítulo
  { wch: 16 }, // Código do Objeto
  { wch: 14 }, // Tipo de Objeto
  { wch: 12 }, // Progresso
  { wch: 6  }, // %
  { wch: 35 }, // 🔗 Objeto
  { wch: 22 }, // Conteudista
  { wch: 14 }, // Deadline Conteudi
  { wch: 16 }, // Status Conteudista
  { wch: 14 }, // Deadline Real
  { wch: 18 }, // Entrega Conteudista
  { wch: 22 }, // DI
  { wch: 14 }, // Deadline DI
  { wch: 12 }, // Status DI
  { wch: 22 }, // Prof. Ator
  { wch: 14 }, // Deadline Gravação
  { wch: 14 }, // Status Gravação
  { wch: 22 }, // Professor Técnico
  { wch: 14 }, // Deadline Revisão
  { wch: 14 }, // Status Revisão
  { wch: 22 }, // Produtor Acessi
  { wch: 18 }, // Deadline Acessibili
  { wch: 18 }, // Status Acessibilidade
  { wch: 22 }, // Produtor
  { wch: 16 }, // Deadline Produtor
  { wch: 14 }, // Status Produtor
  { wch: 35 }, // 🔗Objeto Final
  { wch: 22 }, // Validação Final
  { wch: 14 }, // Deadline Final
  { wch: 20 }, // Status Validação Final
];

// ─── Exportação ───────────────────────────────────────────────────────────────

export async function exportMC(cursoId: string): Promise<Buffer> {
  // Busca unidades para nomear as abas
  const unidades = await prisma.unidade.findMany({
    where:   { cursoId },
    orderBy: { numero: "asc" },
    select:  { id: true, numero: true, nome: true },
  });

  // Busca todos os OAs com etapas e responsáveis
  const oas = await prisma.objetoAprendizagem.findMany({
    where:   { capitulo: { unidade: { cursoId } } },
    include: {
      capitulo: { include: { unidade: true } },
      etapas:   {
        include:  {
          etapaDef:    true,
          responsavel: { select: { nome: true } },
        },
        orderBy: { ordem: "asc" },
      },
    },
    orderBy: [
      { capitulo: { unidade: { numero: "asc" } } },
      { capitulo: { numero:   "asc" } },
      { numero:   "asc" },
    ],
  });

  // Agrupa OAs por unidade
  const oasPorUnidade = new Map<number, typeof oas>();
  for (const oa of oas) {
    const u = oa.capitulo.unidade.numero;
    if (!oasPorUnidade.has(u)) oasPorUnidade.set(u, []);
    oasPorUnidade.get(u)!.push(oa);
  }

  const wb = XLSX.utils.book_new();

  for (const unidade of unidades) {
    const oasUnidade = oasPorUnidade.get(unidade.numero) ?? [];

    const dataRows = oasUnidade.map((oa) => {
      const byPapel = (papel: string) => oa.etapas.find((e) => e.etapaDef.papel === papel);

      const cont  = byPapel("CONTEUDISTA");
      const di    = byPapel("DESIGNER_INSTRUCIONAL");
      const ator  = byPapel("PROFESSOR_ATOR");
      const tec   = byPapel("PROFESSOR_TECNICO");
      const acess = byPapel("ACESSIBILIDADE");
      const prod  = byPapel("PRODUTOR_FINAL");
      const valid = byPapel("VALIDADOR_FINAL");

      const stLabel = (e: typeof cont) => e ? (STATUS_ETAPA_LABEL[e.status] ?? e.status) : "";

      return [
        oa.capitulo.unidade.numero,
        oa.capitulo.numero,
        oa.codigo,
        TIPO_LABEL[oa.tipo] ?? oa.tipo,
        "",                                           // Progresso (vazio — igual ao original)
        `${oa.progressoPct}%`,
        oa.linkObjeto ?? "",
        // Conteudista
        cont?.responsavel?.nome ?? "",
        fmtDate(cont?.deadlinePrevisto),
        stLabel(cont),
        fmtDate(cont?.deadlineReal),
        entregaLabel(cont?.deadlineReal, cont?.deadlinePrevisto),
        // DI
        di?.responsavel?.nome ?? "",
        fmtDate(di?.deadlinePrevisto),
        stLabel(di),
        // Prof. Ator
        ator?.responsavel?.nome ?? "",
        fmtDate(ator?.deadlinePrevisto),
        stLabel(ator),
        // Professor Técnico
        tec?.responsavel?.nome ?? "",
        fmtDate(tec?.deadlinePrevisto),
        stLabel(tec),
        // Acessibilidade
        acess?.responsavel?.nome ?? "",
        fmtDate(acess?.deadlinePrevisto),
        stLabel(acess),
        // Produtor Final
        prod?.responsavel?.nome ?? "",
        fmtDate(prod?.deadlinePrevisto),
        stLabel(prod),
        // Objeto Final + Validação
        oa.linkObjetoFinal ?? "",
        valid?.responsavel?.nome ?? "",
        fmtDate(valid?.deadlinePrevisto),
        stLabel(valid),
      ];
    });

    const ws = XLSX.utils.aoa_to_sheet([HEADERS, ...dataRows]);
    ws["!cols"] = COL_WIDTHS;

    // Nome da aba: "Unidade N — Nome" (max 31 chars, limite do Excel)
    const sheetName = `Unidade ${unidade.numero}`.slice(0, 31);
    XLSX.utils.book_append_sheet(wb, ws, sheetName);
  }

  // Fallback: se não houver unidades, gera aba vazia
  if (unidades.length === 0) {
    const ws = XLSX.utils.aoa_to_sheet([HEADERS]);
    ws["!cols"] = COL_WIDTHS;
    XLSX.utils.book_append_sheet(wb, ws, "Matriz de Conteúdo");
  }

  return XLSX.write(wb, { type: "buffer", bookType: "xlsx" }) as Buffer;
}
