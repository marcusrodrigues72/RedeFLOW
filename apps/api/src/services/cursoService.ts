import { CursoRepository } from "../repositories/cursoRepository.js";
import { prisma } from "../lib/prisma.js";

export class CursoService {
  private repo = new CursoRepository();

  listar(usuarioId: string, papelGlobal?: string) {
    return this.repo.findAll(usuarioId, papelGlobal === "ADMIN");
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

  atualizar(id: string, data: { nome?: string | undefined; descricao?: string | undefined; status?: any }) {
    const clean = Object.fromEntries(Object.entries(data).filter(([, v]) => v !== undefined));
    return this.repo.update(id, clean as Parameters<typeof this.repo.update>[1]);
  }

  arquivar(id: string) {
    return this.repo.archive(id);
  }

  excluir(id: string) {
    return this.repo.delete(id);
  }
}
