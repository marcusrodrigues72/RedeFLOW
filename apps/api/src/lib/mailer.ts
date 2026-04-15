/**
 * Serviço de e-mail transacional via SendGrid.
 *
 * Se SENDGRID_API_KEY não estiver definida, os envios são apenas logados
 * (modo "dry-run") para não bloquear a aplicação em desenvolvimento.
 */
import sgMail from "@sendgrid/mail";
import { logger } from "./logger.js";

const apiKey  = process.env["SENDGRID_API_KEY"];
const FROM    = process.env["EMAIL_FROM"]  ?? "noreply@redeflow.com.br";
const APP_URL = process.env["APP_URL"]     ?? "http://localhost:5173";

export const mailerEnabled = Boolean(apiKey);

if (apiKey) {
  sgMail.setApiKey(apiKey);
  logger.info("📧 Mailer SendGrid inicializado.");
} else {
  logger.warn("⚠️  SENDGRID_API_KEY não definida — e-mails em modo dry-run.");
}

// ─── Tipos ────────────────────────────────────────────────────────────────────

export interface MailPayload {
  to:      string;
  subject: string;
  html:    string;
}

// ─── Envio ────────────────────────────────────────────────────────────────────

export async function sendMail(payload: MailPayload): Promise<void> {
  if (!mailerEnabled) {
    logger.info({ to: payload.to, subject: payload.subject }, "📧 [dry-run] e-mail não enviado");
    return;
  }
  try {
    await sgMail.send({ from: FROM, to: payload.to, subject: payload.subject, html: payload.html });
    logger.info({ to: payload.to, subject: payload.subject }, "📧 E-mail enviado");
  } catch (err: any) {
    // Falha no envio não deve derrubar o fluxo principal
    logger.error({ err: err?.response?.body ?? err }, "❌ Falha ao enviar e-mail");
  }
}

// ─── Layout base ─────────────────────────────────────────────────────────────

function layout(corpoHtml: string): string {
  return `
<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>RedeFLOW</title>
</head>
<body style="margin:0;padding:0;background:#f1f5f9;font-family:Inter,Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f1f5f9;padding:32px 0;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.08);">
        <!-- Header -->
        <tr><td style="background:#2b7cee;padding:24px 32px;">
          <span style="color:#ffffff;font-size:22px;font-weight:800;letter-spacing:-0.5px;">RedeFLOW</span>
          <span style="color:#bfdbfe;font-size:13px;margin-left:12px;">iRede EAD</span>
        </td></tr>
        <!-- Body -->
        <tr><td style="padding:32px;">
          ${corpoHtml}
        </td></tr>
        <!-- Footer -->
        <tr><td style="background:#f8fafc;padding:20px 32px;border-top:1px solid #e2e8f0;">
          <p style="margin:0;font-size:12px;color:#94a3b8;text-align:center;">
            Este é um e-mail automático do RedeFLOW. Não responda a esta mensagem.<br/>
            <a href="${APP_URL}" style="color:#2b7cee;text-decoration:none;">Acessar o sistema</a>
          </p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

function btnPrimario(href: string, texto: string): string {
  return `<a href="${href}" style="display:inline-block;margin-top:24px;padding:12px 28px;background:#2b7cee;color:#ffffff;font-size:14px;font-weight:700;border-radius:8px;text-decoration:none;">${texto}</a>`;
}

// ─── Templates ────────────────────────────────────────────────────────────────

/** Disparado quando a etapa anterior é concluída e a próxima é liberada. */
export function tmplEtapaLiberada(p: {
  email:     string;
  nome:      string;
  oaCodigo:  string;
  etapaNome: string;
  deadline:  string | null;
  oaId:      string;
}): MailPayload {
  const dlTxt = p.deadline
    ? `<p style="margin:8px 0 0;color:#64748b;font-size:14px;">📅 Deadline previsto: <strong>${new Date(p.deadline).toLocaleDateString("pt-BR")}</strong></p>`
    : "";
  return {
    to:      p.email,
    subject: `RedeFLOW — Sua etapa foi liberada: ${p.etapaNome} (${p.oaCodigo})`,
    html: layout(`
      <h2 style="margin:0 0 8px;color:#1e293b;font-size:20px;">🎉 Etapa liberada!</h2>
      <p style="margin:0 0 20px;color:#475569;font-size:15px;">Olá, <strong>${p.nome}</strong>! A etapa anterior foi concluída e a sua etapa está pronta para início.</p>
      <div style="background:#eff6ff;border-left:4px solid #2b7cee;border-radius:6px;padding:16px 20px;">
        <p style="margin:0;color:#1e40af;font-size:15px;font-weight:700;">${p.etapaNome}</p>
        <p style="margin:4px 0 0;color:#3b82f6;font-size:13px;font-family:monospace;">${p.oaCodigo}</p>
        ${dlTxt}
      </div>
      ${btnPrimario(`${APP_URL}/oas/${p.oaId}`, "Abrir OA no RedeFLOW")}
    `),
  };
}

/** Disparado pelo cron diário para etapas com deadline já vencido. */
export function tmplDeadlineVencido(p: {
  email:     string;
  nome:      string;
  oaCodigo:  string;
  etapaNome: string;
  deadline:  string;
  diasAtraso: number;
  oaId:      string;
}): MailPayload {
  return {
    to:      p.email,
    subject: `RedeFLOW ⚠ Prazo vencido: ${p.etapaNome} (${p.oaCodigo})`,
    html: layout(`
      <h2 style="margin:0 0 8px;color:#dc2626;font-size:20px;">⚠ Prazo vencido</h2>
      <p style="margin:0 0 20px;color:#475569;font-size:15px;">Olá, <strong>${p.nome}</strong>! Uma etapa sob sua responsabilidade está com o prazo vencido.</p>
      <div style="background:#fff5f5;border-left:4px solid #ef4444;border-radius:6px;padding:16px 20px;">
        <p style="margin:0;color:#991b1b;font-size:15px;font-weight:700;">${p.etapaNome}</p>
        <p style="margin:4px 0 0;color:#ef4444;font-size:13px;font-family:monospace;">${p.oaCodigo}</p>
        <p style="margin:8px 0 0;color:#64748b;font-size:14px;">
          📅 Prazo: <strong>${new Date(p.deadline).toLocaleDateString("pt-BR")}</strong>
          &nbsp;·&nbsp; <strong style="color:#dc2626;">${p.diasAtraso} dia${p.diasAtraso !== 1 ? "s" : ""} em atraso</strong>
        </p>
      </div>
      ${btnPrimario(`${APP_URL}/oas/${p.oaId}`, "Abrir OA no RedeFLOW")}
    `),
  };
}

/** Enviado quando o usuário solicita recuperação de senha. */
export function tmplRecuperacaoSenha(p: {
  email: string;
  nome:  string;
  link:  string;
}): MailPayload {
  return {
    to:      p.email,
    subject: "RedeFLOW — Recuperação de senha",
    html: layout(`
      <h2 style="margin:0 0 8px;color:#1e293b;font-size:20px;">🔑 Recuperação de senha</h2>
      <p style="margin:0 0 20px;color:#475569;font-size:15px;">Olá, <strong>${p.nome}</strong>! Recebemos uma solicitação de recuperação de senha para sua conta.</p>
      <div style="background:#eff6ff;border-left:4px solid #2b7cee;border-radius:6px;padding:16px 20px;margin-bottom:8px;">
        <p style="margin:0;color:#1e40af;font-size:14px;">Clique no botão abaixo para criar uma nova senha. O link é válido por <strong>1 hora</strong>.</p>
      </div>
      ${btnPrimario(p.link, "Criar nova senha")}
      <p style="margin:24px 0 0;color:#94a3b8;font-size:12px;">
        Se você não solicitou a recuperação de senha, ignore este e-mail. Sua senha permanecerá a mesma.
      </p>
    `),
  };
}

/** Disparado pelo cron diário para etapas com deadline em até 3 dias. */
export function tmplPrazoProximo(p: {
  email:     string;
  nome:      string;
  oaCodigo:  string;
  etapaNome: string;
  deadline:  string;
  diasRestantes: number;
  oaId:      string;
}): MailPayload {
  const cor = p.diasRestantes <= 1 ? "#f59e0b" : "#0891b2";
  return {
    to:      p.email,
    subject: `RedeFLOW 🔔 Prazo se aproximando: ${p.etapaNome} (${p.oaCodigo})`,
    html: layout(`
      <h2 style="margin:0 0 8px;color:${cor};font-size:20px;">🔔 Prazo se aproximando</h2>
      <p style="margin:0 0 20px;color:#475569;font-size:15px;">Olá, <strong>${p.nome}</strong>! O prazo de uma etapa sua está próximo do vencimento.</p>
      <div style="background:#fffbeb;border-left:4px solid ${cor};border-radius:6px;padding:16px 20px;">
        <p style="margin:0;color:#92400e;font-size:15px;font-weight:700;">${p.etapaNome}</p>
        <p style="margin:4px 0 0;font-size:13px;font-family:monospace;color:#b45309;">${p.oaCodigo}</p>
        <p style="margin:8px 0 0;color:#64748b;font-size:14px;">
          📅 Prazo: <strong>${new Date(p.deadline).toLocaleDateString("pt-BR")}</strong>
          &nbsp;·&nbsp; Faltam <strong style="color:${cor};">${p.diasRestantes} dia${p.diasRestantes !== 1 ? "s" : ""}</strong>
        </p>
      </div>
      ${btnPrimario(`${APP_URL}/oas/${p.oaId}`, "Abrir OA no RedeFLOW")}
    `),
  };
}
