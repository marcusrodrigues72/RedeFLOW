import { Router } from "express";
import { CursoController } from "../controllers/cursoController.js";
import { OAController }    from "../controllers/oaController.js";
import { authenticate }    from "../middlewares/authenticate.js";
import { uploadExcel }     from "../middlewares/upload.js";
import { prisma }          from "../lib/prisma.js";
import { exportMC }        from "../services/exportService.js";
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
router.patch("/:id", ctrl.atualizar);
router.delete("/:id", ctrl.excluir);

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

    // Valida que, se informado, o usuário é membro do curso
    if (coordenadorProducaoId) {
      const isMembro = await prisma.cursoMembro.findUnique({
        where: { cursoId_usuarioId: { cursoId, usuarioId: coordenadorProducaoId } },
      });
      if (!isMembro) {
        res.status(422).json({ message: "O usuário selecionado não é membro do curso." });
        return;
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
  usuarioId: z.string(),
  papel:     z.enum(["ADMIN", "COLABORADOR", "LEITOR"]).default("COLABORADOR"),
});

router.post("/:id/membros", async (req, res, next) => {
  try {
    const { usuarioId, papel } = membroSchema.parse(req.body);
    const membro = await prisma.cursoMembro.upsert({
      where:  { cursoId_usuarioId: { cursoId: req.params["id"] as string, usuarioId } },
      create: { cursoId: req.params["id"] as string, usuarioId, papel },
      update: { papel },
      include: { usuario: { select: { id: true, nome: true, email: true, fotoUrl: true, papelGlobal: true } } },
    });
    res.status(201).json(membro);
  } catch (err) { next(err); }
});

router.delete("/:id/membros/:usuarioId", async (req, res, next) => {
  try {
    await prisma.cursoMembro.delete({
      where: { cursoId_usuarioId: { cursoId: req.params["id"] as string, usuarioId: req.params["usuarioId"] as string } },
    });
    res.status(204).send();
  } catch (err) { next(err); }
});

export default router;
