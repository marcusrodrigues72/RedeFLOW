import type { Request, Response, NextFunction } from "express";
import { oaRepository } from "../repositories/oaRepository.js";
import { sendMail, tmplEtapaLiberada } from "../lib/mailer.js";

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
      const userId = req.usuario!.sub;
      const oas    = await oaRepository.findByUsuario(userId);

      // Filtra: mostra apenas etapas que pertencem ao usuário, não concluídas,
      // e cuja predecessora já esteja CONCLUIDA (ou seja a primeira etapa)
      const result = oas.map((oa) => {
        const etapasFiltradas = oa.etapas.filter((etapa) => {
          const isAssigned = etapa.responsavelId === userId || etapa.responsavelSecundarioId === userId;
          if (!isAssigned || etapa.status === "CONCLUIDA") return false;
          if (etapa.ordem === 0) return true;
          const predecessora = oa.etapas.find((e) => e.ordem === etapa.ordem - 1);
          return !predecessora || predecessora.status === "CONCLUIDA";
        });
        return { ...oa, etapas: etapasFiltradas };
      }).filter((oa) => oa.etapas.length > 0);

      res.json(result);
    } catch (err) { next(err); }
  };

  // PATCH /oas/:id
  atualizarOA = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { linkObjeto } = req.body as { linkObjeto?: string | null };
      const result = await oaRepository.updateOA(req.params["id"] as string, {
        ...(linkObjeto !== undefined ? { linkObjeto } : {}),
      });
      res.json(result);
    } catch (err) { next(err); }
  };

  // PATCH /oas/:id/etapas/:etapaId
  atualizarEtapa = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { status, responsavelId, responsavelSecundarioId, deadlineReal, deadlinePrevisto, recalcularSequencia, linkArtefato, templateGerado, templateOrganizado } = req.body as {
        status?: string;
        responsavelId?: string | null;
        responsavelSecundarioId?: string | null;
        deadlineReal?: string | null;
        deadlinePrevisto?: string | null;
        recalcularSequencia?: boolean;
        linkArtefato?: string | null;
        templateGerado?: boolean;
        templateOrganizado?: boolean;
      };

      // Verifica se o usuário é ADMIN (global ou do curso) — usado em múltiplas regras abaixo
      const { prisma: db } = await import("../lib/prisma.js");
      const usuario = await db.usuario.findUnique({ where: { id: req.usuario!.sub }, select: { papelGlobal: true } });
      let isAdmin = usuario?.papelGlobal === "ADMIN";
      if (!isAdmin) {
        const oaParaCheck = await db.objetoAprendizagem.findUnique({
          where: { id: req.params["id"] as string },
          select: { capitulo: { select: { unidade: { select: { cursoId: true } } } } },
        });
        const cursoId = oaParaCheck?.capitulo?.unidade?.cursoId;
        const membro  = cursoId ? await db.cursoMembro.findUnique({
          where: { cursoId_usuarioId: { cursoId, usuarioId: req.usuario!.sub } },
        }) : null;
        isAdmin = membro?.papel === "ADMIN";
      }

      // Edição de deadlinePrevisto exige papel ADMIN (global ou no curso)
      if (deadlinePrevisto !== undefined && !isAdmin) {
        res.status(403).json({ message: "Apenas administradores podem editar deadlines de etapas." });
        return;
      }

      // Busca dados anteriores ANTES do update para calcular o delta correto
      let todasEtapasAntes: { id: string; ordem: number; deadlinePrevisto: Date | null; etapaDef: { papel: string } }[] = [];
      if (recalcularSequencia && deadlinePrevisto) {
        const { prisma: db } = await import("../lib/prisma.js");
        todasEtapasAntes = await db.etapaOA.findMany({
          where:   { oaId: req.params["id"] as string },
          orderBy: { ordem: "asc" },
          select:  { id: true, ordem: true, deadlinePrevisto: true, etapaDef: { select: { papel: true } } },
        });
      }

      // Busca estado anterior para audit log (antes do update)
      const etapaAntes = await db.etapaOA.findUnique({
        where:  { id: req.params["etapaId"] as string },
        select: { status: true, responsavelId: true, responsavelSecundarioId: true, deadlinePrevisto: true, etapaDef: { select: { nome: true } } },
      });

      // Valida predecessora: só bloqueia CONCLUIDA se a etapa anterior não estiver CONCLUIDA (ADMINs são isentos)
      if (status === "CONCLUIDA" && !isAdmin) {
        const etapaAtual = await db.etapaOA.findUnique({
          where: { id: req.params["etapaId"] as string },
          select: { ordem: true, oaId: true, status: true },
        });
        if (etapaAtual && etapaAtual.ordem > 0 && status !== etapaAtual.status) {
          const predecessora = await db.etapaOA.findFirst({
            where: { oaId: etapaAtual.oaId, ordem: etapaAtual.ordem - 1 },
            select: { status: true, etapaDef: { select: { nome: true } } },
          });
          if (predecessora && predecessora.status !== "CONCLUIDA") {
            res.status(422).json({
              message: `A etapa anterior ("${predecessora.etapaDef.nome}") ainda não foi concluída.`,
            });
            return;
          }
        }
      }

      // Gate: Setup de Produção só pode ser concluído se o checklist estiver completo
      if (status === "CONCLUIDA") {
        const etapaParaGate = await db.etapaOA.findUnique({
          where:  { id: req.params["etapaId"] as string },
          select: {
            templateGerado:    true,
            templateOrganizado: true,
            etapaDef: { select: { papel: true } },
            oa: { select: { linkObjeto: true } },
          },
        });
        if (etapaParaGate?.etapaDef.papel === "COORDENADOR_PRODUCAO") {
          const tg  = templateGerado  ?? etapaParaGate.templateGerado;
          const to  = templateOrganizado ?? etapaParaGate.templateOrganizado;
          const lnk = etapaParaGate.oa.linkObjeto;
          if (!tg)  { res.status(422).json({ message: "Confirme que os templates foram gerados via Google Apps Script." }); return; }
          if (!to)  { res.status(422).json({ message: "Confirme que os templates foram organizados na pasta do projeto." }); return; }
          if (!lnk) { res.status(422).json({ message: "Adicione o link do template antes de concluir o Setup de Produção." }); return; }
        }
      }

      const etapa = await oaRepository.updateEtapa(req.params["etapaId"] as string, {
        status,
        responsavelId,
        responsavelSecundarioId,
        deadlineReal:     deadlineReal     ? new Date(deadlineReal)     : deadlineReal     === null ? null : undefined,
        deadlinePrevisto: deadlinePrevisto ? new Date(deadlinePrevisto) : deadlinePrevisto === null ? null : undefined,
        linkArtefato:     linkArtefato !== undefined ? linkArtefato : undefined,
        templateGerado:     templateGerado     !== undefined ? templateGerado     : undefined,
        templateOrganizado: templateOrganizado !== undefined ? templateOrganizado : undefined,
      });

      // Grava audit log com as mudanças realizadas
      {
        const mudancas: Record<string, { antes: unknown; depois: unknown }> = {};
        if (status !== undefined && etapaAntes?.status !== status)
          mudancas.status = { antes: etapaAntes?.status, depois: status };
        if (responsavelId !== undefined && etapaAntes?.responsavelId !== responsavelId)
          mudancas.responsavelId = { antes: etapaAntes?.responsavelId ?? null, depois: responsavelId ?? null };
        if (responsavelSecundarioId !== undefined && etapaAntes?.responsavelSecundarioId !== responsavelSecundarioId)
          mudancas.responsavelSecundarioId = { antes: etapaAntes?.responsavelSecundarioId ?? null, depois: responsavelSecundarioId ?? null };
        if (deadlinePrevisto !== undefined)
          mudancas.deadlinePrevisto = { antes: etapaAntes?.deadlinePrevisto?.toISOString() ?? null, depois: deadlinePrevisto ?? null };
        if (Object.keys(mudancas).length > 0) {
          await db.auditLog.create({
            data: {
              usuarioId:    req.usuario!.sub,
              acao:         "etapa.atualizada",
              entidadeTipo: "OA",
              entidadeId:   req.params["id"] as string,
              payloadAntes: { etapa: etapaAntes?.etapaDef.nome, ...Object.fromEntries(Object.entries(mudancas).map(([k, v]) => [k, v.antes])) },
              payloadDepois: { etapa: etapaAntes?.etapaDef.nome, ...Object.fromEntries(Object.entries(mudancas).map(([k, v]) => [k, v.depois])) },
              ip:           req.ip ?? null,
            },
          });
        }
      }

      // Recalcula etapas subsequentes
      if (recalcularSequencia && deadlinePrevisto && todasEtapasAntes.length > 0) {
        const { prisma: db } = await import("../lib/prisma.js");
        const etapaEditada = todasEtapasAntes.find((e) => e.id === req.params["etapaId"] as string);
        if (etapaEditada) {
          const novaData = new Date(deadlinePrevisto);

          if (etapaEditada.deadlinePrevisto) {
            // Caso 1: etapa já tinha deadline → desloca subsequentes pelo mesmo delta
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
          } else {
            // Caso 2: etapa sem deadline anterior → distribui subsequentes usando intervalos por tipo de OA e papel
            // Intervalos baseados em dados históricos do projeto Microeletrônica Geral (dias corridos)
            const INTERVALOS_VIDEO: Record<string, number> = {
              DESIGNER_INSTRUCIONAL: 2,  // Conteudista → DI
              PROFESSOR_ATOR:        3,  // DI → Gravação
              PROFESSOR_TECNICO:     4,  // Gravação → Revisão Técnica
              ACESSIBILIDADE:        7,  // RT → Acessibilidade
              PRODUTOR_FINAL:        3,  // Acessibilidade → Produção Final
              VALIDADOR_FINAL:       1,  // Produção Final → Validação Final
            };
            const INTERVALOS_PADRAO: Record<string, number> = {
              DESIGNER_INSTRUCIONAL: 2,  // Conteudista → DI
              PROFESSOR_TECNICO:     3,  // DI → Revisão Técnica
              ACESSIBILIDADE:        7,  // RT → Acessibilidade
              PRODUTOR_FINAL:        5,  // Acessibilidade → Produção Final (mais tempo sem Gravação)
              VALIDADOR_FINAL:       1,  // Produção Final → Validação Final
            };

            const oaInfo = await db.objetoAprendizagem.findUnique({
              where:  { id: req.params["id"] as string },
              select: { tipo: true },
            });
            const intervalos = oaInfo?.tipo === "VIDEO" ? INTERVALOS_VIDEO : INTERVALOS_PADRAO;

            const subsequentes = todasEtapasAntes
              .filter((e) => e.ordem > etapaEditada.ordem && !e.deadlinePrevisto)
              .sort((a, b) => a.ordem - b.ordem);
            let dataBase = novaData;
            for (const e of subsequentes) {
              const dias = intervalos[e.etapaDef.papel] ?? 3;
              dataBase = new Date(dataBase.getTime() + dias * 24 * 60 * 60 * 1000);
              await db.etapaOA.update({
                where: { id: e.id },
                data:  { deadlinePrevisto: dataBase },
              });
            }
            // Atualiza deadlineFinal do OA com a data da última etapa propagada
            const dataFinal = subsequentes.length > 0 ? dataBase : novaData;
            await db.objetoAprendizagem.update({ where: { id: req.params["id"] as string }, data: { deadlineFinal: dataFinal } });
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

      // Auto-ativa o curso quando o primeiro Setup de Produção é concluído
      if (status === "CONCLUIDA" && oa) {
        const etapaAtualizada = oa.etapas.find((e) => e.id === req.params["etapaId"]);
        if (etapaAtualizada?.etapaDef.papel === "COORDENADOR_PRODUCAO") {
          const { prisma: db } = await import("../lib/prisma.js");
          const cursoId = oa.capitulo.unidade.cursoId;
          const cursoAtual = await db.curso.findUnique({ where: { id: cursoId }, select: { status: true } });
          if (cursoAtual?.status === "RASCUNHO") {
            await db.curso.update({ where: { id: cursoId }, data: { status: "ATIVO" } });
          }
        }
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

          // Envia e-mail ao responsável (fire-and-forget — falha não bloqueia resposta)
          const responsavel = await db.usuario.findUnique({
            where:  { id: proximaEtapa.responsavelId },
            select: { nome: true, email: true },
          });
          if (responsavel) {
            sendMail(tmplEtapaLiberada({
              email:     responsavel.email,
              nome:      responsavel.nome,
              oaCodigo:  oa.codigo,
              etapaNome: proximaEtapa.etapaDef.nome,
              deadline:  proximaEtapa.deadlinePrevisto?.toISOString() ?? null,
              oaId:      oa.id,
            })).catch(() => {/* falha já logada no mailer */});
          }
        }
      }

      res.json(etapa);
    } catch (err) { next(err); }
  };
}
