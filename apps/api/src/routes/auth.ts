import { Router } from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { z } from "zod";
import { prisma } from "../lib/prisma.js";
import {
  signAccessToken,
  signRefreshToken,
  verifyRefreshToken,
} from "../lib/jwt.js";
import { authenticate } from "../middlewares/authenticate.js";
import { validate } from "../middlewares/validate.js";
import { loginSchema, refreshSchema } from "shared";

// ─── Configuração Microsoft OAuth ─────────────────────────────────────────────
const MS_TENANT_ID      = process.env["MICROSOFT_TENANT_ID"]     ?? "";
const MS_CLIENT_ID      = process.env["MICROSOFT_CLIENT_ID"]     ?? "";
const MS_CLIENT_SECRET  = process.env["MICROSOFT_CLIENT_SECRET"] ?? "";
const MS_REDIRECT_URI   = process.env["MICROSOFT_REDIRECT_URI"]  ?? "";
const FRONTEND_URL      = process.env["FRONTEND_URL"]            ?? "http://localhost:5173";
const STATE_SECRET      = process.env["JWT_ACCESS_SECRET"]       ?? "dev-access-secret-inseguro";

const router = Router();

// POST /api/auth/login
router.post("/login", validate(loginSchema), async (req, res, next) => {
  try {
    const { email, senha } = req.body as { email: string; senha: string };

    const usuario = await prisma.usuario.findUnique({ where: { email } });

    if (!usuario || !usuario.ativo) {
      res.status(401).json({ message: "Credenciais inválidas." });
      return;
    }

    if (!usuario.senhaHash) {
      res.status(401).json({ message: "Esta conta usa login institucional (SSO). Use o botão 'Entrar com Microsoft'." });
      return;
    }

    const senhaCorreta = await bcrypt.compare(senha, usuario.senhaHash);
    if (!senhaCorreta) {
      res.status(401).json({ message: "Credenciais inválidas." });
      return;
    }

    const accessToken = signAccessToken({
      sub: usuario.id,
      email: usuario.email,
      papel: usuario.papelGlobal,
    });

    const refreshToken = signRefreshToken(usuario.id);

    // Persiste refresh token (expira em 7 dias)
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7);

    await prisma.refreshToken.create({
      data: { token: refreshToken, usuarioId: usuario.id, expiresAt },
    });

    res.json({
      accessToken,
      refreshToken,
      user: {
        id: usuario.id,
        nome: usuario.nome,
        email: usuario.email,
        papelGlobal: usuario.papelGlobal,
        fotoUrl: usuario.fotoUrl,
      },
    });
  } catch (err) {
    next(err);
  }
});

// POST /api/auth/refresh
router.post("/refresh", validate(refreshSchema), async (req, res, next) => {
  try {
    const { refreshToken } = req.body as { refreshToken: string };

    // Verifica assinatura
    const payload = verifyRefreshToken(refreshToken);

    // Verifica se está no banco e não expirou
    const stored = await prisma.refreshToken.findUnique({
      where: { token: refreshToken },
      include: { usuario: true },
    });

    if (!stored || stored.expiresAt < new Date() || !stored.usuario.ativo) {
      res.status(401).json({ message: "Token de atualização inválido ou expirado." });
      return;
    }

    if (stored.usuarioId !== payload.sub) {
      res.status(401).json({ message: "Token de atualização inválido." });
      return;
    }

    // Rotação de token: invalida o anterior, emite um novo
    await prisma.refreshToken.delete({ where: { id: stored.id } });

    const newAccessToken = signAccessToken({
      sub: stored.usuario.id,
      email: stored.usuario.email,
      papel: stored.usuario.papelGlobal,
    });

    const newRefreshToken = signRefreshToken(stored.usuario.id);
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7);

    await prisma.refreshToken.create({
      data: { token: newRefreshToken, usuarioId: stored.usuario.id, expiresAt },
    });

    res.json({ accessToken: newAccessToken, refreshToken: newRefreshToken });
  } catch {
    res.status(401).json({ message: "Token de atualização inválido ou expirado." });
  }
});

// POST /api/auth/logout
router.post("/logout", authenticate, async (req, res, next) => {
  try {
    const { refreshToken } = req.body as { refreshToken?: string };

    if (refreshToken) {
      await prisma.refreshToken
        .delete({ where: { token: refreshToken } })
        .catch(() => {}); // ignora se não encontrar
    }

    res.status(204).send();
  } catch (err) {
    next(err);
  }
});

// GET /api/auth/me
router.get("/me", authenticate, async (req, res, next) => {
  try {
    const usuario = await prisma.usuario.findUnique({
      where: { id: req.usuario!.sub },
      select: {
        id: true, nome: true, email: true,
        papelGlobal: true, fotoUrl: true, ativo: true,
        notifEmailAtivo: true,
      },
    });

    if (!usuario || !usuario.ativo) {
      res.status(401).json({ message: "Usuário não encontrado." });
      return;
    }

    res.json(usuario);
  } catch (err) {
    next(err);
  }
});

// PATCH /api/auth/me — auto-edição de perfil (qualquer usuário autenticado)
const perfilSchema = z.object({
  nome:                   z.string().min(2).max(100).optional(),
  email:                  z.string().email().optional(),
  senhaAtual:             z.string().min(1).optional(),
  novaSenha:              z.string().min(6).optional(),
  notifEmailAtivo:        z.boolean().optional(),
  capacidadeHorasSemanais: z.number().int().min(1).max(168).optional(),
}).refine(
  (d) => !d.novaSenha || d.senhaAtual,
  { message: "Informe a senha atual para definir uma nova senha.", path: ["senhaAtual"] }
);

router.patch("/me", authenticate, async (req, res, next) => {
  try {
    const { nome, email, senhaAtual, novaSenha, notifEmailAtivo, capacidadeHorasSemanais } = perfilSchema.parse(req.body);
    const id = req.usuario!.sub;

    // Se e-mail mudou, verifica conflito
    if (email) {
      const conflito = await prisma.usuario.findFirst({ where: { email, NOT: { id } } });
      if (conflito) {
        res.status(409).json({ message: "Este e-mail já está em uso." });
        return;
      }
    }

    // Se troca de senha, valida senha atual
    if (novaSenha) {
      const atual = await prisma.usuario.findUnique({ where: { id }, select: { senhaHash: true } });
      const correta = atual?.senhaHash && await bcrypt.compare(senhaAtual!, atual.senhaHash);
      if (!correta) {
        res.status(400).json({ message: "Senha atual incorreta." });
        return;
      }
    }

    const updateData: Record<string, unknown> = {};
    if (nome  !== undefined) updateData["nome"]  = nome;
    if (email !== undefined) updateData["email"] = email;
    if (notifEmailAtivo !== undefined) {
      updateData["notifEmailAtivo"] = notifEmailAtivo;
    }
    if (capacidadeHorasSemanais !== undefined) {
      updateData["capacidadeHorasSemanais"] = capacidadeHorasSemanais;
    }
    if (novaSenha) updateData["senhaHash"] = await bcrypt.hash(novaSenha, 12);

    const usuario = await prisma.usuario.update({
      where: { id },
      data:  updateData as Parameters<typeof prisma.usuario.update>[0]["data"],
      select: { id: true, nome: true, email: true, papelGlobal: true, fotoUrl: true, notifEmailAtivo: true },
    });

    res.json(usuario);
  } catch (err) { next(err); }
});

// ─── SSO Microsoft ────────────────────────────────────────────────────────────

// GET /api/auth/microsoft — inicia o fluxo OAuth redirect
router.get("/microsoft", (req, res) => {
  if (!MS_CLIENT_ID || !MS_TENANT_ID) {
    res.status(503).json({ message: "SSO Microsoft não configurado neste ambiente." });
    return;
  }

  // State assinado com validade de 5 min — proteção CSRF sem armazenamento server-side
  const state = jwt.sign({ ts: Date.now() }, STATE_SECRET, { expiresIn: "5m" });

  const params = new URLSearchParams({
    client_id:     MS_CLIENT_ID,
    response_type: "code",
    redirect_uri:  MS_REDIRECT_URI,
    response_mode: "query",
    scope:         "openid email profile User.Read",
    state,
  });

  res.redirect(`https://login.microsoftonline.com/${MS_TENANT_ID}/oauth2/v2.0/authorize?${params}`);
});

// GET /api/auth/microsoft/callback — recebe o code, cria/encontra usuário, emite JWT
router.get("/microsoft/callback", async (req, res) => {
  const { code, state, error } = req.query as Record<string, string>;

  // Redireciona para o frontend com erro em caso de falha no lado Microsoft
  const failRedirect = (msg: string) =>
    res.redirect(`${FRONTEND_URL}/sso-callback?error=${encodeURIComponent(msg)}`);

  if (error) { failRedirect(`Microsoft recusou o login: ${error}`); return; }
  if (!code)  { failRedirect("Código de autorização ausente."); return; }

  // Verifica CSRF state
  try { jwt.verify(state ?? "", STATE_SECRET); }
  catch { failRedirect("State inválido ou expirado. Tente novamente."); return; }

  try {
    // 1. Troca o code por tokens da Microsoft
    const tokenBody = new URLSearchParams({
      client_id:     MS_CLIENT_ID,
      client_secret: MS_CLIENT_SECRET,
      code,
      redirect_uri:  MS_REDIRECT_URI,
      grant_type:    "authorization_code",
    });

    const tokenRes  = await fetch(
      `https://login.microsoftonline.com/${MS_TENANT_ID}/oauth2/v2.0/token`,
      { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body: tokenBody }
    );
    const tokenData = await tokenRes.json() as Record<string, string>;

    if (!tokenRes.ok || !tokenData["access_token"]) {
      console.error("[SSO] token exchange failed:", JSON.stringify(tokenData));
      failRedirect("Falha ao obter tokens da Microsoft.");
      return;
    }

    // 2. Busca dados do usuário no Microsoft Graph
    const msAccessToken = tokenData["access_token"]!;
    const graphRes  = await fetch("https://graph.microsoft.com/v1.0/me", {
      headers: { Authorization: `Bearer ${msAccessToken}` },
    });
    const graphData = await graphRes.json() as Record<string, string>;

    const msId  = graphData["id"];
    const nome  = graphData["displayName"] ?? graphData["givenName"] ?? "Usuário";
    const email = (graphData["mail"] ?? graphData["userPrincipalName"] ?? "").toLowerCase();

    if (!msId || !email) { failRedirect("Não foi possível obter dados do perfil Microsoft."); return; }

    // 2b. Tenta buscar a foto de perfil do Microsoft (96x96)
    let fotoUrl: string | null = null;
    try {
      const fotoRes = await fetch("https://graph.microsoft.com/v1.0/me/photos/96x96/$value", {
        headers: { Authorization: `Bearer ${msAccessToken}` },
      });
      if (fotoRes.ok) {
        const contentType = fotoRes.headers.get("content-type") ?? "image/jpeg";
        const buffer      = Buffer.from(await fotoRes.arrayBuffer());
        fotoUrl = `data:${contentType};base64,${buffer.toString("base64")}`;
      }
    } catch {
      // Foto indisponível — continua sem ela
    }

    // 3. Encontra ou cria o usuário no sistema
    let usuario = await prisma.usuario.findFirst({
      where: { OR: [{ microsoftId: msId }, { email }] },
    });

    let isNovo = false;

    if (usuario) {
      // Vincula o microsoftId e atualiza foto se necessário
      const updateData: Record<string, unknown> = {};
      if (!usuario.microsoftId) { updateData["microsoftId"] = msId; updateData["authProvider"] = "MICROSOFT"; }
      if (fotoUrl)              { updateData["fotoUrl"] = fotoUrl; }
      if (Object.keys(updateData).length > 0) {
        usuario = await prisma.usuario.update({ where: { id: usuario.id }, data: updateData });
      }
      if (!usuario.ativo) { failRedirect("Sua conta está inativa. Entre em contato com o administrador."); return; }
    } else {
      // Cria novo usuário como LEITOR
      usuario = await prisma.usuario.create({
        data: {
          nome,
          email,
          senhaHash:   null,
          papelGlobal: "LEITOR",
          microsoftId: msId,
          authProvider:"MICROSOFT",
          ...(fotoUrl ? { fotoUrl } : {}),
        },
      });
      isNovo = true;
    }

    // 4. Se novo, notifica todos os ADMINs
    if (isNovo) {
      const admins = await prisma.usuario.findMany({
        where: { papelGlobal: "ADMIN", ativo: true },
        select: { id: true },
      });
      if (admins.length > 0) {
        await prisma.notificacao.createMany({
          data: admins.map((admin) => ({
            usuarioId:    admin.id,
            tipo:         "NOVO_USUARIO_SSO",
            titulo:       `Novo acesso via SSO: ${nome}`,
            corpo:        `${nome} (${email}) entrou pelo login institucional e foi cadastrado como Leitor. Acesse a gestão de usuários para configurar as permissões.`,
            entidadeTipo: "USUARIO",
            entidadeId:   usuario.id,
          })),
        });
      }
    }

    // 5. Emite tokens do Redeflow
    const accessToken  = signAccessToken({ sub: usuario.id, email: usuario.email, papel: usuario.papelGlobal });
    const refreshToken = signRefreshToken(usuario.id);
    const expiresAt    = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7);
    await prisma.refreshToken.create({ data: { token: refreshToken, usuarioId: usuario.id, expiresAt } });

    // 6. Redireciona para o frontend com os tokens na query string
    //    (os tokens chegam apenas ao navegador do usuário — não são enviados a nenhum servidor)
    // fotoUrl excluído intencionalmente: seria base64 enorme na URL, causando "too big header" no nginx.
    // O cliente já atualiza o perfil via GET /auth/me após o login.
    const user = { id: usuario.id, nome: usuario.nome, email: usuario.email, papelGlobal: usuario.papelGlobal, fotoUrl: null };
    const params = new URLSearchParams({
      access_token:  accessToken,
      refresh_token: refreshToken,
      user:          Buffer.from(JSON.stringify(user)).toString("base64"),
    });
    res.redirect(`${FRONTEND_URL}/sso-callback?${params}`);
  } catch (err) {
    console.error("[SSO] callback error:", err);
    failRedirect("Erro interno durante autenticação SSO.");
  }
});

export default router;
