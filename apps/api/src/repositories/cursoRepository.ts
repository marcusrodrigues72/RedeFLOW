import { Prisma } from "@prisma/client";
import { prisma } from "../lib/prisma.js";

export class CursoRepository {
  async findAll(usuarioId: string, isAdmin = false) {
    const cursos = await prisma.curso.findMany({
      where: isAdmin ? {} : { membros: { some: { usuarioId } } },
      include: {
        unidades: { select: { id: true, numero: true, nome: true } },
        membros: { select: { usuarioId: true, papel: true } },
        _count: { select: { unidades: true } },
      },
      orderBy: { createdAt: "desc" },
    });

    if (cursos.length === 0) return cursos.map((c) => ({ ...c, progressoPct: 0 }));

    const ids = cursos.map((c) => c.id);
    const rows = await prisma.$queryRaw<{ id: string; pct: number }[]>`
      SELECT c.id, COALESCE(ROUND(AVG(oa."progressoPct")), 0)::int AS pct
      FROM "cursos" c
      LEFT JOIN "unidades" u ON u."cursoId" = c.id
      LEFT JOIN "capitulos" cap ON cap."unidadeId" = u.id
      LEFT JOIN "objetos_aprendizagem" oa ON oa."capituloId" = cap.id
      WHERE c.id IN (${Prisma.join(ids)})
      GROUP BY c.id
    `;

    const pctMap = new Map(rows.map((r) => [r.id, Number(r.pct)]));
    return cursos.map((c) => ({ ...c, progressoPct: pctMap.get(c.id) ?? 0 }));
  }

  findById(id: string) {
    return prisma.curso.findUnique({
      where: { id },
      include: {
        unidades: {
          include: {
            capitulos: {
              include: {
                _count: { select: { oas: true, comentarios: true } },
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
          orderBy: { createdAt: "asc" },
        },
        coordenadorProducao: { select: { id: true, nome: true, fotoUrl: true } },
        matrizValidadaPor:   { select: { id: true, nome: true } },
        configAlerta:        true,
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
