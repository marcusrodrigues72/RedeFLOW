import { Router } from "express";
import { authenticate } from "../middlewares/authenticate.js";
import { prisma } from "../lib/prisma.js";
import { exportAtrasos, exportProgressoCursos, exportDesvio } from "../services/exportService.js";

const router = Router();
router.use(authenticate);

// GET /relatorios/progresso-cursos
router.get("/progresso-cursos", async (req, res, next) => {
  try {
    const usuarioId = req.usuario!.sub;
    const isAdmin   = req.usuario!.papel === "ADMIN";

    // Busca cursos acessíveis
    const cursos = await prisma.curso.findMany({
      where: isAdmin ? {} : { membros: { some: { usuarioId } } },
      select: { id: true, nome: true, codigo: true, status: true },
      orderBy: { nome: "asc" },
    });

    if (cursos.length === 0) { res.json([]); return; }

    const cursoIds = cursos.map((c) => c.id);

    // Uma única query SQL agrega todos os dados por curso
    type AggRow = {
      cursoId:      string;
      total:        bigint;
      concluidos:   bigint;
      atrasados:    bigint;
      minDeadline:  Date | null;
      maxDeadline:  Date | null;
      maxFinal:     Date | null;
    };

    const aggs = await prisma.$queryRaw<AggRow[]>`
      SELECT
        u."cursoId",
        COUNT(DISTINCT oa.id)                                                        AS total,
        COUNT(DISTINCT CASE WHEN oa.status = 'CONCLUIDO'           THEN oa.id END)  AS concluidos,
        COUNT(DISTINCT CASE WHEN e.status IN ('PENDENTE','EM_ANDAMENTO')
                             AND e."deadlinePrevisto" < NOW()       THEN e.id  END)  AS atrasados,
        MIN(e."deadlinePrevisto")                                                    AS "minDeadline",
        MAX(e."deadlinePrevisto")                                                    AS "maxDeadline",
        MAX(oa."deadlineFinal")                                                      AS "maxFinal"
      FROM       "unidades"               u
      JOIN       "capitulos"              c  ON c."unidadeId"  = u.id
      JOIN       "objetos_aprendizagem"   oa ON oa."capituloId" = c.id
      LEFT JOIN  "etapas_oa"             e  ON e."oaId"        = oa.id
      WHERE u."cursoId" = ANY(${cursoIds})
      GROUP BY u."cursoId"
    `;

    const aggMap = new Map(aggs.map((r) => [r.cursoId, r]));

    const result = cursos.map((curso) => {
      const agg       = aggMap.get(curso.id);
      const total     = Number(agg?.total     ?? 0);
      const concluidos = Number(agg?.concluidos ?? 0);
      const atrasados  = Number(agg?.atrasados  ?? 0);
      const dataFim    = agg?.maxFinal ?? agg?.maxDeadline ?? null;

      return {
        ...curso,
        totalOAs:           total,
        oasConcluidos:      concluidos,
        oasAtrasados:       atrasados,
        progressoPct:       total > 0 ? Math.round((concluidos / total) * 100) : 0,
        dataInicioEstimada: agg?.minDeadline?.toISOString() ?? null,
        dataFimEstimada:    dataFim?.toISOString()          ?? null,
      };
    });

    res.json(result);
  } catch (err) { next(err); }
});

// GET /relatorios/pipeline-status?cursoId=
router.get("/pipeline-status", async (req, res, next) => {
  try {
    const usuarioId   = req.usuario!.sub;
    const isAdmin     = req.usuario!.papel === "ADMIN";
    const { cursoId } = req.query as { cursoId?: string };

    // Monta filtro de OAs acessíveis
    let oaWhere: object;
    if (cursoId) {
      // Verifica acesso ao curso e filtra por ele
      const curso = await prisma.curso.findFirst({
        where: { id: cursoId, ...(isAdmin ? {} : { membros: { some: { usuarioId } } }) },
        select: { id: true },
      });
      if (!curso) { res.status(404).json({ message: "Curso não encontrado." }); return; }
      oaWhere = { capitulo: { unidade: { cursoId } } };
    } else {
      const cursosWhere = isAdmin ? {} : { membros: { some: { usuarioId } } };
      oaWhere = { capitulo: { unidade: { curso: cursosWhere } } };
    }

    // Prisma groupBy não suporta relation filters no where — busca IDs primeiro
    const oaIds = await prisma.objetoAprendizagem
      .findMany({ where: oaWhere, select: { id: true } })
      .then((rows) => rows.map((r) => r.id));

    if (oaIds.length === 0) {
      res.json({ porStatusOA: [], porEtapa: [] });
      return;
    }

    const [porStatusOA, porEtapaStatus, defs] = await Promise.all([
      prisma.objetoAprendizagem.groupBy({
        by:    ["status"],
        where: { id: { in: oaIds } },
        _count: { id: true },
      }),
      prisma.etapaOA.groupBy({
        by:    ["etapaDefId", "status"],
        where: { oaId: { in: oaIds } },
        _count: { id: true },
      }),
      prisma.etapaDefinicao.findMany({
        where:   { ativo: true },
        select:  { id: true, nome: true, papel: true, ordem: true },
        orderBy: { ordem: "asc" },
      }),
    ]);

    // Agrupa por nome (pode haver múltiplas defs com mesmo nome para diferentes tipoOA)
    const byNome = new Map<string, { etapa: string; papel: string; ordem: number; pendente: number; emAndamento: number; concluida: number; bloqueada: number }>();
    for (const d of defs) {
      if (!byNome.has(d.nome)) {
        byNome.set(d.nome, { etapa: d.nome, papel: d.papel, ordem: d.ordem, pendente: 0, emAndamento: 0, concluida: 0, bloqueada: 0 });
      }
      const entry = byNome.get(d.nome)!;
      const rows  = porEtapaStatus.filter((r) => r.etapaDefId === d.id);
      const get   = (st: string) => rows.find((r) => r.status === st)?._count.id ?? 0;
      entry.pendente    += get("PENDENTE");
      entry.emAndamento += get("EM_ANDAMENTO");
      entry.concluida   += get("CONCLUIDA");
      entry.bloqueada   += get("BLOQUEADA");
      if (d.ordem < entry.ordem) entry.ordem = d.ordem;
    }

    const porEtapa = Array.from(byNome.values())
      .map((e) => ({ ...e, total: e.pendente + e.emAndamento + e.concluida + e.bloqueada }))
      .filter((e) => e.total > 0)
      .sort((a, b) => a.ordem - b.ordem);

    res.json({
      porStatusOA: porStatusOA.map((e) => ({ status: e.status, total: e._count.id })),
      porEtapa,
    });
  } catch (err) { next(err); }
});

// GET /relatorios/atrasos-responsavel?cursoId=
router.get("/atrasos-responsavel", async (req, res, next) => {
  try {
    const usuarioId   = req.usuario!.sub;
    const isAdmin     = req.usuario!.papel === "ADMIN";
    const { cursoId } = req.query as { cursoId?: string };

    let oaFilter: object;
    if (cursoId) {
      oaFilter = { capitulo: { unidade: { cursoId } } };
    } else {
      const cursosWhere = isAdmin ? {} : { membros: { some: { usuarioId } } };
      oaFilter = { capitulo: { unidade: { curso: cursosWhere } } };
    }

    const etapas = await prisma.etapaOA.findMany({
      where: {
        status: { in: ["PENDENTE", "EM_ANDAMENTO"] },
        deadlinePrevisto: { lt: new Date() },
        responsavelId: { not: null },
        oa: oaFilter,
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

// GET /relatorios/burndown?cursoId=xxx
router.get("/burndown", async (req, res, next) => {
  try {
    const { cursoId } = req.query as { cursoId?: string };
    if (!cursoId) { res.status(400).json({ message: "cursoId é obrigatório." }); return; }

    const usuarioId = req.usuario!.sub;
    const isAdmin   = req.usuario!.papel === "ADMIN";

    const curso = await prisma.curso.findFirst({
      where: {
        id: cursoId,
        ...(isAdmin ? {} : { membros: { some: { usuarioId } } }),
      },
      select: { id: true, nome: true, dataInicio: true, dataFim: true },
    });
    if (!curso) { res.status(404).json({ message: "Curso não encontrado." }); return; }

    // OAs com deadlineFinal e etapas (para calcular data real de conclusão)
    const oas = await prisma.objetoAprendizagem.findMany({
      where: { capitulo: { unidade: { cursoId } } },
      select: {
        deadlineFinal: true,
        status:        true,
        etapas: {
          select: { deadlineReal: true },
          where:  { deadlineReal: { not: null } },
        },
      },
    });

    const totalOAs = oas.length;
    if (totalOAs === 0) {
      res.json({ cursoId, cursoNome: curso.nome, dataInicio: null, dataFim: null, totalOAs: 0, series: [] });
      return;
    }

    // Para cada OA concluído: data real = max(deadlineReal) entre suas etapas
    const oaData = oas.map((oa) => ({
      deadlineFinal: oa.deadlineFinal,
      completedAt:   oa.status === "CONCLUIDO"
        ? oa.etapas.reduce<Date | null>(
            (max, e) => e.deadlineReal && (!max || e.deadlineReal > max) ? e.deadlineReal : max,
            null,
          )
        : null,
    }));

    const hoje = new Date();
    hoje.setHours(0, 0, 0, 0);

    // Intervalo do burndown
    const deadlines = oaData.filter((o) => o.deadlineFinal).map((o) => o.deadlineFinal!.getTime());
    const startDate = new Date(curso.dataInicio?.getTime() ?? Math.min(...deadlines));
    const endDate   = new Date(curso.dataFim?.getTime()   ?? Math.max(...deadlines));
    startDate.setHours(0, 0, 0, 0);
    endDate.setHours(0, 0, 0, 0);

    const totalDays = Math.max(1, (endDate.getTime() - startDate.getTime()) / 86_400_000);
    const lastPoint = new Date(Math.max(endDate.getTime(), hoje.getTime()));

    // Gera pontos semanais (+ ponto inicial e final)
    const points: Date[] = [new Date(startDate)];
    const cur = new Date(startDate);
    cur.setDate(cur.getDate() + 7);
    while (cur <= lastPoint) {
      points.push(new Date(cur));
      cur.setDate(cur.getDate() + 7);
    }
    const lastAdded = points[points.length - 1];
    if (lastAdded && lastAdded.getTime() < lastPoint.getTime()) {
      points.push(new Date(lastPoint));
    }

    const series = points.map((date) => {
      const daysElapsed = (date.getTime() - startDate.getTime()) / 86_400_000;
      const planejado   = Math.max(0, Math.round(totalOAs * (1 - daysElapsed / totalDays)));

      let realizado: number | null = null;
      if (date <= hoje) {
        const done = oaData.filter((o) => o.completedAt && o.completedAt <= date).length;
        realizado  = totalOAs - done;
      }

      return { data: date.toISOString().slice(0, 10), planejado, realizado };
    });

    res.json({ cursoId, cursoNome: curso.nome,
      dataInicio: startDate.toISOString().slice(0, 10),
      dataFim:    endDate.toISOString().slice(0, 10),
      totalOAs, series,
    });
  } catch (err) { next(err); }
});

// GET /relatorios/desvio-deadline?cursoId=
router.get("/desvio-deadline", async (req, res, next) => {
  try {
    const usuarioId   = req.usuario!.sub;
    const isAdmin     = req.usuario!.papel === "ADMIN";
    const { cursoId } = req.query as { cursoId?: string };

    let oaFilter: object;
    if (cursoId) {
      const curso = await prisma.curso.findFirst({
        where: { id: cursoId, ...(isAdmin ? {} : { membros: { some: { usuarioId } } }) },
        select: { id: true },
      });
      if (!curso) { res.status(404).json({ message: "Curso não encontrado." }); return; }
      oaFilter = { capitulo: { unidade: { cursoId } } };
    } else {
      const cursosWhere = isAdmin ? {} : { membros: { some: { usuarioId } } };
      oaFilter = { capitulo: { unidade: { curso: cursosWhere } } };
    }

    const etapas = await prisma.etapaOA.findMany({
      where: { deadlinePrevisto: { not: null }, deadlineReal: { not: null }, oa: oaFilter },
      select: {
        deadlinePrevisto: true,
        deadlineReal:     true,
        etapaDef:         { select: { nome: true, papel: true } },
        responsavel:      { select: { nome: true } },
        oa:               { select: { id: true, codigo: true } },
      },
      orderBy: { deadlineReal: "asc" },
    });

    const items = etapas.map((e) => {
      const prev   = e.deadlinePrevisto!;
      const real   = e.deadlineReal!;
      const desvio = Math.round((real.getTime() - prev.getTime()) / 86_400_000);
      return {
        oaId:             e.oa.id,
        oaCodigo:         e.oa.codigo,
        etapa:            e.etapaDef.nome,
        responsavel:      e.responsavel?.nome ?? null,
        deadlinePrevisto: prev.toISOString(),
        deadlineReal:     real.toISOString(),
        desvioDias:       desvio,
      };
    });

    // Resumo por etapa
    const porEtapa = new Map<string, { etapa: string; total: number; noP: number; adiant: number; atrasado: number; desvioMedio: number; soma: number }>();
    for (const it of items) {
      if (!porEtapa.has(it.etapa)) porEtapa.set(it.etapa, { etapa: it.etapa, total: 0, noP: 0, adiant: 0, atrasado: 0, desvioMedio: 0, soma: 0 });
      const e = porEtapa.get(it.etapa)!;
      e.total++;
      e.soma += it.desvioDias;
      if (it.desvioDias > 0) e.atrasado++;
      else if (it.desvioDias < 0) e.adiant++;
      else e.noP++;
    }
    const resumo = Array.from(porEtapa.values()).map((e) => ({
      etapa: e.etapa, total: e.total, noPrazo: e.noP, adiantado: e.adiant, atrasado: e.atrasado,
      desvioMedio: e.total > 0 ? Math.round(e.soma / e.total) : 0,
    }));

    res.json({ items, resumo });
  } catch (err) { next(err); }
});

// GET /relatorios/progresso-unidades?cursoId=
router.get("/progresso-unidades", async (req, res, next) => {
  try {
    const usuarioId   = req.usuario!.sub;
    const isAdmin     = req.usuario!.papel === "ADMIN";
    const { cursoId } = req.query as { cursoId?: string };

    if (!cursoId) {
      res.status(400).json({ message: "cursoId é obrigatório." });
      return;
    }

    // Verifica acesso ao curso
    const curso = await prisma.curso.findFirst({
      where: { id: cursoId, ...(isAdmin ? {} : { membros: { some: { usuarioId } } }) },
      select: { id: true },
    });
    if (!curso) { res.status(404).json({ message: "Curso não encontrado." }); return; }

    type AggRow = {
      unidadeNumero: number;
      unidadeNome:   string;
      capituloNumero: number;
      capituloNome:  string;
      total:         bigint;
      concluidos:    bigint;
      atrasados:     bigint;
    };

    const rows = await prisma.$queryRaw<AggRow[]>`
      SELECT
        u.numero               AS "unidadeNumero",
        u.nome                 AS "unidadeNome",
        c.numero               AS "capituloNumero",
        c.nome                 AS "capituloNome",
        COUNT(DISTINCT oa.id)                                                        AS total,
        COUNT(DISTINCT CASE WHEN oa.status = 'CONCLUIDO'           THEN oa.id END)  AS concluidos,
        COUNT(DISTINCT CASE WHEN e.status IN ('PENDENTE','EM_ANDAMENTO')
                             AND e."deadlinePrevisto" < NOW()       THEN e.id  END)  AS atrasados
      FROM      "unidades"             u
      JOIN      "capitulos"            c  ON c."unidadeId"  = u.id
      JOIN      "objetos_aprendizagem" oa ON oa."capituloId" = c.id
      LEFT JOIN "etapas_oa"            e  ON e."oaId"        = oa.id
      WHERE u."cursoId" = ${cursoId}
      GROUP BY u.id, u.numero, u.nome, c.id, c.numero, c.nome
      ORDER BY u.numero, c.numero
    `;

    // Agrupa capítulos por unidade
    const unidadeMap = new Map<number, {
      numero: number; nome: string;
      totalOAs: number; concluidos: number; atrasados: number;
      capitulos: { numero: number; nome: string; totalOAs: number; concluidos: number; atrasados: number; progressoPct: number }[];
    }>();

    for (const row of rows) {
      if (!unidadeMap.has(row.unidadeNumero)) {
        unidadeMap.set(row.unidadeNumero, {
          numero: row.unidadeNumero, nome: row.unidadeNome,
          totalOAs: 0, concluidos: 0, atrasados: 0, capitulos: [],
        });
      }
      const u   = unidadeMap.get(row.unidadeNumero)!;
      const tot = Number(row.total);
      const con = Number(row.concluidos);
      const atr = Number(row.atrasados);
      u.totalOAs   += tot;
      u.concluidos += con;
      u.atrasados  += atr;
      u.capitulos.push({
        numero: row.capituloNumero, nome: row.capituloNome,
        totalOAs: tot, concluidos: con, atrasados: atr,
        progressoPct: tot > 0 ? Math.round((con / tot) * 100) : 0,
      });
    }

    const result = Array.from(unidadeMap.values()).map((u) => ({
      ...u,
      progressoPct: u.totalOAs > 0 ? Math.round((u.concluidos / u.totalOAs) * 100) : 0,
    }));

    res.json(result);
  } catch (err) { next(err); }
});

// GET /relatorios/export/atrasos?cursoId=
router.get("/export/atrasos", async (req, res, next) => {
  try {
    const { cursoId } = req.query as { cursoId?: string };
    const buf = await exportAtrasos(cursoId);
    res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    res.setHeader("Content-Disposition", "attachment; filename=\"atrasos.xlsx\"");
    res.send(buf);
  } catch (err) { next(err); }
});

// GET /relatorios/export/progresso?cursoId=
router.get("/export/progresso", async (req, res, next) => {
  try {
    const { cursoId } = req.query as { cursoId?: string };
    const buf = await exportProgressoCursos(cursoId);
    res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    res.setHeader("Content-Disposition", "attachment; filename=\"progresso-cursos.xlsx\"");
    res.send(buf);
  } catch (err) { next(err); }
});

// GET /relatorios/export/desvio?cursoId=
router.get("/export/desvio", async (req, res, next) => {
  try {
    const { cursoId } = req.query as { cursoId?: string };
    const buf = await exportDesvio(cursoId);
    res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    res.setHeader("Content-Disposition", "attachment; filename=\"desvio-deadline.xlsx\"");
    res.send(buf);
  } catch (err) { next(err); }
});

export default router;
