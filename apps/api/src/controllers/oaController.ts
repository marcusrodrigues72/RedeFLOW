import type { Request, Response, NextFunction } from "express";
import { oaRepository } from "../repositories/oaRepository.js";

export class OAController {
  // GET /cursos/:id/oas?status=&tipo=
  listarByCurso = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { status, tipo } = req.query as Record<string, string>;
      const oas = await oaRepository.findByCurso(req.params["id"] as string, { status, tipo });
      res.json(oas);
    } catch (err) { next(err); }
  };

  // GET /oas/:id
  buscar = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const oa = await oaRepository.findById(req.params["id"] as string);
      if (!oa) { res.status(404).json({ message: "OA não encontrado." }); return; }
      res.json(oa);
    } catch (err) { next(err); }
  };

  // GET /meu-trabalho
  meuTrabalho = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const oas = await oaRepository.findByUsuario(req.usuario!.sub);
      res.json(oas);
    } catch (err) { next(err); }
  };

  // PATCH /oas/:id/etapas/:etapaId
  atualizarEtapa = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { status, responsavelId, deadlineReal, deadlinePrevisto, recalcularSequencia } = req.body as {
        status?: string;
        responsavelId?: string | null;
        deadlineReal?: string | null;
        deadlinePrevisto?: string | null;
        recalcularSequencia?: boolean;
      };

      // Edição de deadlinePrevisto exige papel ADMIN (global ou no curso)
      if (deadlinePrevisto !== undefined) {
        const { prisma: db } = await import("../lib/prisma.js");
        const usuario = await db.usuario.findUnique({ where: { id: req.usuario!.sub }, select: { papelGlobal: true } });
        if (usuario?.papelGlobal !== "ADMIN") {
          // Verifica se é ADMIN do curso ao qual o OA pertence
          const oaParaCheck = await db.objetoAprendizagem.findUnique({
            where: { id: req.params["id"] as string },
            select: { capitulo: { select: { unidade: { select: { cursoId: true } } } } },
          });
          const cursoId = oaParaCheck?.capitulo?.unidade?.cursoId;
          const membro  = cursoId ? await db.cursoMembro.findUnique({
            where: { cursoId_usuarioId: { cursoId, usuarioId: req.usuario!.sub } },
          }) : null;
          if (membro?.papel !== "ADMIN") {
            res.status(403).json({ message: "Apenas administradores podem editar deadlines de etapas." });
            return;
          }
        }
      }

      // Busca dados anteriores ANTES do update para calcular o delta correto
      let todasEtapasAntes: { id: string; ordem: number; deadlinePrevisto: Date | null }[] = [];
      if (recalcularSequencia && deadlinePrevisto) {
        const { prisma: db } = await import("../lib/prisma.js");
        todasEtapasAntes = await db.etapaOA.findMany({
          where:   { oaId: req.params["id"] as string },
          orderBy: { ordem: "asc" },
          select:  { id: true, ordem: true, deadlinePrevisto: true },
        });
      }

      const etapa = await oaRepository.updateEtapa(req.params["etapaId"] as string, {
        status,
        responsavelId,
        deadlineReal:     deadlineReal     ? new Date(deadlineReal)     : deadlineReal     === null ? null : undefined,
        deadlinePrevisto: deadlinePrevisto ? new Date(deadlinePrevisto) : deadlinePrevisto === null ? null : undefined,
      });

      // Recalcula etapas subsequentes deslocando pelo mesmo delta
      if (recalcularSequencia && deadlinePrevisto && todasEtapasAntes.length > 0) {
        const { prisma: db } = await import("../lib/prisma.js");
        const etapaEditada = todasEtapasAntes.find((e) => e.id === req.params["etapaId"] as string);
        if (etapaEditada?.deadlinePrevisto) {
          const novaData     = new Date(deadlinePrevisto);
          const deltaMs      = novaData.getTime() - etapaEditada.deadlinePrevisto.getTime();
          const subsequentes = todasEtapasAntes.filter((e) => e.ordem > etapaEditada.ordem && e.deadlinePrevisto);
          for (const e of subsequentes) {
            await db.etapaOA.update({
              where: { id: e.id },
              data:  { deadlinePrevisto: new Date(e.deadlinePrevisto!.getTime() + deltaMs) },
            });
          }
          // Atualiza deadlineFinal do OA com base na última etapa pós-ajuste
          const ultima = todasEtapasAntes[todasEtapasAntes.length - 1];
          if (ultima) {
            const novoFinal = ultima.id === etapaEditada.id
              ? novaData
              : ultima.deadlinePrevisto
                ? new Date(ultima.deadlinePrevisto.getTime() + (ultima.ordem > etapaEditada.ordem ? deltaMs : 0))
                : null;
            if (novoFinal) {
              await db.objetoAprendizagem.update({ where: { id: req.params["id"] as string }, data: { deadlineFinal: novoFinal } });
            }
          }
        }
      }

      // Recalcula progressoPct do OA
      const oa = await oaRepository.findById(req.params["id"] as string);
      if (oa) {
        const total      = oa.etapas.length;
        const concluidas  = oa.etapas.filter((e) => e.status === "CONCLUIDA").length;
        const temBloqueio = oa.etapas.some((e) => e.status === "BLOQUEADA");
        const pct = total > 0 ? Math.round((concluidas / total) * 100) : 0;
        const novoStatus = pct >= 100 ? "CONCLUIDO"
          : temBloqueio     ? "BLOQUEADO"
          : pct > 0         ? "EM_ANDAMENTO"
          : "PENDENTE";

        const { prisma } = await import("../lib/prisma.js");
        await prisma.objetoAprendizagem.update({
          where: { id: oa.id },
          data:  { progressoPct: pct, status: novoStatus },
        });
      }

      // Notifica responsável da próxima etapa quando a atual é concluída
      if (status === "CONCLUIDA" && oa) {
        const { prisma: db } = await import("../lib/prisma.js");
        const etapaAtualizada = oa.etapas.find((e) => e.id === req.params["etapaId"]);
        const proximaEtapa    = oa.etapas.find((e) => e.ordem === (etapaAtualizada?.ordem ?? 0) + 1);
        if (proximaEtapa?.responsavelId) {
          await db.notificacao.create({
            data: {
              usuarioId:    proximaEtapa.responsavelId,
              tipo:         "ETAPA_LIBERADA",
              titulo:       `Etapa liberada: ${proximaEtapa.etapaDef.nome}`,
              corpo:        `O OA ${oa.codigo} está aguardando sua ação na etapa "${proximaEtapa.etapaDef.nome}".`,
              entidadeTipo: "OA",
              entidadeId:   oa.id,
            },
          });
        }
      }

      res.json(etapa);
    } catch (err) { next(err); }
  };
}
