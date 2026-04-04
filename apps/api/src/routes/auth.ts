import { Router } from "express";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { prisma } from "../lib/prisma.js";
import {
  signAccessToken,
  signRefreshToken,
  verifyRefreshToken,
} from "../lib/jwt.js";
import { authenticate } from "../middlewares/authenticate.js";
import { validate } from "../middlewares/validate.js";
import { loginSchema, refreshSchema } from "shared";

const router = Router();

// POST /api/auth/login
router.post("/login", validate(loginSchema), async (req, res, next) => {
  try {
    const { email, senha } = req.body as { email: string; senha: string };

    const usuario = await prisma.usuario.findUnique({ where: { email } });

    if (!usuario || !usuario.ativo) {
      res.status(401).json({ message: "Credenciais inválidas." });
      return;
    }

    const senhaCorreta = await bcrypt.compare(senha, usuario.senhaHash);
    if (!senhaCorreta) {
      res.status(401).json({ message: "Credenciais inválidas." });
      return;
    }

    const accessToken = signAccessToken({
      sub: usuario.id,
      email: usuario.email,
      papel: usuario.papelGlobal,
    });

    const refreshToken = signRefreshToken(usuario.id);

    // Persiste refresh token (expira em 7 dias)
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7);

    await prisma.refreshToken.create({
      data: { token: refreshToken, usuarioId: usuario.id, expiresAt },
    });

    res.json({
      accessToken,
      refreshToken,
      user: {
        id: usuario.id,
        nome: usuario.nome,
        email: usuario.email,
        papelGlobal: usuario.papelGlobal,
        fotoUrl: usuario.fotoUrl,
      },
    });
  } catch (err) {
    next(err);
  }
});

// POST /api/auth/refresh
router.post("/refresh", validate(refreshSchema), async (req, res, next) => {
  try {
    const { refreshToken } = req.body as { refreshToken: string };

    // Verifica assinatura
    const payload = verifyRefreshToken(refreshToken);

    // Verifica se está no banco e não expirou
    const stored = await prisma.refreshToken.findUnique({
      where: { token: refreshToken },
      include: { usuario: true },
    });

    if (!stored || stored.expiresAt < new Date() || !stored.usuario.ativo) {
      res.status(401).json({ message: "Token de atualização inválido ou expirado." });
      return;
    }

    if (stored.usuarioId !== payload.sub) {
      res.status(401).json({ message: "Token de atualização inválido." });
      return;
    }

    // Rotação de token: invalida o anterior, emite um novo
    await prisma.refreshToken.delete({ where: { id: stored.id } });

    const newAccessToken = signAccessToken({
      sub: stored.usuario.id,
      email: stored.usuario.email,
      papel: stored.usuario.papelGlobal,
    });

    const newRefreshToken = signRefreshToken(stored.usuario.id);
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7);

    await prisma.refreshToken.create({
      data: { token: newRefreshToken, usuarioId: stored.usuario.id, expiresAt },
    });

    res.json({ accessToken: newAccessToken, refreshToken: newRefreshToken });
  } catch {
    res.status(401).json({ message: "Token de atualização inválido ou expirado." });
  }
});

// POST /api/auth/logout
router.post("/logout", authenticate, async (req, res, next) => {
  try {
    const { refreshToken } = req.body as { refreshToken?: string };

    if (refreshToken) {
      await prisma.refreshToken
        .delete({ where: { token: refreshToken } })
        .catch(() => {}); // ignora se não encontrar
    }

    res.status(204).send();
  } catch (err) {
    next(err);
  }
});

// GET /api/auth/me
router.get("/me", authenticate, async (req, res, next) => {
  try {
    const usuario = await prisma.usuario.findUnique({
      where: { id: req.usuario!.sub },
      select: {
        id: true, nome: true, email: true,
        papelGlobal: true, fotoUrl: true, ativo: true,
        notifEmailAtivo: true,
      },
    });

    if (!usuario || !usuario.ativo) {
      res.status(401).json({ message: "Usuário não encontrado." });
      return;
    }

    res.json(usuario);
  } catch (err) {
    next(err);
  }
});

// PATCH /api/auth/me — auto-edição de perfil (qualquer usuário autenticado)
const perfilSchema = z.object({
  nome:            z.string().min(2).max(100).optional(),
  email:           z.string().email().optional(),
  senhaAtual:      z.string().min(1).optional(),
  novaSenha:       z.string().min(6).optional(),
  notifEmailAtivo: z.boolean().optional(),
}).refine(
  (d) => !d.novaSenha || d.senhaAtual,
  { message: "Informe a senha atual para definir uma nova senha.", path: ["senhaAtual"] }
);

router.patch("/me", authenticate, async (req, res, next) => {
  try {
    const { nome, email, senhaAtual, novaSenha, notifEmailAtivo } = perfilSchema.parse(req.body);
    const id = req.usuario!.sub;

    // Se e-mail mudou, verifica conflito
    if (email) {
      const conflito = await prisma.usuario.findFirst({ where: { email, NOT: { id } } });
      if (conflito) {
        res.status(409).json({ message: "Este e-mail já está em uso." });
        return;
      }
    }

    // Se troca de senha, valida senha atual
    if (novaSenha) {
      const atual = await prisma.usuario.findUnique({ where: { id }, select: { senhaHash: true } });
      const correta = atual && await bcrypt.compare(senhaAtual!, atual.senhaHash);
      if (!correta) {
        res.status(400).json({ message: "Senha atual incorreta." });
        return;
      }
    }

    const updateData: Record<string, unknown> = {};
    if (nome  !== undefined) updateData["nome"]  = nome;
    if (email !== undefined) updateData["email"] = email;
    // notifEmailAtivo: somente ADMINs podem alterar
    if (notifEmailAtivo !== undefined && req.usuario!.papel === "ADMIN") {
      updateData["notifEmailAtivo"] = notifEmailAtivo;
    }
    if (novaSenha) updateData["senhaHash"] = await bcrypt.hash(novaSenha, 12);

    const usuario = await prisma.usuario.update({
      where: { id },
      data:  updateData as Parameters<typeof prisma.usuario.update>[0]["data"],
      select: { id: true, nome: true, email: true, papelGlobal: true, fotoUrl: true, notifEmailAtivo: true },
    });

    res.json(usuario);
  } catch (err) { next(err); }
});

export default router;
