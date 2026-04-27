import { Router } from "express";
import authRouter          from "./auth.js";
import cursosRouter        from "./cursos.js";
import dashboardRouter     from "./dashboard.js";
import oasRouter           from "./oas.js";
import relatoriosRouter    from "./relatorios.js";
import notificacoesRouter  from "./notificacoes.js";
import usuariosRouter      from "./usuarios.js";
import adminRouter         from "./admin.js";
import webhooksRouter      from "./webhooks.js";

const router = Router();

router.get("/health", (_req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

router.use("/auth",          authRouter);
router.use("/cursos",        cursosRouter);
router.use("/dashboard",     dashboardRouter);
router.use("/oas",           oasRouter);
router.use("/relatorios",    relatoriosRouter);
router.use("/notificacoes",  notificacoesRouter);
router.use("/usuarios",      usuariosRouter);
router.use("/admin",         adminRouter);
router.use("/webhooks",      webhooksRouter);

export default router;
