import { Router } from "express";
import { z } from "zod";
import { authenticate } from "../middlewares/authenticate.js";
import { prisma } from "../lib/prisma.js";

const router = Router();
router.use(authenticate);

const TIPOS_VALIDOS = ["DEADLINE_VENCIDO", "PRAZO_PROXIMO", "ETAPA_LIBERADA", "MENCAO"] as const;

// GET /notificacoes?tipo=DEADLINE_VENCIDO&lida=false&limit=100
router.get("/", async (req, res, next) => {
  try {
    const { tipo, lida, limit } = z.object({
      tipo:  z.enum(TIPOS_VALIDOS).optional(),
      lida:  z.enum(["true", "false"]).optional(),
      limit: z.coerce.number().int().min(1).max(500).default(100),
    }).parse(req.query);

    const notifs = await prisma.notificacao.findMany({
      where: {
        usuarioId: req.usuario!.sub,
        ...(tipo  !== undefined && { tipo }),
        ...(lida  !== undefined && { lida: lida === "true" }),
      },
      orderBy: { createdAt: "desc" },
      take:    limit,
    });
    res.json(notifs);
  } catch (err) { next(err); }
});

// GET /notificacoes/nao-lidas/count
router.get("/nao-lidas/count", async (req, res, next) => {
  try {
    const count = await prisma.notificacao.count({
      where: { usuarioId: req.usuario!.sub, lida: false },
    });
    res.json({ count });
  } catch (err) { next(err); }
});

// PATCH /notificacoes/ler-todas  — antes de /:id para não conflitar
router.patch("/ler-todas", async (req, res, next) => {
  try {
    await prisma.notificacao.updateMany({
      where: { usuarioId: req.usuario!.sub, lida: false },
      data:  { lida: true },
    });
    res.status(204).send();
  } catch (err) { next(err); }
});

// PATCH /notificacoes/:id/ler
router.patch("/:id/ler", async (req, res, next) => {
  try {
    await prisma.notificacao.updateMany({
      where: { id: req.params["id"] as string, usuarioId: req.usuario!.sub },
      data:  { lida: true },
    });
    res.status(204).send();
  } catch (err) { next(err); }
});

export default router;
