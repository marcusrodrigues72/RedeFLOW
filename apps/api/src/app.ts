import express from "express";
import cors from "cors";
import helmet from "helmet";
import { errorHandler } from "./middlewares/errorHandler.js";
import apiRouter from "./routes/index.js";

export function createApp() {
  const app = express();

  // ─── Segurança ────────────────────────────────────────────────────────────
  app.use(helmet());

  const allowedOrigins = (process.env["CORS_ORIGIN"] ?? "http://localhost:5173")
    .split(",")
    .map((o) => o.trim())
    .filter(Boolean);

  app.use(
    cors({
      origin: (origin, callback) => {
        // Permite requisições sem origin (ex: curl, apps mobile) e origens listadas
        if (!origin || allowedOrigins.includes(origin)) {
          callback(null, true);
        } else {
          callback(new Error(`Origin ${origin} not allowed by CORS`));
        }
      },
      credentials: true,
    })
  );

  // ─── Health check (usado pelo Render) ────────────────────────────────────
  app.get("/api/health", (_req, res) => {
    res.json({ status: "ok", timestamp: new Date().toISOString() });
  });

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
