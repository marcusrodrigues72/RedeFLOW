import { Router } from "express";
import { authenticate, requireAdmin } from "../middlewares/authenticate.js";
import { runDeadlineChecks } from "../lib/scheduler.js";
import { logger } from "../lib/logger.js";

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

export default router;
