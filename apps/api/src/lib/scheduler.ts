/**
 * Scheduler de notificações de prazo.
 *
 * Jobs diários (08:00):
 *   - DEADLINE_VENCIDO  → etapas com deadlinePrevisto < hoje, não concluídas
 *   - PRAZO_PROXIMO     → etapas com deadline em até 3 dias, não concluídas
 *
 * Deduplicação: antes de criar notificação/enviar e-mail, verifica se já
 * existe uma notificação do mesmo tipo para a mesma entidade nas últimas 22h.
 */
import cron from "node-cron";
import { prisma } from "./prisma.js";
import { logger } from "./logger.js";
import { sendMail, tmplDeadlineVencido, tmplPrazoProximo } from "./mailer.js";

// ─── Helpers ─────────────────────────────────────────────────────────────────

function startOfDay(d = new Date()): Date {
  const r = new Date(d);
  r.setHours(0, 0, 0, 0);
  return r;
}

function addDays(d: Date, n: number): Date {
  const r = new Date(d);
  r.setDate(r.getDate() + n);
  return r;
}

function diffDays(a: Date, b: Date): number {
  return Math.round((b.getTime() - a.getTime()) / 86_400_000);
}

/** Retorna true se já existe notificação recente (< 22h) desse tipo para a entidade. */
async function jaNotificado(tipo: string, entidadeId: string): Promise<boolean> {
  const desde = new Date(Date.now() - 22 * 3_600_000);
  const count = await prisma.notificacao.count({
    where: { tipo, entidadeId, createdAt: { gte: desde } },
  });
  return count > 0;
}

// ─── Job principal ────────────────────────────────────────────────────────────

export async function runDeadlineChecks(): Promise<void> {
  const hoje      = startOfDay();
  const em3Dias   = addDays(hoje, 3);
  const em1Dia    = addDays(hoje, 1);

  logger.info("⏰ Scheduler: verificando deadlines...");

  // Carrega etapas pendentes/em andamento com deadline definido e responsável com e-mail
  const etapas = await prisma.etapaOA.findMany({
    where: {
      deadlinePrevisto: { not: null },
      status:           { in: ["PENDENTE", "EM_ANDAMENTO"] },
      responsavel:      { isNot: null },
    },
    include: {
      responsavel: { select: { id: true, nome: true, email: true, notifEmailAtivo: true } },
      etapaDef:    { select: { nome: true } },
      oa:          { select: { id: true, codigo: true } },
    },
  });

  let enviados = 0;
  let inApp    = 0;

  for (const etapa of etapas) {
    if (!etapa.responsavel || !etapa.deadlinePrevisto) continue;

    const dl       = startOfDay(etapa.deadlinePrevisto);
    const resp     = etapa.responsavel;
    const vencido  = dl < hoje;
    const proximo  = !vencido && dl <= em3Dias;

    if (!vencido && !proximo) continue;

    if (vencido) {
      const jaFeito = await jaNotificado("DEADLINE_VENCIDO", etapa.id);
      if (jaFeito) continue;
      const enviarEmail = resp.notifEmailAtivo !== false;

      const diasAtraso = diffDays(dl, hoje);

      // Notificação in-app
      await prisma.notificacao.create({
        data: {
          usuarioId:    resp.id,
          tipo:         "DEADLINE_VENCIDO",
          titulo:       `Prazo vencido: ${etapa.etapaDef.nome} — ${etapa.oa.codigo}`,
          corpo:        `O prazo da etapa "${etapa.etapaDef.nome}" do OA ${etapa.oa.codigo} venceu há ${diasAtraso} dia${diasAtraso !== 1 ? "s" : ""}.`,
          entidadeTipo: "ETAPA",
          entidadeId:   etapa.id,
        },
      });
      inApp++;

      // E-mail (respeitando preferência do usuário)
      if (enviarEmail) {
        await sendMail(tmplDeadlineVencido({
          email:      resp.email,
          nome:       resp.nome,
          oaCodigo:   etapa.oa.codigo,
          etapaNome:  etapa.etapaDef.nome,
          deadline:   etapa.deadlinePrevisto.toISOString(),
          diasAtraso,
          oaId:       etapa.oa.id,
        }));
        enviados++;
      }

    } else if (proximo) {
      const jaFeito = await jaNotificado("PRAZO_PROXIMO", etapa.id);
      if (jaFeito) continue;
      const enviarEmail = resp.notifEmailAtivo !== false;

      const diasRestantes = Math.max(0, diffDays(hoje, dl));

      // Notificação in-app
      await prisma.notificacao.create({
        data: {
          usuarioId:    resp.id,
          tipo:         "PRAZO_PROXIMO",
          titulo:       `Prazo próximo: ${etapa.etapaDef.nome} — ${etapa.oa.codigo}`,
          corpo:        `A etapa "${etapa.etapaDef.nome}" do OA ${etapa.oa.codigo} vence em ${diasRestantes} dia${diasRestantes !== 1 ? "s" : ""}.`,
          entidadeTipo: "ETAPA",
          entidadeId:   etapa.id,
        },
      });
      inApp++;

      // E-mail (respeitando preferência do usuário)
      if (enviarEmail) {
        await sendMail(tmplPrazoProximo({
          email:         resp.email,
          nome:          resp.nome,
          oaCodigo:      etapa.oa.codigo,
          etapaNome:     etapa.etapaDef.nome,
          deadline:      etapa.deadlinePrevisto.toISOString(),
          diasRestantes,
          oaId:          etapa.oa.id,
        }));
        enviados++;
      }
    }
  }

  logger.info({ inApp, emails: enviados }, "⏰ Scheduler: deadline checks concluídos");
}

// ─── Inicialização ────────────────────────────────────────────────────────────

export function startScheduler(): void {
  // Executa diariamente às 08:00 (fuso do servidor)
  cron.schedule("0 8 * * *", () => {
    runDeadlineChecks().catch((err) =>
      logger.error({ err }, "❌ Erro no scheduler de deadlines")
    );
  });

  logger.info("⏰ Scheduler iniciado — deadline checks às 08:00 diariamente.");
}
