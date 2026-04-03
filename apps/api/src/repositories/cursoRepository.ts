import { type Prisma } from "@prisma/client";
import { prisma } from "../lib/prisma.js";

export class CursoRepository {
  findAll(usuarioId: string) {
    return prisma.curso.findMany({
      where: {
        membros: { some: { usuarioId } },
      },
      include: {
        unidades: { select: { id: true, numero: true, nome: true } },
        membros: { select: { usuarioId: true, papel: true } },
        _count: { select: { unidades: true } },
      },
      orderBy: { createdAt: "desc" },
    });
  }

  findById(id: string) {
    return prisma.curso.findUnique({
      where: { id },
      include: {
        unidades: {
          include: {
            capitulos: {
              include: {
                _count: { select: { oas: true } },
                objetivos: {
                  select: { id: true, numero: true, descricao: true, nivelBloom: true },
                  orderBy: { numero: "asc" },
                },
              },
              orderBy: { numero: "asc" },
            },
          },
          orderBy: { numero: "asc" },
        },
        membros: {
          include: {
            usuario: {
              select: { id: true, nome: true, email: true, fotoUrl: true, papelGlobal: true },
            },
          },
        },
        coordenadorProducao: { select: { id: true, nome: true, fotoUrl: true } },
        matrizValidadaPor:   { select: { id: true, nome: true } },
      },
    });
  }

  create(data: Prisma.CursoCreateInput) {
    return prisma.curso.create({ data });
  }

  update(id: string, data: Prisma.CursoUpdateInput) {
    return prisma.curso.update({ where: { id }, data });
  }

  archive(id: string) {
    return prisma.curso.update({ where: { id }, data: { status: "ARQUIVADO" } });
  }

  delete(id: string) {
    return prisma.curso.delete({ where: { id } });
  }
}
