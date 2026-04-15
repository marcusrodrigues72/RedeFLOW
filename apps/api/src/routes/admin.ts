import { Router } from "express";
import { z } from "zod";
import { authenticate, requireAdmin } from "../middlewares/authenticate.js";
import { runDeadlineChecks, runDigestDiario } from "../lib/scheduler.js";
import { logger } from "../lib/logger.js";
import { prisma } from "../lib/prisma.js";

const router = Router();

/**
 * POST /admin/run-deadline-checks
 * Executa manualmente o job de verificação de deadlines (Admin only).
 * Útil para testar e-mails transacionais sem esperar o cron das 08:00.
 */
router.post("/run-deadline-checks", authenticate, requireAdmin, async (_req, res, next) => {
  try {
    logger.info("⚡ Execução manual do scheduler solicitada por admin.");
    await runDeadlineChecks();
    res.json({ ok: true, message: "Verificação de deadlines executada com sucesso." });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /admin/run-digest
 * Executa manualmente o job de digest diário (Admin only).
 */
router.post("/run-digest", authenticate, requireAdmin, async (_req, res, next) => {
  try {
    logger.info("⚡ Execução manual do digest solicitada por admin.");
    await runDigestDiario();
    res.json({ ok: true, message: "Digest diário executado com sucesso." });
  } catch (err) {
    next(err);
  }
});

// ─── Pipeline: Etapas de Definição ───────────────────────────────────────────

/**
 * GET /admin/pipeline
 * Lista todas as definições de etapas com esforcoHoras (Admin only).
 */
router.get("/pipeline", authenticate, requireAdmin, async (_req, res, next) => {
  try {
    const etapas = await prisma.etapaDefinicao.findMany({
      orderBy: [{ tipoOA: "asc" }, { ordem: "asc" }],
    });
    res.json(etapas);
  } catch (err) { next(err); }
});

const pipelineUpdateSchema = z.object({
  esforcoHoras: z.number().min(0.5).max(200).optional(),
  nome:         z.string().min(1).max(100).optional(),
  ativo:        z.boolean().optional(),
});

/**
 * PATCH /admin/pipeline/:id
 * Atualiza campos de uma definição de etapa (esforcoHoras, nome, ativo).
 */
router.patch("/pipeline/:id", authenticate, requireAdmin, async (req, res, next) => {
  try {
    const parsed = pipelineUpdateSchema.parse(req.body);
    const updateData: Record<string, unknown> = {};
    if (parsed.nome          !== undefined) updateData["nome"]          = parsed.nome;
    if (parsed.ativo         !== undefined) updateData["ativo"]         = parsed.ativo;
    if (parsed.esforcoHoras  !== undefined) updateData["esforcoHoras"]  = parsed.esforcoHoras;
    const etapa = await prisma.etapaDefinicao.update({
      where: { id: req.params["id"] as string },
      data:  updateData,
    });
    res.json(etapa);
  } catch (err) { next(err); }
});

export default router;
