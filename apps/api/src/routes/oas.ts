import { Router } from "express";
import { OAController } from "../controllers/oaController.js";
import { authenticate }  from "../middlewares/authenticate.js";
import { prisma }        from "../lib/prisma.js";
import { z }             from "zod";

const router = Router();
const ctrl   = new OAController();

router.use(authenticate);

router.get("/meu-trabalho",          ctrl.meuTrabalho);
router.get("/:id",                   ctrl.buscar);
router.patch("/:id",                 ctrl.atualizarOA);
router.patch("/:id/etapas/:etapaId", ctrl.atualizarEtapa);

// ── Comentários ──────────────────────────────────────────────────────────────

const comentarioSchema = z.object({
  texto:     z.string().min(1).max(2000),
  etapaOaId: z.string().optional(),
});

router.get("/:id/comentarios", async (req, res, next) => {
  try {
    const comentarios = await prisma.comentario.findMany({
      where:   { oaId: req.params["id"] as string },
      include: { autor: { select: { id: true, nome: true, fotoUrl: true } } },
      orderBy: { createdAt: "asc" },
    });
    res.json(comentarios);
  } catch (err) { next(err); }
});

router.post("/:id/comentarios", async (req, res, next) => {
  try {
    const { texto, etapaOaId } = comentarioSchema.parse(req.body);
    const oaId = req.params["id"] as string;

    // Extrai @menções do texto e resolve IDs de usuários do mesmo curso
    const nomesMencionados = [...new Set(
      [...texto.matchAll(/@([\w\u00C0-\u017F]+(?:\s[\w\u00C0-\u017F]+)*)/g)].map((m) => m[1]!.trim())
    )];

    let mencoes: string[] = [];
    if (nomesMencionados.length > 0) {
      // Busca membros do curso que contenham o OA
      const oa = await prisma.objetoAprendizagem.findUnique({
        where:  { id: oaId },
        select: { capitulo: { select: { unidade: { select: { cursoId: true } } } } },
      });
      if (oa) {
        const cursoId = oa.capitulo.unidade.cursoId;
        const membros = await prisma.cursoMembro.findMany({
          where:   { cursoId },
          include: { usuario: { select: { id: true, nome: true } } },
        });
        mencoes = membros
          .filter((m) => nomesMencionados.some((n) => m.usuario.nome.toLowerCase().startsWith(n.toLowerCase())))
          .map((m) => m.usuario.id);
      }
    }

    const comentario = await prisma.comentario.create({
      data: {
        texto,
        oaId,
        etapaOaId: etapaOaId ?? null,
        autorId:   req.usuario!.sub,
        mencoes,
      },
      include: { autor: { select: { id: true, nome: true, fotoUrl: true } } },
    });

    // Notificações in-app para mencionados (exceto o próprio autor)
    const autorId = req.usuario!.sub;
    const idsNotificar = [...new Set(mencoes)].filter((id) => id !== autorId);
    if (idsNotificar.length > 0) {
      const autor = await prisma.usuario.findUnique({ where: { id: autorId }, select: { nome: true } });
      await prisma.notificacao.createMany({
        data: idsNotificar.map((usuarioId) => ({
          usuarioId,
          tipo:         "MENCAO",
          titulo:       `${autor?.nome ?? "Alguém"} mencionou você em um comentário`,
          corpo:        texto.slice(0, 120),
          entidadeTipo: "OA",
          entidadeId:   oaId,
        })),
        skipDuplicates: true,
      });
    }

    res.status(201).json(comentario);
  } catch (err) { next(err); }
});

router.delete("/:id/comentarios/:comentarioId", async (req, res, next) => {
  try {
    const c = await prisma.comentario.findUnique({ where: { id: req.params["comentarioId"] as string } });
    if (!c || c.autorId !== req.usuario!.sub) {
      res.status(403).json({ message: "Sem permissão para excluir este comentário." }); return;
    }
    await prisma.comentario.delete({ where: { id: c.id } });
    res.status(204).send();
  } catch (err) { next(err); }
});

// ── Histórico de auditoria ────────────────────────────────────────────────────

router.get("/:id/audit", async (req, res, next) => {
  try {
    const logs = await prisma.auditLog.findMany({
      where:   { entidadeTipo: "OA", entidadeId: req.params["id"] as string },
      include: { usuario: { select: { id: true, nome: true, fotoUrl: true } } },
      orderBy: { createdAt: "desc" },
      take:    200,
    });
    res.json(logs);
  } catch (err) { next(err); }
});

export default router;
