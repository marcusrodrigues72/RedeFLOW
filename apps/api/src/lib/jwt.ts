import jwt from "jsonwebtoken";

const ACCESS_SECRET =
  process.env["JWT_ACCESS_SECRET"] ?? "dev-access-secret-inseguro";
const REFRESH_SECRET =
  process.env["JWT_REFRESH_SECRET"] ?? "dev-refresh-secret-inseguro";
const ACCESS_EXPIRES_IN = process.env["JWT_ACCESS_EXPIRES_IN"] ?? "15m";
const REFRESH_EXPIRES_IN = process.env["JWT_REFRESH_EXPIRES_IN"] ?? "7d";

export interface JwtPayload {
  sub: string;      // usuário ID
  email: string;
  papel: string;
  iat?: number;
  exp?: number;
}

export function signAccessToken(payload: Omit<JwtPayload, "iat" | "exp">): string {
  return jwt.sign(payload, ACCESS_SECRET, {
    expiresIn: ACCESS_EXPIRES_IN,
  } as jwt.SignOptions);
}

export function signRefreshToken(usuarioId: string): string {
  return jwt.sign({ sub: usuarioId }, REFRESH_SECRET, {
    expiresIn: REFRESH_EXPIRES_IN,
  } as jwt.SignOptions);
}

export function verifyAccessToken(token: string): JwtPayload {
  return jwt.verify(token, ACCESS_SECRET) as JwtPayload;
}

export function verifyRefreshToken(token: string): { sub: string } {
  return jwt.verify(token, REFRESH_SECRET) as { sub: string };
}
