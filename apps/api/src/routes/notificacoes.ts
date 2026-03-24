import { Router } from "express";
import { authenticate } from "../middlewares/authenticate.js";
import { prisma } from "../lib/prisma.js";

const router = Router();
router.use(authenticate);

// GET /notificacoes
router.get("/", async (req, res, next) => {
  try {
    const notifs = await prisma.notificacao.findMany({
      where:   { usuarioId: req.usuario!.sub },
      orderBy: { createdAt: "desc" },
      take:    50,
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
