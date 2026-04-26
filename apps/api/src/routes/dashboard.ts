import { Router } from "express";
import { authenticate } from "../middlewares/authenticate.js";
import { prisma } from "../lib/prisma.js";

const router = Router();
router.use(authenticate);

router.get("/stats", async (req, res, next) => {
  try {
    const usuarioId  = req.usuario!.sub;
    const isAdmin    = req.usuario!.papel === "ADMIN";

    // Cursos acessíveis ao usuário
    const cursosWhere = isAdmin
      ? {}
      : { membros: { some: { usuarioId } } };

    const [
      totalCursos,
      cursosAtivos,
      totalOAs,
      oasConcluidos,
      oasAtrasados,
      oasBloqueados,
    ] = await Promise.all([
      prisma.curso.count({ where: cursosWhere }),
      prisma.curso.count({ where: { ...cursosWhere, status: "ATIVO" } }),
      prisma.objetoAprendizagem.count({
        where: { capitulo: { unidade: { curso: cursosWhere } } },
      }),
      prisma.objetoAprendizagem.count({
        where: { status: "CONCLUIDO", capitulo: { unidade: { curso: cursosWhere } } },
      }),
      prisma.etapaOA.count({
        where: {
          status: { in: ["PENDENTE", "EM_ANDAMENTO"] },
          deadlinePrevisto: { lt: new Date() },
          oa: { capitulo: { unidade: { curso: cursosWhere } } },
        },
      }),
      prisma.objetoAprendizagem.count({
        where: { status: "BLOQUEADO", capitulo: { unidade: { curso: cursosWhere } } },
      }),
    ]);

    res.json({
      totalCursos,
      cursosAtivos,
      totalOAs,
      oasConcluidos,
      progressoPct: totalOAs > 0 ? Math.round((oasConcluidos / totalOAs) * 100) : 0,
      oasAtrasados,
      oasBloqueados,
      emProducao: totalOAs - oasConcluidos,
    });
  } catch (err) {
    next(err);
  }
});

// GET /dashboard/detalhe?tipo=em_producao|concluidos|atrasos|cursos
router.get("/detalhe", async (req, res, next) => {
  try {
    const usuarioId   = req.usuario!.sub;
    const isAdmin     = req.usuario!.papel === "ADMIN";
    const cursosWhere = isAdmin ? {} : { membros: { some: { usuarioId } } };
    const tipo        = (req.query["tipo"] as string) ?? "em_producao";

    if (tipo === "atrasos") {
      const etapas = await prisma.etapaOA.findMany({
        where: {
          status:          { in: ["PENDENTE", "EM_ANDAMENTO"] },
          deadlinePrevisto: { lt: new Date() },
          oa: { capitulo: { unidade: { curso: cursosWhere } } },
        },
        select: {
          deadlinePrevisto: true,
          responsavel:      { select: { nome: true } },
          etapaDef:         { select: { nome: true } },
          oa: {
            select: {
              id: true, codigo: true,
              capitulo: {
                select: {
                  nome: true,
                  unidade: {
                    select: {
                      nome: true,
                      curso: { select: { id: true, nome: true } },
                    },
                  },
                },
              },
            },
          },
        },
        orderBy: { deadlinePrevisto: "asc" },
        take: 100,
      });

      const hoje = new Date();
      return res.json(etapas.map((e) => ({
        oaId:             e.oa.id,
        oaCodigo:         e.oa.codigo,
        etapa:            e.etapaDef.nome,
        responsavel:      e.responsavel?.nome ?? null,
        diasAtraso:       Math.ceil((hoje.getTime() - new Date(e.deadlinePrevisto!).getTime()) / 86_400_000),
        deadlinePrevisto: e.deadlinePrevisto!.toISOString(),
        curso:            { id: e.oa.capitulo.unidade.curso.id, nome: e.oa.capitulo.unidade.curso.nome },
        unidade:          { nome: e.oa.capitulo.unidade.nome },
        capitulo:         { nome: e.oa.capitulo.nome },
      })));
    }

    // em_producao | concluidos | cursos | bloqueados
    const statusFilter =
      tipo === "concluidos"   ? { status: "CONCLUIDO"                                                                                        as const } :
      tipo === "em_producao"  ? { status: { in: ["PENDENTE", "EM_ANDAMENTO", "BLOQUEADO"] as ("PENDENTE" | "EM_ANDAMENTO" | "BLOQUEADO")[] } }         :
      tipo === "bloqueados"   ? { status: "BLOQUEADO"                                                                                        as const } :
      {};

    const oas = await prisma.objetoAprendizagem.findMany({
      where: { ...statusFilter, capitulo: { unidade: { curso: cursosWhere } } },
      select: {
        id: true, codigo: true, tipo: true, status: true,
        progressoPct: true, deadlineFinal: true,
        capitulo: {
          select: {
            nome: true,
            unidade: {
              select: {
                nome: true,
                curso: { select: { id: true, nome: true, codigo: true } },
              },
            },
          },
        },
        etapas: {
          where:   { status: { in: ["EM_ANDAMENTO", "PENDENTE"] } },
          select:  { etapaDef: { select: { nome: true } }, responsavel: { select: { nome: true } }, deadlinePrevisto: true },
          orderBy: { ordem: "asc" },
          take:    1,
        },
      },
      orderBy: [{ status: "asc" }, { codigo: "asc" }],
      take: 200,
    });

    res.json(oas.map((oa) => ({
      id:           oa.id,
      codigo:       oa.codigo,
      tipo:         oa.tipo,
      status:       oa.status,
      progressoPct: oa.progressoPct,
      deadlineFinal:oa.deadlineFinal?.toISOString() ?? null,
      curso:        { id: oa.capitulo.unidade.curso.id, nome: oa.capitulo.unidade.curso.nome, codigo: oa.capitulo.unidade.curso.codigo },
      unidade:      { nome: oa.capitulo.unidade.nome },
      capitulo:     { nome: oa.capitulo.nome },
      etapaAtual:   oa.etapas[0]
        ? { nome: oa.etapas[0].etapaDef.nome, responsavel: oa.etapas[0].responsavel?.nome ?? null, deadlinePrevisto: oa.etapas[0].deadlinePrevisto?.toISOString() ?? null }
        : null,
    })));
  } catch (err) { next(err); }
});

// GET /dashboard/proximas-entregas?dias=14
router.get("/proximas-entregas", async (req, res, next) => {
  try {
    const usuarioId   = req.usuario!.sub;
    const isAdmin     = req.usuario!.papel === "ADMIN";
    const cursosWhere = isAdmin ? {} : { membros: { some: { usuarioId } } };
    const dias        = Math.min(parseInt((req.query["dias"] as string) ?? "14", 10) || 14, 60);

    const hoje  = new Date();
    hoje.setHours(0, 0, 0, 0);
    const limite = new Date(hoje);
    limite.setDate(limite.getDate() + dias);

    const etapas = await prisma.etapaOA.findMany({
      where: {
        status:          { in: ["PENDENTE", "EM_ANDAMENTO"] },
        deadlinePrevisto: { gte: hoje, lte: limite },
        oa: { capitulo: { unidade: { curso: cursosWhere } } },
      },
      select: {
        id:               true,
        deadlinePrevisto: true,
        etapaDef:         { select: { nome: true } },
        responsavel:      { select: { nome: true, fotoUrl: true } },
        oa: {
          select: {
            id:   true,
            codigo: true,
            capitulo: {
              select: {
                unidade: {
                  select: { curso: { select: { id: true, nome: true } } },
                },
              },
            },
          },
        },
      },
      orderBy: { deadlinePrevisto: "asc" },
      take: 30,
    });

    const result = etapas.map((e) => {
      const dl = e.deadlinePrevisto!;
      const diasRestantes = Math.ceil((dl.getTime() - hoje.getTime()) / 86_400_000);
      return {
        etapaId:             e.id,
        oaId:                e.oa.id,
        oaCodigo:            e.oa.codigo,
        etapaNome:           e.etapaDef.nome,
        responsavelNome:     e.responsavel?.nome     ?? null,
        responsavelFotoUrl:  e.responsavel?.fotoUrl  ?? null,
        deadlinePrevisto:    dl.toISOString(),
        diasRestantes,
        cursoId:   e.oa.capitulo.unidade.curso.id,
        cursoNome: e.oa.capitulo.unidade.curso.nome,
      };
    });

    res.json(result);
  } catch (err) { next(err); }
});

export default router;
