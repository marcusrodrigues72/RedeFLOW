import { Router } from "express";
import { authenticate } from "../middlewares/authenticate.js";
import { prisma } from "../lib/prisma.js";

const router = Router();
router.use(authenticate);

// GET /relatorios/progresso-cursos
router.get("/progresso-cursos", async (req, res, next) => {
  try {
    const usuarioId  = req.usuario!.sub;
    const isAdmin    = req.usuario!.papel === "ADMIN";
    const cursosWhere = isAdmin ? {} : { membros: { some: { usuarioId } } };

    const cursos = await prisma.curso.findMany({
      where: cursosWhere,
      select: { id: true, nome: true, codigo: true, status: true },
      orderBy: { nome: "asc" },
    });

    const result = await Promise.all(cursos.map(async (curso) => {
      const oaWhere    = { capitulo: { unidade: { cursoId: curso.id } } };
      const etapaWhere = { oa: { capitulo: { unidade: { cursoId: curso.id } } } };

      const [total, concluidos, atrasados, minEtapa, maxOA] = await Promise.all([
        prisma.objetoAprendizagem.count({ where: oaWhere }),
        prisma.objetoAprendizagem.count({ where: { status: "CONCLUIDO", ...oaWhere } }),
        prisma.etapaOA.count({
          where: {
            status: { in: ["PENDENTE", "EM_ANDAMENTO"] },
            deadlinePrevisto: { lt: new Date() },
            ...etapaWhere,
          },
        }),
        prisma.etapaOA.aggregate({
          where: { deadlinePrevisto: { not: null }, ...etapaWhere },
          _min:  { deadlinePrevisto: true },
        }),
        prisma.objetoAprendizagem.aggregate({
          where: { deadlineFinal: { not: null }, ...oaWhere },
          _max:  { deadlineFinal: true },
        }),
      ]);

      return {
        ...curso,
        totalOAs:            total,
        oasConcluidos:       concluidos,
        oasAtrasados:        atrasados,
        progressoPct:        total > 0 ? Math.round((concluidos / total) * 100) : 0,
        dataInicioEstimada:  minEtapa._min.deadlinePrevisto?.toISOString() ?? null,
        dataFimEstimada:     maxOA._max.deadlineFinal?.toISOString()       ?? null,
      };
    }));

    res.json(result);
  } catch (err) { next(err); }
});

// GET /relatorios/pipeline-status
router.get("/pipeline-status", async (req, res, next) => {
  try {
    const usuarioId   = req.usuario!.sub;
    const isAdmin     = req.usuario!.papel === "ADMIN";
    const cursosWhere = isAdmin ? {} : { membros: { some: { usuarioId } } };
    const oaWhere     = { capitulo: { unidade: { curso: cursosWhere } } };

    const [porStatusOA, porEtapaStatus, defs] = await Promise.all([
      // Status dos OAs (nível de OA)
      prisma.objetoAprendizagem.groupBy({
        by:    ["status"],
        where: oaWhere,
        _count: { id: true },
      }),
      // Status de cada instância de etapa, agrupado por (etapaDefId, status)
      prisma.etapaOA.groupBy({
        by:    ["etapaDefId", "status"],
        where: { oa: oaWhere },
        _count: { id: true },
      }),
      prisma.etapaDefinicao.findMany({
        where:   { ativo: true },
        select:  { id: true, nome: true, papel: true, ordem: true },
        orderBy: { ordem: "asc" },
      }),
    ]);

    const porEtapa = defs
      .map((d) => {
        const rows       = porEtapaStatus.filter((r) => r.etapaDefId === d.id);
        const get        = (st: string) => rows.find((r) => r.status === st)?._count.id ?? 0;
        const pendente   = get("PENDENTE");
        const emAndamento = get("EM_ANDAMENTO");
        const concluida  = get("CONCLUIDA");
        const bloqueada  = get("BLOQUEADA");
        return { etapa: d.nome, papel: d.papel, ordem: d.ordem, pendente, emAndamento, concluida, bloqueada, total: pendente + emAndamento + concluida + bloqueada };
      })
      .filter((e) => e.total > 0);

    res.json({
      porStatusOA: porStatusOA.map((e) => ({ status: e.status, total: e._count.id })),
      porEtapa,
    });
  } catch (err) { next(err); }
});

// GET /relatorios/atrasos-responsavel
router.get("/atrasos-responsavel", async (req, res, next) => {
  try {
    const usuarioId  = req.usuario!.sub;
    const isAdmin    = req.usuario!.papel === "ADMIN";
    const cursosWhere = isAdmin ? {} : { membros: { some: { usuarioId } } };

    const etapas = await prisma.etapaOA.findMany({
      where: {
        status: { in: ["PENDENTE", "EM_ANDAMENTO"] },
        deadlinePrevisto: { lt: new Date() },
        responsavelId: { not: null },
        oa: { capitulo: { unidade: { curso: cursosWhere } } },
      },
      select: {
        responsavelId:   true,
        deadlinePrevisto: true,
        responsavel: { select: { id: true, nome: true, email: true } },
        etapaDef:    { select: { nome: true } },
        oa:          { select: { codigo: true } },
      },
    });

    const map = new Map<string, { nome: string; email: string; total: number; detalhes: { oa: string; etapa: string; diasAtraso: number }[] }>();
    const hoje = new Date();

    for (const e of etapas) {
      if (!e.responsavel || !e.deadlinePrevisto) continue;
      const key = e.responsavelId!;
      if (!map.has(key)) {
        map.set(key, { nome: e.responsavel.nome, email: e.responsavel.email, total: 0, detalhes: [] });
      }
      const entry = map.get(key)!;
      entry.total++;
      entry.detalhes.push({
        oa:         e.oa.codigo,
        etapa:      e.etapaDef.nome,
        diasAtraso: Math.ceil((hoje.getTime() - new Date(e.deadlinePrevisto).getTime()) / 86_400_000),
      });
    }

    res.json(Array.from(map.values()).sort((a, b) => b.total - a.total));
  } catch (err) { next(err); }
});

// GET /relatorios/alocacao
router.get("/alocacao", async (req, res, next) => {
  try {
    const usuarioId   = req.usuario!.sub;
    const isAdmin     = req.usuario!.papel === "ADMIN";
    const cursosWhere = isAdmin ? {} : { membros: { some: { usuarioId } } };
    const oaFilter    = { capitulo: { unidade: { curso: cursosWhere } } };

    const PAPEL_LABEL: Record<string, string> = {
      CONTEUDISTA:           "Conteudista",
      DESIGNER_INSTRUCIONAL: "Designer Instrucional",
      PROFESSOR_ATOR:        "Prof. Ator",
      PROFESSOR_TECNICO:     "Revisor Técnico",
      ACESSIBILIDADE:        "Acessibilidade",
      PRODUTOR_FINAL:        "Produtor Final",
      VALIDADOR_FINAL:       "Validador Final",
    };

    // ── Carga por papel ────────────────────────────────────────────────────────
    const porPapelRaw = await prisma.etapaOA.groupBy({
      by:    ["status"],
      where: {
        status:        { in: ["PENDENTE", "EM_ANDAMENTO"] },
        oa:            oaFilter,
        responsavelId: { not: null },
      },
      _count: { id: true },
    });

    // Busca por etapaDefId + status para calcular por papel
    const porPapelDef = await prisma.etapaOA.groupBy({
      by:    ["etapaDefId", "status"],
      where: {
        status:        { in: ["PENDENTE", "EM_ANDAMENTO"] },
        oa:            oaFilter,
        responsavelId: { not: null },
      },
      _count: { id: true },
    });

    const etapasDef = await prisma.etapaDefinicao.findMany({
      where:   { ativo: true },
      select:  { id: true, papel: true, ordem: true },
      orderBy: { ordem: "asc" },
    });

    // Agrega por papel (pode haver múltiplas EtapaDefinicao com o mesmo papel)
    const papelMap = new Map<string, { emAndamento: number; pendente: number }>();
    for (const d of etapasDef) {
      if (!papelMap.has(d.papel)) papelMap.set(d.papel, { emAndamento: 0, pendente: 0 });
      const rows = porPapelDef.filter((r) => r.etapaDefId === d.id);
      const entry = papelMap.get(d.papel)!;
      entry.emAndamento += rows.find((r) => r.status === "EM_ANDAMENTO")?._count.id ?? 0;
      entry.pendente    += rows.find((r) => r.status === "PENDENTE")?._count.id    ?? 0;
    }

    const papelOrder = ["CONTEUDISTA","DESIGNER_INSTRUCIONAL","PROFESSOR_ATOR","PROFESSOR_TECNICO","ACESSIBILIDADE","PRODUTOR_FINAL","VALIDADOR_FINAL"];
    const porPapel = papelOrder
      .filter((p) => papelMap.has(p))
      .map((p) => ({ papel: p, label: PAPEL_LABEL[p] ?? p, ...papelMap.get(p)! }));

    // ── Carga por responsável ──────────────────────────────────────────────────
    const etapasAtivas = await prisma.etapaOA.findMany({
      where: {
        status:        { in: ["PENDENTE", "EM_ANDAMENTO"] },
        responsavelId: { not: null },
        oa:            oaFilter,
      },
      select: {
        id:               true,
        oaId:             true,
        status:           true,
        deadlinePrevisto: true,
        ordem:            true,
        responsavelId:    true,
        responsavel:      { select: { id: true, nome: true, email: true, fotoUrl: true } },
        etapaDef:         { select: { nome: true, papel: true } },
        oa: {
          select: {
            codigo: true,
            etapas: {
              select: { ordem: true, deadlinePrevisto: true },
              orderBy: { ordem: "asc" },
            },
            capitulo: { select: { unidade: { select: { curso: { select: { codigo: true } } } } } },
          },
        },
      },
      orderBy: { deadlinePrevisto: "asc" },
    });

    const respMap = new Map<string, {
      usuarioId: string; nome: string; email: string; fotoUrl: string | null;
      emAndamento: number; pendente: number;
      etapas: {
        etapaId: string; oaId: string; oaCodigo: string; etapaNome: string; papel: string;
        deadlinePrevisto: string | null; deadlineInicio: string | null;
        status: string; cursoCodigo: string;
      }[];
    }>();

    for (const e of etapasAtivas) {
      if (!e.responsavel) continue;
      const rid = e.responsavelId!;
      if (!respMap.has(rid)) {
        respMap.set(rid, {
          usuarioId: rid, nome: e.responsavel.nome, email: e.responsavel.email,
          fotoUrl: e.responsavel.fotoUrl, emAndamento: 0, pendente: 0, etapas: [],
        });
      }
      const entry = respMap.get(rid)!;
      if (e.status === "EM_ANDAMENTO") entry.emAndamento++;
      else                             entry.pendente++;

      // Estima data de início como deadline da etapa anterior no mesmo OA
      const etapasOA   = e.oa.etapas;
      const etapaAntes = etapasOA.find((x) => x.ordem === e.ordem - 1);
      const inicio     = etapaAntes?.deadlinePrevisto?.toISOString() ?? null;

      entry.etapas.push({
        etapaId:          e.id,
        oaId:             e.oaId,
        oaCodigo:         e.oa.codigo,
        etapaNome:        e.etapaDef.nome,
        papel:            e.etapaDef.papel,
        deadlinePrevisto: e.deadlinePrevisto?.toISOString() ?? null,
        deadlineInicio:   inicio,
        status:           e.status,
        cursoCodigo:      e.oa.capitulo.unidade.curso.codigo,
      });
    }

    const porResponsavel = Array.from(respMap.values())
      .sort((a, b) => (b.emAndamento + b.pendente) - (a.emAndamento + a.pendente));

    res.json({ porPapel, porResponsavel });
  } catch (err) { next(err); }
});

export default router;
