import { Router } from "express";
import { authenticate } from "../middlewares/authenticate.js";
import { prisma } from "../lib/prisma.js";
import { z } from "zod";
import bcrypt from "bcryptjs";

const router = Router();
router.use(authenticate);

const adminOnly = (req: any, res: any, next: any) => {
  if (req.usuario?.papel !== "ADMIN") {
    res.status(403).json({ message: "Acesso restrito a administradores." }); return;
  }
  next();
};

const select = {
  id: true, nome: true, email: true,
  papelGlobal: true, ativo: true, fotoUrl: true, createdAt: true,
  capacidadeHorasSemanais: true,
};

// GET /usuarios
router.get("/", adminOnly, async (_req, res, next) => {
  try {
    const usuarios = await prisma.usuario.findMany({
      select,
      orderBy: { nome: "asc" },
    });
    res.json(usuarios);
  } catch (err) { next(err); }
});

// POST /usuarios
const criarSchema = z.object({
  nome:        z.string().min(2),
  email:       z.string().email(),
  senha:       z.string().min(6),
  papelGlobal: z.enum(["ADMIN", "COLABORADOR", "LEITOR"]).default("COLABORADOR"),
});

router.post("/", adminOnly, async (req, res, next) => {
  try {
    const data      = criarSchema.parse(req.body);
    const senhaHash = await bcrypt.hash(data.senha, 12);
    const usuario   = await prisma.usuario.create({
      data:   { nome: data.nome, email: data.email, senhaHash, papelGlobal: data.papelGlobal },
      select,
    });
    res.status(201).json(usuario);
  } catch (err) { next(err); }
});

// PATCH /usuarios/:id
const atualizarSchema = z.object({
  nome:                    z.string().min(2).optional(),
  email:                   z.string().email().optional(),
  papelGlobal:             z.enum(["ADMIN", "COLABORADOR", "LEITOR"]).optional(),
  ativo:                   z.boolean().optional(),
  senha:                   z.string().min(6).optional(),
  capacidadeHorasSemanais: z.number().int().min(1).max(168).optional(),
});

router.patch("/:id", adminOnly, async (req, res, next) => {
  try {
    const { senha, ...rest } = atualizarSchema.parse(req.body);
    const updateData: Record<string, unknown> = { ...rest };
    if (senha) updateData["senhaHash"] = await bcrypt.hash(senha, 12);
    const usuario = await prisma.usuario.update({
      where: { id: req.params["id"] as string },
      data:  updateData as Parameters<typeof prisma.usuario.update>[0]["data"],
      select,
    });
    res.json(usuario);
  } catch (err) { next(err); }
});

// DELETE /usuarios/:id — desativa e anonimiza (soft delete, LGPD-safe)
router.delete("/:id", adminOnly, async (req, res, next) => {
  try {
    const id = req.params["id"] as string;
    // Impede auto-exclusão
    if (id === req.usuario!.sub) {
      res.status(400).json({ message: "Você não pode excluir sua própria conta." }); return;
    }
    // Desvincula etapas atribuídas
    await prisma.etapaOA.updateMany({ where: { responsavelId: id }, data: { responsavelId: null } });
    // Remove membros de cursos
    await prisma.cursoMembro.deleteMany({ where: { usuarioId: id } });
    // Revoga refresh tokens
    await prisma.refreshToken.deleteMany({ where: { usuarioId: id } });
    // Soft delete: desativa e anonimiza e-mail
    await prisma.usuario.update({
      where: { id },
      data:  { ativo: false, email: `excluido_${id}@redeflow.invalid`, nome: "Usuário Excluído" },
    });
    res.status(204).send();
  } catch (err) { next(err); }
});

export default router;
