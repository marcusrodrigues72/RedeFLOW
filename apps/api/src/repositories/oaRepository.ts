import { prisma } from "../lib/prisma.js";

export const oaRepository = {
  findByCurso(cursoId: string, filters: { status?: string | undefined; tipo?: string | undefined }) {
    return prisma.objetoAprendizagem.findMany({
      where: {
        capitulo: { unidade: { cursoId } },
        ...(filters.status ? { status: filters.status as any } : {}),
        ...(filters.tipo   ? { tipo:   filters.tipo   as any } : {}),
      },
      include: {
        capitulo: { include: { unidade: true } },
        etapas: {
          include: { etapaDef: true, responsavel: true },
          orderBy: { ordem: "asc" },
        },
      },
      orderBy: [
        { capitulo: { unidade: { numero: "asc" } } },
        { capitulo: { numero: "asc" } },
        { numero: "asc" },
      ],
    });
  },

  findById(id: string) {
    return prisma.objetoAprendizagem.findUnique({
      where: { id },
      include: {
        capitulo: {
          include: {
            unidade: {
              include: {
                curso: {
                  include: {
                    membros: {
                      include: {
                        usuario: { select: { id: true, nome: true, email: true, fotoUrl: true, papelGlobal: true } },
                      },
                    },
                  },
                },
              },
            },
          },
        },
        etapas: {
          include: { etapaDef: true, responsavel: true },
          orderBy: { ordem: "asc" },
        },
      },
    });
  },

  findByUsuario(usuarioId: string) {
    return prisma.objetoAprendizagem.findMany({
      where: {
        etapas: {
          some: {
            responsavelId: usuarioId,
            status: { not: "CONCLUIDA" },
          },
        },
      },
      include: {
        capitulo: { include: { unidade: { include: { curso: true } } } },
        etapas: {
          where: { responsavelId: usuarioId, status: { not: "CONCLUIDA" } },
          include: { etapaDef: true },
          orderBy: { ordem: "asc" },
        },
      },
      orderBy: { deadlineFinal: "asc" },
    });
  },

  updateEtapa(etapaId: string, data: { status?: string | undefined; responsavelId?: string | null | undefined; deadlineReal?: Date | null | undefined; deadlinePrevisto?: Date | null | undefined }) {
    return prisma.etapaOA.update({
      where: { id: etapaId },
      data: {
        ...(data.status            !== undefined ? { status:            data.status as any       } : {}),
        ...(data.responsavelId     !== undefined ? { responsavelId:     data.responsavelId       } : {}),
        ...(data.deadlineReal      !== undefined ? { deadlineReal:      data.deadlineReal        } : {}),
        ...(data.deadlinePrevisto  !== undefined ? { deadlinePrevisto:  data.deadlinePrevisto    } : {}),
      },
      include: { etapaDef: true, responsavel: true },
    });
  },
};
