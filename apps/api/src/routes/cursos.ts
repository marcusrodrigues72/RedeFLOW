import { Router } from "express";
import { CursoController } from "../controllers/cursoController.js";
import { OAController }    from "../controllers/oaController.js";
import { authenticate }    from "../middlewares/authenticate.js";
import { uploadExcel }     from "../middlewares/upload.js";
import { prisma }          from "../lib/prisma.js";
import { exportMC }        from "../services/exportService.js";
import { persistMI }       from "../services/importService.js";
import type { MICapitulo } from "../services/importService.js";
import { z }               from "zod";

const router   = Router();
const ctrl     = new CursoController();
const oaCtrl   = new OAController();

router.use(authenticate);

router.get("/",    ctrl.listar);

// ── Criar curso via MI (sem cursoId pré-existente) — deve vir ANTES de /:id ──
router.post("/novo-via-mi/preview",   uploadExcel, ctrl.importarMIPreview);
router.post("/novo-via-mi/confirmar", uploadExcel, ctrl.importarMINovoCurso);

router.get("/:id", ctrl.buscar);
router.post("/",   ctrl.criar);
router.patch("/:id", async (req, res, next) => {
  try {
    const cursoId = req.params["id"] as string;
    const usuario = await prisma.usuario.findUnique({ where: { id: req.usuario!.sub }, select: { papelGlobal: true } });
    if (usuario?.papelGlobal !== "ADMIN") {
      const membro = await prisma.cursoMembro.findUnique({ where: { cursoId_usuarioId: { cursoId, usuarioId: req.usuario!.sub } } });
      if (membro?.papel !== "ADMIN") { res.status(403).json({ message: "Apenas administradores podem editar o curso." }); return; }
    }
    return ctrl.atualizar(req, res, next);
  } catch (err) { next(err); }
});
router.delete("/:id", async (req, res, next) => {
  try {
    const cursoId = req.params["id"] as string;
    const usuario = await prisma.usuario.findUnique({ where: { id: req.usuario!.sub }, select: { papelGlobal: true } });
    if (usuario?.papelGlobal !== "ADMIN") {
      const membro = await prisma.cursoMembro.findUnique({ where: { cursoId_usuarioId: { cursoId, usuarioId: req.usuario!.sub } } });
      if (membro?.papel !== "ADMIN") { res.status(403).json({ message: "Apenas administradores podem excluir o curso." }); return; }
    }
    return ctrl.excluir(req, res, next);
  } catch (err) { next(err); }
});

// OAs do curso
router.get("/:id/oas", oaCtrl.listarByCurso);

// Exportação da Matriz de Conteúdo
router.get("/:id/exportar-mc", async (req, res, next) => {
  try {
    const cursoId = req.params["id"] as string;
    const curso   = await prisma.curso.findUnique({ where: { id: cursoId }, select: { codigo: true } });
    if (!curso) { res.status(404).json({ message: "Curso não encontrado." }); return; }

    const buffer   = await exportMC(cursoId);
    const filename = `MC_${curso.codigo}.xlsx`;
    res.setHeader("Content-Type",        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    res.setHeader("Content-Disposition", `attachment; filename="${encodeURIComponent(filename)}"`);
    res.send(buffer);
  } catch (err) { next(err); }
});

// ── Duplicar curso ────────────────────────────────────────────────────────────

const duplicarSchema = z.object({
  nome:   z.string().min(2).max(200),
  codigo: z.string().min(2).max(50),
});

router.post("/:id/duplicar", async (req, res, next) => {
  try {
    if (req.usuario!.papel !== "ADMIN") {
      res.status(403).json({ message: "Apenas administradores podem duplicar cursos." }); return;
    }

    const { nome, codigo } = duplicarSchema.parse(req.body);

    // Verifica conflito de código
    const existe = await prisma.curso.findUnique({ where: { codigo }, select: { id: true } });
    if (existe) { res.status(409).json({ message: `Já existe um curso com o código "${codigo}".` }); return; }

    // Carrega estrutura completa do original
    const original = await prisma.curso.findUnique({
      where:   { id: req.params["id"] as string },
      include: {
        membros:  { select: { usuarioId: true, papel: true } },
        unidades: {
          orderBy:  { numero: "asc" },
          include: {
            capitulos: {
              orderBy: { numero: "asc" },
              include: {
                objetivos: { orderBy: { numero: "asc" } },
                oas: {
                  orderBy: { numero: "asc" },
                  include: { etapas: { orderBy: { ordem: "asc" } } },
                },
              },
            },
          },
        },
      },
    });

    if (!original) { res.status(404).json({ message: "Curso não encontrado." }); return; }

    // Cria o novo curso numa transação
    const novo = await prisma.$transaction(async (tx) => {
      const curso = await tx.curso.create({
        data: {
          codigo,
          nome,
          descricao:        original.descricao,
          chTotalPlanejada: original.chTotalPlanejada,
          status:           "RASCUNHO",
        },
      });

      // Copia membros
      if (original.membros.length > 0) {
        await tx.cursoMembro.createMany({
          data: original.membros.map((m) => ({
            cursoId:   curso.id,
            usuarioId: m.usuarioId,
            papel:     m.papel,
          })),
          skipDuplicates: true,
        });
      }

      // Copia estrutura pedagógica (unidades → capítulos → objetivos → OAs → etapas)
      for (const unidade of original.unidades) {
        const novaUnidade = await tx.unidade.create({
          data: {
            cursoId:      curso.id,
            numero:       unidade.numero,
            nome:         unidade.nome,
            chSincrona:   unidade.chSincrona,
            chAssincrona: unidade.chAssincrona,
            chAtividades: unidade.chAtividades,
          },
        });

        for (const cap of unidade.capitulos) {
          const novoCap = await tx.capitulo.create({
            data: {
              unidadeId:          novaUnidade.id,
              numero:             cap.numero,
              nome:               cap.nome,
              conteudoResumo:     cap.conteudoResumo,
              periodoDias:        cap.periodoDias,
              ferramentas:        cap.ferramentas,
              atividadeFormativa: cap.atividadeFormativa,
              atividadeSomativa:  cap.atividadeSomativa,
              feedback:           cap.feedback,
              chSincrona:         cap.chSincrona,
              chAssincrona:       cap.chAssincrona,
              chAtividades:       cap.chAtividades,
            },
          });

          // Objetivos educacionais
          if (cap.objetivos.length > 0) {
            await tx.objetivoEducacional.createMany({
              data: cap.objetivos.map((obj) => ({
                capituloId: novoCap.id,
                numero:     obj.numero,
                descricao:  obj.descricao,
                nivelBloom: obj.nivelBloom,
                papeisAtores: obj.papeisAtores,
              })),
            });
          }

          // OAs — reinicia status/links/deadlines
          for (const oa of cap.oas) {
            // Gera novo código substituindo o prefixo do curso
            const novoCodigoOA = oa.codigo.replace(original.codigo, codigo);

            const novoOA = await tx.objetoAprendizagem.create({
              data: {
                capituloId: novoCap.id,
                codigo:     novoCodigoOA,
                tipo:       oa.tipo,
                numero:     oa.numero,
                titulo:     oa.titulo,
                descricao:  oa.descricao,
                // Dados de produção zerados
                status:      "PENDENTE",
                progressoPct: 0,
              },
            });

            // Etapas — copia definição, zera tudo de produção
            if (oa.etapas.length > 0) {
              await tx.etapaOA.createMany({
                data: oa.etapas.map((e) => ({
                  oaId:       novoOA.id,
                  etapaDefId: e.etapaDefId,
                  ordem:      e.ordem,
                  status:     "PENDENTE" as const,
                })),
              });
            }
          }
        }
      }

      return curso;
    });

    res.status(201).json({ id: novo.id, codigo: novo.codigo, nome: novo.nome });
  } catch (err) { next(err); }
});

// Importação MC — duas etapas
router.post("/:id/importar/preview",   uploadExcel, ctrl.importarPreview);
router.post("/:id/importar/confirmar", uploadExcel, ctrl.importarConfirmar);

// Importação MI — duas etapas
router.post("/:id/importar-mi/preview",   uploadExcel, ctrl.importarMIPreview);
router.post("/:id/importar-mi/confirmar", uploadExcel, ctrl.importarMIConfirmar);

// ── Atribuição em massa de responsáveis ───────────────────────────────────────

const atribuicaoSchema = z.object({
  papelEtapa:    z.string(),
  responsavelId: z.string(),
  sobrescrever:  z.boolean().default(false),
  unidadesIds:   z.array(z.string()).optional(),
});

router.get("/:id/atribuicao-preview", async (req, res, next) => {
  try {
    const { papelEtapa, sobrescrever, unidadesIds: unidadesParam } = req.query as Record<string, string>;
    const cursoId = req.params["id"] as string;
    const apenasVazios = !sobrescrever || sobrescrever === "false";
    const unidadesIds = unidadesParam ? unidadesParam.split(",").filter(Boolean) : [];

    const unidadeWhere = unidadesIds.length > 0
      ? { id: { in: unidadesIds }, cursoId }
      : { cursoId };

    const total = await prisma.etapaOA.count({
      where: {
        oa:       { capitulo: { unidade: unidadeWhere } },
        etapaDef: { papel: (papelEtapa || undefined) as any },
        ...(apenasVazios ? { responsavelId: null } : {}),
      },
    });
    res.json({ totalEtapas: total });
  } catch (err) { next(err); }
});

router.post("/:id/atribuir-responsaveis", async (req, res, next) => {
  try {
    const cursoId = req.params["id"] as string;

    // ADMIN guard
    const usuario = await prisma.usuario.findUnique({ where: { id: req.usuario!.sub }, select: { papelGlobal: true } });
    if (usuario?.papelGlobal !== "ADMIN") {
      const membro = await prisma.cursoMembro.findUnique({
        where: { cursoId_usuarioId: { cursoId, usuarioId: req.usuario!.sub } },
      });
      if (membro?.papel !== "ADMIN") {
        res.status(403).json({ message: "Apenas administradores podem atribuir responsáveis em massa." });
        return;
      }
    }

    const parsed = atribuicaoSchema.safeParse(req.body);
    if (!parsed.success) { res.status(400).json({ message: "Dados inválidos.", errors: parsed.error.flatten() }); return; }

    const { papelEtapa, responsavelId, sobrescrever, unidadesIds } = parsed.data;

    // Valida que o responsável é membro do curso
    const isMembro = await prisma.cursoMembro.findUnique({
      where: { cursoId_usuarioId: { cursoId, usuarioId: responsavelId } },
    });
    if (!isMembro) { res.status(422).json({ message: "O usuário selecionado não é membro do curso." }); return; }

    const unidadeWhere = unidadesIds && unidadesIds.length > 0
      ? { id: { in: unidadesIds }, cursoId }
      : { cursoId };

    // 2-step bulk update (Prisma não suporta updateMany com relações no where)
    const etapas = await prisma.etapaOA.findMany({
      where: {
        oa: { capitulo: { unidade: unidadeWhere } },
        etapaDef: { papel: papelEtapa as any },
        ...(!sobrescrever ? { responsavelId: null } : {}),
      },
      select: { id: true },
    });

    const ids = etapas.map((e) => e.id);
    const result = await prisma.etapaOA.updateMany({
      where: { id: { in: ids } },
      data:  { responsavelId },
    });

    res.json({ totalAtualizado: result.count });
  } catch (err) { next(err); }
});

// ── Setup de Produção — Validação da matriz e Coordenador ─────────────────────

router.patch("/:id/validar-matriz", async (req, res, next) => {
  try {
    const cursoId   = req.params["id"] as string;
    const usuarioId = req.usuario!.sub;

    // Verifica se o curso existe
    const curso = await prisma.curso.findUnique({ where: { id: cursoId }, select: { id: true } });
    if (!curso) { res.status(404).json({ message: "Curso não encontrado." }); return; }

    const atualizado = await prisma.curso.update({
      where: { id: cursoId },
      data:  { matrizValidadaEm: new Date(), matrizValidadaPorId: usuarioId },
      select: { id: true, matrizValidadaEm: true, matrizValidadaPorId: true,
                matrizValidadaPor: { select: { id: true, nome: true } } },
    });

    res.json(atualizado);
  } catch (err) { next(err); }
});

router.patch("/:id/coordenador-producao", async (req, res, next) => {
  try {
    const cursoId = req.params["id"] as string;
    const { coordenadorProducaoId } = req.body as { coordenadorProducaoId: string | null };

    // Valida que, se informado, o usuário é membro do curso ou ADMIN global
    if (coordenadorProducaoId) {
      const coordenador = await prisma.usuario.findUnique({
        where: { id: coordenadorProducaoId },
        select: { papelGlobal: true },
      });
      if (coordenador?.papelGlobal !== "ADMIN") {
        const isMembro = await prisma.cursoMembro.findUnique({
          where: { cursoId_usuarioId: { cursoId, usuarioId: coordenadorProducaoId } },
        });
        if (!isMembro) {
          res.status(422).json({ message: "O usuário selecionado não é membro do curso." });
          return;
        }
      }
    }

    const atualizado = await prisma.curso.update({
      where: { id: cursoId },
      data:  { coordenadorProducaoId },
      select: { id: true, coordenadorProducaoId: true,
                coordenadorProducao: { select: { id: true, nome: true, fotoUrl: true } } },
    });

    res.json(atualizado);
  } catch (err) { next(err); }
});

// ── Gestão de Membros ─────────────────────────────────────────────────────────

const membroSchema = z.object({
  usuarioId:      z.string(),
  papel:          z.enum(["ADMIN", "COLABORADOR", "LEITOR"]).default("COLABORADOR"),
  papeisProducao: z.array(z.string()).optional(),
});

router.post("/:id/membros", async (req, res, next) => {
  try {
    const cursoId = req.params["id"] as string;
    const solicitante = await prisma.usuario.findUnique({ where: { id: req.usuario!.sub }, select: { papelGlobal: true } });
    if (solicitante?.papelGlobal !== "ADMIN") {
      const membroSolicitante = await prisma.cursoMembro.findUnique({ where: { cursoId_usuarioId: { cursoId, usuarioId: req.usuario!.sub } } });
      if (membroSolicitante?.papel !== "ADMIN") { res.status(403).json({ message: "Apenas administradores podem gerenciar membros do curso." }); return; }
    }
    const { usuarioId, papel, papeisProducao } = membroSchema.parse(req.body);
    const membro = await prisma.cursoMembro.upsert({
      where:  { cursoId_usuarioId: { cursoId: req.params["id"] as string, usuarioId } },
      create: { cursoId: req.params["id"] as string, usuarioId, papel, papeisProducao: papeisProducao ?? [] },
      update: { papel, ...(papeisProducao !== undefined ? { papeisProducao } : {}) },
      include: { usuario: { select: { id: true, nome: true, email: true, fotoUrl: true, papelGlobal: true } } },
    });
    res.status(201).json(membro);
  } catch (err) { next(err); }
});

// PATCH /:id/membros/:usuarioId — atualiza apenas papeisProducao de um membro existente
router.patch("/:id/membros/:usuarioId", async (req, res, next) => {
  try {
    const cursoId = req.params["id"] as string;
    const solicitante = await prisma.usuario.findUnique({ where: { id: req.usuario!.sub }, select: { papelGlobal: true } });
    if (solicitante?.papelGlobal !== "ADMIN") {
      const membroSolicitante = await prisma.cursoMembro.findUnique({ where: { cursoId_usuarioId: { cursoId, usuarioId: req.usuario!.sub } } });
      if (membroSolicitante?.papel !== "ADMIN") { res.status(403).json({ message: "Apenas administradores podem gerenciar membros do curso." }); return; }
    }
    const { papeisProducao } = z.object({ papeisProducao: z.array(z.string()) }).parse(req.body);
    const membro = await prisma.cursoMembro.update({
      where:  { cursoId_usuarioId: { cursoId: req.params["id"] as string, usuarioId: req.params["usuarioId"] as string } },
      data:   { papeisProducao },
      include: { usuario: { select: { id: true, nome: true, email: true, fotoUrl: true, papelGlobal: true } } },
    });
    res.json(membro);
  } catch (err) { next(err); }
});

router.delete("/:id/membros/:usuarioId", async (req, res, next) => {
  try {
    const cursoId = req.params["id"] as string;
    const solicitante = await prisma.usuario.findUnique({ where: { id: req.usuario!.sub }, select: { papelGlobal: true } });
    if (solicitante?.papelGlobal !== "ADMIN") {
      const membroSolicitante = await prisma.cursoMembro.findUnique({ where: { cursoId_usuarioId: { cursoId, usuarioId: req.usuario!.sub } } });
      if (membroSolicitante?.papel !== "ADMIN") { res.status(403).json({ message: "Apenas administradores podem gerenciar membros do curso." }); return; }
    }
    await prisma.cursoMembro.delete({
      where: { cursoId_usuarioId: { cursoId: req.params["id"] as string, usuarioId: req.params["usuarioId"] as string } },
    });
    res.status(204).send();
  } catch (err) { next(err); }
});

// ── Sugestão Inteligente de Alocação ──────────────────────────────────────────

router.get("/:id/setup/sugestao-alocacao", async (req, res, next) => {
  try {
    const cursoId = req.params["id"] as string;

    // 1. Membros do curso com seus papéis de produção
    const membros = await prisma.cursoMembro.findMany({
      where:   { cursoId },
      include: { usuario: { select: { id: true, nome: true, email: true, fotoUrl: true, capacidadeHorasSemanais: true } } },
    });

    // 2. Para cada membro, calcula horas comprometidas em TODOS os cursos ativos
    const HORIZONTE_SEMANAS = 4;
    const analise = await Promise.all(membros.map(async (m) => {
      const etapasPendentes = await prisma.etapaOA.findMany({
        where: {
          responsavelId: m.usuarioId,
          status:        { in: ["PENDENTE", "EM_ANDAMENTO"] },
          oa: { capitulo: { unidade: { curso: { status: "ATIVO" } } } },
        },
        include: { etapaDef: { select: { esforcoHoras: true } } },
      });

      const horasComprometidas = etapasPendentes.reduce((s, e) => s + (e.etapaDef.esforcoHoras ?? 2), 0);
      const horasSemana        = horasComprometidas / HORIZONTE_SEMANAS;
      const horasDisponiveis   = Math.max(0, m.usuario.capacidadeHorasSemanais - horasSemana);
      const percentualOcupado  = Math.min(100, Math.round((horasSemana / m.usuario.capacidadeHorasSemanais) * 100));

      return {
        usuarioId:       m.usuarioId,
        nome:            m.usuario.nome,
        email:           m.usuario.email,
        fotoUrl:         m.usuario.fotoUrl,
        papeisProducao:  m.papeisProducao,
        capacidade:      m.usuario.capacidadeHorasSemanais,
        horasCompromissadas: Math.round(horasSemana * 10) / 10,
        horasDisponiveis:    Math.round(horasDisponiveis * 10) / 10,
        percentualOcupado,
        etapasPendentesTotal: etapasPendentes.length,
      };
    }));

    // 3. Conta OAs pendentes de setup neste curso (sem responsável na etapa de coordenação)
    const oasPendentesSetup = await prisma.etapaOA.count({
      where: {
        status:    "PENDENTE",
        responsavelId: null,
        oa: { capitulo: { unidade: { cursoId } } },
        etapaDef:  { papel: { not: "COORDENADOR_PRODUCAO" } },
      },
    });

    // 4. Por papel, lista candidatos ranqueados por disponibilidade
    const papeisNoCurso = [...new Set(analise.flatMap((m) => m.papeisProducao))];
    const porPapel = papeisNoCurso.map((papel) => {
      const candidatos = analise
        .filter((m) => m.papeisProducao.includes(papel))
        .sort((a, b) => a.percentualOcupado - b.percentualOcupado);
      return { papel, candidatos };
    });

    // 5. Sugestão: para cada papel, o candidato menos ocupado
    const sugestao = porPapel
      .filter((p) => p.candidatos.length > 0)
      .map((p) => ({
        papel:            p.papel,
        responsavelId:    p.candidatos[0]!.usuarioId,
        responsavelNome:  p.candidatos[0]!.nome,
        percentualOcupado: p.candidatos[0]!.percentualOcupado,
      }));

    res.json({ membros: analise, porPapel, sugestao, oasPendentesSetup });
  } catch (err) { next(err); }
});

// POST /:id/setup/aplicar-sugestao — aplica a sugestão a todas as EtapaOAs PENDENTE sem responsável
router.post("/:id/setup/aplicar-sugestao", async (req, res, next) => {
  try {
    const cursoId = req.params["id"] as string;
    const sugestaoSchema = z.array(z.object({
      papel:         z.string(),
      responsavelId: z.string(),
    }));
    const sugestao = sugestaoSchema.parse(req.body);

    let totalAtualizado = 0;
    for (const item of sugestao) {
      const result = await prisma.etapaOA.updateMany({
        where: {
          responsavelId: null,
          status:        "PENDENTE",
          oa:            { capitulo: { unidade: { cursoId } } },
          etapaDef:      { papel: item.papel as any },
        },
        data: { responsavelId: item.responsavelId },
      });
      totalAtualizado += result.count;
    }

    res.json({ totalAtualizado, message: `${totalAtualizado} etapas alocadas.` });
  } catch (err) { next(err); }
});

// ─── POST /:id/setup/calcular-deadlines ──────────────────────────────────────
// Recalcula deadlines de todas as EtapaOAs do curso com base na capacidade
// disponível de cada responsável e no esforcoHoras de cada definição de etapa.
router.post("/:id/setup/calcular-deadlines", async (req, res, next) => {
  try {
    const cursoId = req.params["id"] as string;

    // Verifica acesso (admin global ou admin do curso)
    const isAdminGlobal = req.usuario!.papel === "ADMIN";
    if (!isAdminGlobal) {
      const membro = await prisma.cursoMembro.findUnique({
        where: { cursoId_usuarioId: { cursoId, usuarioId: req.usuario!.sub } },
      });
      if (!membro || membro.papel !== "ADMIN") {
        res.status(403).json({ message: "Acesso negado." }); return;
      }
    }

    // Carrega todos os OAs do curso com etapas ordenadas
    const oas = await prisma.objetoAprendizagem.findMany({
      where: { capitulo: { unidade: { cursoId } } },
      select: {
        codigo: true,
        etapas: {
          orderBy: { ordem: "asc" },
          select: {
            id: true, ordem: true, deadlinePrevisto: true, responsavelId: true,
            etapaDef: { select: { papel: true, esforcoHoras: true } },
          },
        },
      },
    });

    // Calcula horas compromissadas por membro (horizonte de 4 semanas)
    const HORIZON_WEEKS = 4;
    const capacidadeMap = new Map<string, number>(); // usuarioId → horasDisponiveis/semana

    const membrosComCapacidade = await prisma.cursoMembro.findMany({
      where: { cursoId },
      select: {
        usuarioId: true,
        usuario:   { select: { capacidadeHorasSemanais: true } },
      },
    });

    for (const m of membrosComCapacidade) {
      const compromissadas = await prisma.etapaOA.findMany({
        where: {
          responsavelId: m.usuarioId,
          status: { in: ["PENDENTE", "EM_ANDAMENTO"] },
          oa: { capitulo: { unidade: { curso: { status: "ATIVO" } } } },
        },
        select: { etapaDef: { select: { esforcoHoras: true } } },
      });
      const totalHoras = compromissadas.reduce((s, e) => s + e.etapaDef.esforcoHoras, 0);
      const horasSemanais = totalHoras / HORIZON_WEEKS;
      const disponiveis   = Math.max(4, m.usuario.capacidadeHorasSemanais - horasSemanais);
      capacidadeMap.set(m.usuarioId, disponiveis);
    }

    const DEFAULT_HORAS_DISPONIVEIS = 8; // sem responsável: assume 8h/semana

    let totalAtualizadas = 0;
    const avisos: string[] = [];

    for (const oa of oas) {
      const setupIdx = oa.etapas.findIndex(
        (e) => e.etapaDef.papel === "COORDENADOR_PRODUCAO"
      );
      if (setupIdx === -1) continue;

      const setupEtapa = oa.etapas[setupIdx];
      if (!setupEtapa?.deadlinePrevisto) {
        avisos.push(`${oa.codigo}: sem deadline de setup — ignorado.`);
        continue;
      }

      let prevDeadline = new Date(setupEtapa.deadlinePrevisto);

      for (let i = setupIdx + 1; i < oa.etapas.length; i++) {
        const etapa = oa.etapas[i];
        if (!etapa) continue;
        const horasDisponiveis = etapa.responsavelId
          ? (capacidadeMap.get(etapa.responsavelId) ?? DEFAULT_HORAS_DISPONIVEIS)
          : DEFAULT_HORAS_DISPONIVEIS;

        const horasPorDia  = horasDisponiveis / 5;
        const diasNecessarios = Math.max(1, Math.ceil(etapa.etapaDef.esforcoHoras / horasPorDia));

        const novoDeadline = new Date(prevDeadline);
        novoDeadline.setDate(novoDeadline.getDate() + diasNecessarios);

        await prisma.etapaOA.update({
          where: { id: etapa.id },
          data:  { deadlinePrevisto: novoDeadline },
        });

        prevDeadline = novoDeadline;
        totalAtualizadas++;
      }
    }

    res.json({ totalAtualizadas, avisos });
  } catch (err) { next(err); }
});

// ── Configuração de alertas por curso ────────────────────────────────────────

const configAlertaSchema = z.object({
  diasAntecedencia:     z.number().int().min(1).max(30).optional(),
  alertDeadlineVencido: z.boolean().optional(),
  alertPrazoProximo:    z.boolean().optional(),
  alertEtapaLiberada:   z.boolean().optional(),
  alertMencao:          z.boolean().optional(),
});

/** GET /cursos/:id/config-alertas — retorna config (cria com defaults se não existir) */
router.get("/:id/config-alertas", async (req, res, next) => {
  try {
    const cursoId = req.params["id"] as string;
    const config = await prisma.configAlertaCurso.upsert({
      where:  { cursoId },
      create: { cursoId },
      update: {},
    });
    res.json(config);
  } catch (err) { next(err); }
});

/** PUT /cursos/:id/config-alertas — atualiza config do curso (requer ADMIN) */
router.put("/:id/config-alertas", async (req, res, next) => {
  try {
    const cursoId = req.params["id"] as string;
    const usuario = await prisma.usuario.findUnique({ where: { id: req.usuario!.sub }, select: { papelGlobal: true } });
    if (usuario?.papelGlobal !== "ADMIN") {
      const membro = await prisma.cursoMembro.findUnique({ where: { cursoId_usuarioId: { cursoId, usuarioId: req.usuario!.sub } } });
      if (membro?.papel !== "ADMIN") { res.status(403).json({ message: "Apenas administradores podem configurar alertas." }); return; }
    }
    const parsed = configAlertaSchema.parse(req.body);
    // Strip undefined values — required by exactOptionalPropertyTypes + Prisma
    const data: Record<string, unknown> = Object.fromEntries(
      Object.entries(parsed).filter(([, v]) => v !== undefined)
    );
    const config = await prisma.configAlertaCurso.upsert({
      where:  { cursoId },
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      create: { cursoId, ...data } as any,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      update: data as any,
    });
    res.json(config);
  } catch (err) { next(err); }
});

/** PATCH /cursos/:id/membros/:usuarioId/notif — preferências de notificação do membro */
router.patch("/:id/membros/:usuarioId/notif", async (req, res, next) => {
  try {
    const cursoId   = req.params["id"] as string;
    const usuarioId = req.params["usuarioId"] as string;

    // Apenas admin do curso/global ou o próprio usuário
    const ehAdmin = await prisma.usuario.findUnique({ where: { id: req.usuario!.sub }, select: { papelGlobal: true } })
      .then((u) => u?.papelGlobal === "ADMIN");
    const ehMembroAdmin = await prisma.cursoMembro.findUnique({
      where: { cursoId_usuarioId: { cursoId, usuarioId: req.usuario!.sub } },
    }).then((m) => m?.papel === "ADMIN");

    if (!ehAdmin && !ehMembroAdmin && req.usuario!.sub !== usuarioId) {
      res.status(403).json({ message: "Permissão negada." }); return;
    }

    const { notifEmailAtivo, notifInAppAtivo } = z.object({
      notifEmailAtivo: z.boolean().optional(),
      notifInAppAtivo: z.boolean().optional(),
    }).parse(req.body);

    const membro = await prisma.cursoMembro.update({
      where: { cursoId_usuarioId: { cursoId, usuarioId } },
      data:  { ...(notifEmailAtivo !== undefined && { notifEmailAtivo }), ...(notifInAppAtivo !== undefined && { notifInAppAtivo }) },
      select: { usuarioId: true, notifEmailAtivo: true, notifInAppAtivo: true },
    });
    res.json(membro);
  } catch (err) { next(err); }
});

// ─── RF-M2-05: Histórico de versões da MI ────────────────────────────────────

/** GET /:id/mi/historico — lista versões da MI (mais recentes primeiro) */
router.get("/:id/mi/historico", async (req, res, next) => {
  try {
    const cursoId = req.params["id"] as string;
    const versoes = await prisma.mIHistorico.findMany({
      where:   { cursoId },
      orderBy: { createdAt: "desc" },
      select: {
        id:        true,
        resumo:    true,
        createdAt: true,
        importadoPor: { select: { id: true, nome: true, fotoUrl: true } },
      },
    });
    res.json(versoes);
  } catch (err) { next(err); }
});

/** GET /:id/mi/historico/:versaoId — retorna snapshot completo de uma versão */
router.get("/:id/mi/historico/:versaoId", async (req, res, next) => {
  try {
    const versao = await prisma.mIHistorico.findUnique({
      where: { id: req.params["versaoId"] as string },
      select: {
        id: true, resumo: true, snapshot: true, createdAt: true,
        importadoPor: { select: { id: true, nome: true, fotoUrl: true } },
      },
    });
    if (!versao || versao.id !== req.params["versaoId"]) {
      res.status(404).json({ message: "Versão não encontrada." }); return;
    }
    res.json(versao);
  } catch (err) { next(err); }
});

/** POST /:id/mi/restaurar/:versaoId — restaura MI a uma versão anterior */
router.post("/:id/mi/restaurar/:versaoId", async (req, res, next) => {
  try {
    const cursoId  = req.params["id"] as string;
    const versaoId = req.params["versaoId"] as string;

    // Admin guard
    const usuario = await prisma.usuario.findUnique({ where: { id: req.usuario!.sub }, select: { papelGlobal: true } });
    if (usuario?.papelGlobal !== "ADMIN") {
      const membro = await prisma.cursoMembro.findUnique({
        where: { cursoId_usuarioId: { cursoId, usuarioId: req.usuario!.sub } },
      });
      if (membro?.papel !== "ADMIN") { res.status(403).json({ message: "Apenas administradores podem restaurar versões." }); return; }
    }

    const versao = await prisma.mIHistorico.findUnique({ where: { id: versaoId } });
    if (!versao || versao.cursoId !== cursoId) {
      res.status(404).json({ message: "Versão não encontrada." }); return;
    }

    const caps = versao.snapshot as unknown as MICapitulo[];
    const result = await persistMI(caps, cursoId);

    // Salva nova entrada no histórico marcando a restauração
    const totalUnidades = new Set(caps.map((c) => c.unidade)).size;
    const totalOAs      = caps.reduce((s, c) => s + c.oaDefs.reduce((ss, d) => ss + d.quantidade, 0), 0);
    await prisma.mIHistorico.create({
      data: {
        cursoId,
        importadoPorId: req.usuario!.sub,
        snapshot:       versao.snapshot as never,
        resumo: `[Restauração] ${totalUnidades} unidade(s) · ${result.capitulosAtualizados} capítulos · ${totalOAs} OA(s)`,
      },
    });

    res.json({
      message:              `MI restaurada: ${result.capitulosAtualizados} capítulos, ${result.objetivosCriados} objetivos, ${result.oasCriados} OAs gerados.`,
      capitulosAtualizados: result.capitulosAtualizados,
      objetivosCriados:     result.objetivosCriados,
      oasCriados:           result.oasCriados,
    });
  } catch (err) { next(err); }
});

// ─── RF-M2-06: Comentários por capítulo da MI ────────────────────────────────

const comentarioMISchema = z.object({
  texto: z.string().min(1).max(2000),
});

/** GET /:id/capitulos/:capituloId/comentarios */
router.get("/:id/capitulos/:capituloId/comentarios", async (req, res, next) => {
  try {
    const capituloId = req.params["capituloId"] as string;
    // Verifica que o capítulo pertence ao curso
    const cap = await prisma.capitulo.findFirst({
      where: { id: capituloId, unidade: { cursoId: req.params["id"] as string } },
      select: { id: true },
    });
    if (!cap) { res.status(404).json({ message: "Capítulo não encontrado." }); return; }

    const comentarios = await prisma.comentario.findMany({
      where:   { capituloId },
      orderBy: { createdAt: "asc" },
      select: {
        id: true, texto: true, editado: true, createdAt: true, mencoes: true, parentId: true,
        autor: { select: { id: true, nome: true, fotoUrl: true } },
      },
    });
    res.json(comentarios);
  } catch (err) { next(err); }
});

/** POST /:id/capitulos/:capituloId/comentarios */
router.post("/:id/capitulos/:capituloId/comentarios", async (req, res, next) => {
  try {
    const cursoId    = req.params["id"] as string;
    const capituloId = req.params["capituloId"] as string;

    const cap = await prisma.capitulo.findFirst({
      where: { id: capituloId, unidade: { cursoId } },
      select: { id: true },
    });
    if (!cap) { res.status(404).json({ message: "Capítulo não encontrado." }); return; }

    const { texto } = comentarioMISchema.parse(req.body);

    // Extrai @menções do texto e resolve IDs de membros do curso
    const nomesMencionados = [...new Set(
      [...texto.matchAll(/@([\w\u00C0-\u017F]+(?:\s[\w\u00C0-\u017F]+)*)/g)].map((m) => m[1]!.trim())
    )];
    let mencoes: string[] = [];
    if (nomesMencionados.length > 0) {
      const membros = await prisma.cursoMembro.findMany({
        where:   { cursoId },
        include: { usuario: { select: { id: true, nome: true } } },
      });
      mencoes = membros
        .filter((m) => nomesMencionados.some((n) => m.usuario.nome.toLowerCase().startsWith(n.toLowerCase())))
        .map((m) => m.usuario.id);
    }

    const comentario = await prisma.comentario.create({
      data: { texto, capituloId, autorId: req.usuario!.sub, mencoes },
      select: {
        id: true, texto: true, editado: true, createdAt: true, mencoes: true, parentId: true,
        autor: { select: { id: true, nome: true, fotoUrl: true } },
      },
    });

    // Notificações in-app para mencionados
    const autorId = req.usuario!.sub;
    const idsNotificar = [...new Set(mencoes)].filter((id) => id !== autorId);
    if (idsNotificar.length > 0) {
      const autor = await prisma.usuario.findUnique({ where: { id: autorId }, select: { nome: true } });
      await prisma.notificacao.createMany({
        data: idsNotificar.map((usuarioId) => ({
          usuarioId,
          tipo:         "MENCAO",
          titulo:       `${autor?.nome ?? "Alguém"} mencionou você em um comentário da MI`,
          corpo:        texto.slice(0, 120),
          entidadeTipo: "CAPITULO",
          entidadeId:   capituloId,
        })),
      });
    }

    res.status(201).json(comentario);
  } catch (err) { next(err); }
});

/** DELETE /:id/capitulos/:capituloId/comentarios/:comentarioId */
router.delete("/:id/capitulos/:capituloId/comentarios/:comentarioId", async (req, res, next) => {
  try {
    const c = await prisma.comentario.findUnique({ where: { id: req.params["comentarioId"] as string } });
    // Autor pode excluir o próprio; admin global também
    const usuario = await prisma.usuario.findUnique({ where: { id: req.usuario!.sub }, select: { papelGlobal: true } });
    if (!c || (c.autorId !== req.usuario!.sub && usuario?.papelGlobal !== "ADMIN")) {
      res.status(403).json({ message: "Sem permissão para excluir este comentário." }); return;
    }
    await prisma.comentario.delete({ where: { id: c.id } });
    res.status(204).send();
  } catch (err) { next(err); }
});

export default router;
