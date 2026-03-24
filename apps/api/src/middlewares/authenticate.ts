import type { Request, Response, NextFunction } from "express";
import { verifyAccessToken, type JwtPayload } from "../lib/jwt.js";

declare global {
  namespace Express {
    interface Request {
      usuario?: JwtPayload;
    }
  }
}

export function authenticate(req: Request, res: Response, next: NextFunction) {
  const header = req.headers.authorization;

  if (!header?.startsWith("Bearer ")) {
    res.status(401).json({ message: "Token de acesso ausente ou inválido." });
    return;
  }

  const token = header.slice(7);

  try {
    req.usuario = verifyAccessToken(token);
    next();
  } catch {
    res.status(401).json({ message: "Token expirado ou inválido." });
  }
}

export function requireAdmin(req: Request, res: Response, next: NextFunction) {
  if (req.usuario?.papel !== "ADMIN") {
    res.status(403).json({ message: "Acesso restrito a administradores." });
    return;
  }
  next();
}
