/**
 * RF-M7-07 — Webhook / integração
 *
 * Emite eventos via HTTP POST para URLs configuradas.
 * Assina o payload com HMAC-SHA256 quando um segredo está configurado.
 *
 * Payload enviado:
 * {
 *   "evento":    "oa.concluido" | "oa.atrasado",
 *   "timestamp": "2026-04-27T10:00:00.000Z",
 *   "dados":     { ... }
 * }
 *
 * Headers enviados:
 *   Content-Type: application/json
 *   X-RedeFlow-Event: <evento>
 *   X-RedeFlow-Signature: sha256=<hmac> (apenas quando segredo configurado)
 *   User-Agent: RedeFlow-Webhook/1.0
 */
import crypto from "node:crypto";
import { prisma } from "./prisma.js";
import { logger } from "./logger.js";

export type WebhookEvento = "oa.concluido" | "oa.atrasado";

export interface WebhookPayload {
  evento:    WebhookEvento;
  timestamp: string;
  dados:     Record<string, unknown>;
}

/** Assina o body com HMAC-SHA256 e retorna "sha256=<hex>". */
function assinar(segredo: string, body: string): string {
  return "sha256=" + crypto.createHmac("sha256", segredo).update(body).digest("hex");
}

/**
 * Emite um evento para todos os webhooks ativos que escutam aquele evento.
 * Filtra por cursoId quando fornecido (webhooks globais e do curso recebem).
 * Fire-and-forget: erros são apenas logados, nunca lançados.
 */
export async function emitirWebhook(
  evento: WebhookEvento,
  dados:  Record<string, unknown>,
  cursoId?: string,
): Promise<void> {
  let webhooks;
  try {
    webhooks = await prisma.webhook.findMany({
      where: {
        ativo:   true,
        eventos: { has: evento },
        ...(cursoId ? { OR: [{ cursoId: null }, { cursoId }] } : {}),
      },
      select: { id: true, url: true, segredo: true, nome: true },
    });
  } catch (err) {
    logger.error({ err, evento }, "❌ webhookEmitter: erro ao buscar webhooks");
    return;
  }

  if (webhooks.length === 0) return;

  const payload: WebhookPayload = {
    evento,
    timestamp: new Date().toISOString(),
    dados,
  };

  const body = JSON.stringify(payload);

  await Promise.allSettled(
    webhooks.map(async (wh) => {
      const headers: Record<string, string> = {
        "Content-Type":    "application/json",
        "X-RedeFlow-Event": evento,
        "User-Agent":      "RedeFlow-Webhook/1.0",
      };
      if (wh.segredo) {
        headers["X-RedeFlow-Signature"] = assinar(wh.segredo, body);
      }

      try {
        const ctrl = new AbortController();
        const timer = setTimeout(() => ctrl.abort(), 10_000); // 10s timeout

        const resp = await fetch(wh.url, {
          method:  "POST",
          headers,
          body,
          signal:  ctrl.signal,
        });

        clearTimeout(timer);

        if (!resp.ok) {
          logger.warn(
            { webhookId: wh.id, nome: wh.nome, status: resp.status, evento },
            "⚠️ Webhook retornou status não-ok",
          );
        } else {
          logger.info(
            { webhookId: wh.id, nome: wh.nome, evento },
            "✅ Webhook enviado com sucesso",
          );
        }
      } catch (err) {
        logger.error(
          { err, webhookId: wh.id, nome: wh.nome, evento },
          "❌ Erro ao enviar webhook",
        );
      }
    }),
  );
}
