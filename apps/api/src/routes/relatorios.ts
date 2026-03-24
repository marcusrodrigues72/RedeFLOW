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
    const usuarioId  = req.usuario!.sub;
    const isAdmin    = req.usuario!.papel === "ADMIN";
    const cursosWhere = isAdmin ? {} : { membros: { some: { usuarioId } } };

    const [porStatus, porEtapaDef] = await Promise.all([
      prisma.objetoAprendizagem.groupBy({
        by: ["status"],
        where: { capitulo: { unidade: { curso: cursosWhere } } },
        _count: { id: true },
      }),
      prisma.etapaOA.groupBy({
        by: ["etapaDefId"],
        where: { oa: { capitulo: { unidade: { curso: cursosWhere } } } },
        _count: { id: true },
      }),
    ]);

    const defs = await prisma.etapaDefinicao.findMany({
      select: { id: true, nome: true, ordem: true },
      orderBy: { ordem: "asc" },
    });

    const porEtapa = defs
      .map((d) => ({
        etapa: d.nome,
        ordem: d.ordem,
        total: porEtapaDef.find((e) => e.etapaDefId === d.id)?._count.id ?? 0,
      }))
      .filter((e) => e.total > 0);

    res.json({
      porStatus: porStatus.map((e) => ({ status: e.status, total: e._count.id })),
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

export default router;
