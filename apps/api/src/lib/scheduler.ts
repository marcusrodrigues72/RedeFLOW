/**
 * Scheduler de notificações de prazo.
 *
 * Jobs diários (08:00):
 *   - DEADLINE_VENCIDO  → etapas com deadlinePrevisto < hoje, não concluídas
 *   - PRAZO_PROXIMO     → etapas com deadline em até N dias (configável por curso), não concluídas
 *
 * Deduplicação: antes de criar notificação/enviar e-mail, verifica se já
 * existe uma notificação do mesmo tipo para a mesma entidade + usuário nas últimas 22h.
 *
 * Configuração por curso: cada curso pode ter um ConfigAlertaCurso com:
 *   - diasAntecedencia: quantos dias antes do deadline para PRAZO_PROXIMO (padrão: 3)
 *   - alertDeadlineVencido, alertPrazoProximo: flags para habilitar/desabilitar tipos de alerta
 *
 * Preferências por membro: CursoMembro.notifEmailAtivo / notifInAppAtivo controlam
 * se o membro recebe e-mail e/ou notificação in-app para aquele curso específico.
 * O flag global Usuario.notifEmailAtivo também é respeitado.
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

/** Retorna true se já existe notificação recente (< 22h) desse tipo para a entidade e usuário. */
async function jaNotificado(tipo: string, entidadeId: string, usuarioId: string): Promise<boolean> {
  const desde = new Date(Date.now() - 22 * 3_600_000);
  const count = await prisma.notificacao.count({
    where: { tipo, entidadeId, usuarioId, createdAt: { gte: desde } },
  });
  return count > 0;
}

const DEFAULT_CONFIG = {
  diasAntecedencia:     3,
  alertDeadlineVencido: true,
  alertPrazoProximo:    true,
  alertEtapaLiberada:   true,
  alertMencao:          true,
};

// ─── Job principal ────────────────────────────────────────────────────────────

export async function runDeadlineChecks(): Promise<void> {
  const hoje = startOfDay();

  logger.info("⏰ Scheduler: verificando deadlines...");

  // Carrega etapas pendentes/em andamento com deadline definido e responsável
  const etapas = await prisma.etapaOA.findMany({
    where: {
      deadlinePrevisto: { not: null },
      status:           { in: ["PENDENTE", "EM_ANDAMENTO"] },
      responsavel:      { isNot: null },
    },
    include: {
      responsavel: {
        select: { id: true, nome: true, email: true, notifEmailAtivo: true },
      },
      etapaDef: { select: { nome: true } },
      oa: {
        select: {
          id:       true,
          codigo:   true,
          capitulo: {
            select: {
              unidade: { select: { cursoId: true } },
            },
          },
        },
      },
    },
  });

  // ── Coleta cursoIds únicos e responsavelIds únicos ──────────────────────────
  const cursoIds      = [...new Set(etapas.map(e => e.oa.capitulo.unidade.cursoId))];
  const responsavelIds = [...new Set(etapas.map(e => e.responsavelId).filter(Boolean) as string[])];

  // ── Carrega configs de alertas por curso ────────────────────────────────────
  const configsRaw = await prisma.configAlertaCurso.findMany({
    where: { cursoId: { in: cursoIds } },
  });
  const configMap = new Map(configsRaw.map(c => [c.cursoId, c]));

  // ── Carrega preferências de notificação por membro por curso ─────────────────
  const membroPrefs = await prisma.cursoMembro.findMany({
    where: {
      cursoId:   { in: cursoIds },
      usuarioId: { in: responsavelIds },
    },
    select: {
      cursoId:         true,
      usuarioId:       true,
      notifEmailAtivo: true,
      notifInAppAtivo: true,
    },
  });
  // chave: "cursoId:usuarioId"
  const membroMap = new Map(membroPrefs.map(m => [`${m.cursoId}:${m.usuarioId}`, m]));

  let enviados = 0;
  let inApp    = 0;

  for (const etapa of etapas) {
    if (!etapa.responsavel || !etapa.deadlinePrevisto) continue;

    const cursoId  = etapa.oa.capitulo.unidade.cursoId;
    const resp     = etapa.responsavel;

    // Config do curso (com fallback para defaults)
    const config   = { ...DEFAULT_CONFIG, ...(configMap.get(cursoId) ?? {}) };

    // Preferência por membro/curso (pode ser undefined se não for membro registrado)
    const membroPref = membroMap.get(`${cursoId}:${resp.id}`);

    // Flags combinados: global E por curso/membro
    const podeEmail = resp.notifEmailAtivo !== false && (membroPref?.notifEmailAtivo !== false);
    const podeInApp = membroPref?.notifInAppAtivo !== false;

    const dl        = startOfDay(etapa.deadlinePrevisto);
    const emNDias   = addDays(hoje, config.diasAntecedencia);

    const vencido   = dl < hoje;
    const proximo   = !vencido && dl <= emNDias;

    if (!vencido && !proximo) continue;

    // OA id é usado como entidadeId para navegação no frontend
    const oaId = etapa.oa.id;

    if (vencido && config.alertDeadlineVencido) {
      if (await jaNotificado("DEADLINE_VENCIDO", oaId, resp.id)) continue;

      const diasAtraso = diffDays(dl, hoje);

      if (podeInApp) {
        await prisma.notificacao.create({
          data: {
            usuarioId:    resp.id,
            tipo:         "DEADLINE_VENCIDO",
            titulo:       `Prazo vencido: ${etapa.etapaDef.nome} — ${etapa.oa.codigo}`,
            corpo:        `O prazo da etapa "${etapa.etapaDef.nome}" do OA ${etapa.oa.codigo} venceu há ${diasAtraso} dia${diasAtraso !== 1 ? "s" : ""}.`,
            entidadeTipo: "OA",
            entidadeId:   oaId,
          },
        });
        inApp++;
      }

      if (podeEmail) {
        await sendMail(tmplDeadlineVencido({
          email:      resp.email,
          nome:       resp.nome,
          oaCodigo:   etapa.oa.codigo,
          etapaNome:  etapa.etapaDef.nome,
          deadline:   etapa.deadlinePrevisto.toISOString(),
          diasAtraso,
          oaId,
        }));
        enviados++;
      }

    } else if (proximo && config.alertPrazoProximo) {
      if (await jaNotificado("PRAZO_PROXIMO", oaId, resp.id)) continue;

      const diasRestantes = Math.max(0, diffDays(hoje, dl));

      if (podeInApp) {
        await prisma.notificacao.create({
          data: {
            usuarioId:    resp.id,
            tipo:         "PRAZO_PROXIMO",
            titulo:       `Prazo próximo: ${etapa.etapaDef.nome} — ${etapa.oa.codigo}`,
            corpo:        `A etapa "${etapa.etapaDef.nome}" do OA ${etapa.oa.codigo} vence em ${diasRestantes} dia${diasRestantes !== 1 ? "s" : ""}.`,
            entidadeTipo: "OA",
            entidadeId:   oaId,
          },
        });
        inApp++;
      }

      if (podeEmail) {
        await sendMail(tmplPrazoProximo({
          email:         resp.email,
          nome:          resp.nome,
          oaCodigo:      etapa.oa.codigo,
          etapaNome:     etapa.etapaDef.nome,
          deadline:      etapa.deadlinePrevisto.toISOString(),
          diasRestantes,
          oaId,
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
