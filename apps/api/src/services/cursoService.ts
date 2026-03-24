import { CursoRepository } from "../repositories/cursoRepository.js";
import { prisma } from "../lib/prisma.js";

export class CursoService {
  private repo = new CursoRepository();

  listar(usuarioId: string) {
    return this.repo.findAll(usuarioId);
  }

  async buscarPorId(id: string, usuarioId: string) {
    // Verifica se o usuário tem acesso ao curso
    const membro = await prisma.cursoMembro.findUnique({
      where: { cursoId_usuarioId: { cursoId: id, usuarioId } },
    });

    // Admins globais têm acesso a tudo
    const usuario = await prisma.usuario.findUnique({
      where: { id: usuarioId },
      select: { papelGlobal: true },
    });

    if (!membro && usuario?.papelGlobal !== "ADMIN") {
      return null;
    }

    return this.repo.findById(id);
  }

  async criar(
    data: { codigo: string; nome: string; descricao?: string | undefined; chTotalPlanejada?: number | undefined },
    criadorId: string
  ) {
    const curso = await this.repo.create({
      codigo: data.codigo,
      nome: data.nome,
      descricao: data.descricao ?? null,
      chTotalPlanejada: data.chTotalPlanejada ?? 0,
      status: "RASCUNHO",
      membros: {
        create: { usuarioId: criadorId, papel: "ADMIN" },
      },
    });

    return curso;
  }

  atualizar(id: string, data: { nome?: string; descricao?: string; status?: any }) {
    return this.repo.update(id, data);
  }

  arquivar(id: string) {
    return this.repo.archive(id);
  }

  excluir(id: string) {
    return this.repo.delete(id);
  }
}
