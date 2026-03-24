import type { Request, Response, NextFunction } from "express";
import { logger } from "../lib/logger.js";

export interface AppError extends Error {
  statusCode?: number;
}

export function errorHandler(
  err: AppError,
  req: Request,
  res: Response,
  _next: NextFunction
) {
  const status = err.statusCode ?? 500;
  const message =
    status >= 500 ? "Erro interno do servidor." : (err.message ?? "Erro desconhecido.");

  if (status >= 500) {
    logger.error({ err, req: { method: req.method, url: req.url } }, message);
  }

  res.status(status).json({ message });
}
