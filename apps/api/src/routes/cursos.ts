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
