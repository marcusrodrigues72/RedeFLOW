import express from "express";
import cors from "cors";
import helmet from "helmet";
import { errorHandler } from "./middlewares/errorHandler.js";
import apiRouter from "./routes/index.js";

export function createApp() {
  const app = express();

  // ─── Segurança ────────────────────────────────────────────────────────────
  app.use(helmet());
  app.use(
    cors({
      origin: process.env["CORS_ORIGIN"] ?? "http://localhost:5173",
      credentials: true,
    })
  );

  // ─── Parsing ──────────────────────────────────────────────────────────────
  app.use(express.json({ limit: "2mb" }));
  app.use(express.urlencoded({ extended: true }));

  // ─── Rotas ────────────────────────────────────────────────────────────────
  app.use("/api", apiRouter);

  // ─── 404 ──────────────────────────────────────────────────────────────────
  app.use((_req, res) => {
    res.status(404).json({ message: "Rota não encontrada." });
  });

  // ─── Error handler global ─────────────────────────────────────────────────
  app.use(errorHandler);

  return app;
}
