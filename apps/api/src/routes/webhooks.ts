/**
 * RF-M7-07 — CRUD de Webhooks (Admin only)
 *
 * GET    /webhooks           — lista todos os webhooks
 * POST   /webhooks           — cria um webhook
 * PATCH  /webhooks/:id       — atualiza um webhook
 * DELETE /webhooks/:id       — remove um webhook
 * POST   /webhooks/:id/test  — envia um evento de teste
 */
import { Router } from "express";
import { z }      from "zod";
import { authenticate, requireAdmin } from "../middlewares/authenticate.js";
import { prisma }          from "../lib/prisma.js";
import { emitirWebhook }   from "../lib/webhookEmitter.js";

const router = Router();
router.use(authenticate, requireAdmin);

const EVENTOS_VALIDOS = ["oa.concluido", "oa.atrasado"] as const;

const criarSchema = z.object({
  nome:     z.string().min(1).max(100),
  url:      z.string().url("URL inválida"),
  segredo:  z.string().min(8).max(256).optional().nullable(),
  eventos:  z.array(z.enum(EVENTOS_VALIDOS)).min(1, "Selecione ao menos um evento"),
  ativo:    z.boolean().optional().default(true),
  cursoId:  z.string().cuid().optional().nullable(),
});

const atualizarSchema = criarSchema.partial();

// ── Listar ────────────────────────────────────────────────────────────────────

router.get("/", async (_req, res, next) => {
  try {
    const webhooks = await prisma.webhook.findMany({
      orderBy: { criadoEm: "desc" },
      select: {
        id:          true,
        nome:        true,
        url:         true,
        eventos:     true,
        ativo:       true,
        cursoId:     true,
        criadoEm:    true,
        atualizadoEm: true,
        // Omite segredo por segurança — nunca retorna para o cliente
        curso:        { select: { id: true, nome: true, codigo: true } },
        criadoPor:    { select: { id: true, nome: true } },
      },
    });
    res.json(webhooks);
  } catch (err) { next(err); }
});

// ── Criar ─────────────────────────────────────────────────────────────────────

router.post("/", async (req, res, next) => {
  try {
    const data = criarSchema.parse(req.body);
    const webhook = await prisma.webhook.create({
      data: {
        nome:        data.nome,
        url:         data.url,
        segredo:     data.segredo ?? null,
        eventos:     data.eventos,
        ativo:       data.ativo ?? true,
        cursoId:     data.cursoId ?? null,
        criadoPorId: req.usuario!.sub,
      },
      select: {
        id:          true,
        nome:        true,
        url:         true,
        eventos:     true,
        ativo:       true,
        cursoId:     true,
        criadoEm:    true,
        atualizadoEm: true,
        curso:       { select: { id: true, nome: true, codigo: true } },
        criadoPor:   { select: { id: true, nome: true } },
      },
    });
    res.status(201).json(webhook);
  } catch (err) { next(err); }
});

// ── Atualizar ─────────────────────────────────────────────────────────────────

router.patch("/:id", async (req, res, next) => {
  try {
    const data = atualizarSchema.parse(req.body);
    const webhook = await prisma.webhook.update({
      where: { id: req.params["id"] as string },
      data: {
        ...(data.nome    !== undefined ? { nome:    data.nome }    : {}),
        ...(data.url     !== undefined ? { url:     data.url }     : {}),
        ...(data.eventos !== undefined ? { eventos: data.eventos } : {}),
        ...(data.ativo   !== undefined ? { ativo:   data.ativo }   : {}),
        ...(data.cursoId !== undefined ? { cursoId: data.cursoId ?? null } : {}),
        // Permite limpar o segredo (null) ou atualizá-lo
        ...(data.segredo !== undefined ? { segredo: data.segredo ?? null } : {}),
      },
      select: {
        id:          true,
        nome:        true,
        url:         true,
        eventos:     true,
        ativo:       true,
        cursoId:     true,
        criadoEm:    true,
        atualizadoEm: true,
        curso:       { select: { id: true, nome: true, codigo: true } },
        criadoPor:   { select: { id: true, nome: true } },
      },
    });
    res.json(webhook);
  } catch (err) { next(err); }
});

// ── Deletar ───────────────────────────────────────────────────────────────────

router.delete("/:id", async (req, res, next) => {
  try {
    await prisma.webhook.delete({ where: { id: req.params["id"] as string } });
    res.status(204).send();
  } catch (err) { next(err); }
});

// ── Testar ────────────────────────────────────────────────────────────────────
// Envia um evento de teste para a URL configurada (sem filtrar por cursoId).

router.post("/:id/test", async (req, res, next) => {
  try {
    const wh = await prisma.webhook.findUnique({
      where:  { id: req.params["id"] as string },
      select: { id: true, url: true, segredo: true, nome: true, eventos: true },
    });
    if (!wh) { res.status(404).json({ message: "Webhook não encontrado." }); return; }

    // Usa o primeiro evento configurado como exemplo
    const eventoTeste = wh.eventos[0] as "oa.concluido" | "oa.atrasado" ?? "oa.concluido";

    await emitirWebhook(eventoTeste, {
      _teste:  true,
      mensagem: "Este é um evento de teste enviado pelo RedeFLOW.",
      oaId:     "test-oa-id",
      oaCodigo: "U1C1OV1",
      oaTitulo: "Exemplo de OA",
      cursoNome: "Curso de Exemplo",
    });

    res.json({ ok: true, evento: eventoTeste, url: wh.url });
  } catch (err) { next(err); }
});

export default router;
