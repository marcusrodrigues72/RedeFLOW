import type { Request, Response, NextFunction } from "express";
import { CursoService } from "../services/cursoService.js";
import { parseBuffer, buildPreview, persistMC, parseMI, buildMIPreview, persistMI, extractNomesResponsaveis, matchesNome } from "../services/importService.js";
import type { MICapitulo } from "../services/importService.js";
import { prisma } from "../lib/prisma.js";
import { z } from "zod";
import bcrypt from "bcryptjs";
import { randomBytes } from "crypto";

/** Salva um snapshot da MI no histórico após importação bem-sucedida. */
async function salvarMIHistorico(
  caps: MICapitulo[],
  cursoId: string,
  usuarioId: string,
  result: { capitulosAtualizados: number; objetivosCriados: number; oasCriados: number },
): Promise<void> {
  const totalUnidades = new Set(caps.map((c) => c.unidade)).size;
  const totalOAs      = caps.reduce((s, c) => s + c.oaDefs.reduce((ss, d) => ss + d.quantidade, 0), 0);
  const resumo = `${totalUnidades} unidade(s) · ${result.capitulosAtualizados} capítulos · ${result.objetivosCriados} objetivos · ${totalOAs} OA(s)`;
  await prisma.mIHistorico.create({
    data: { cursoId, importadoPorId: usuarioId, snapshot: caps as never, resumo },
  });
}

const criarCursoSchema = z.object({
  codigo:           z.string().min(2).max(20),
  nome:             z.string().min(3).max(200),
  descricao:        z.string().optional(),
  chTotalPlanejada: z.number().int().min(0).optional(),
});

const atualizarCursoSchema = z.object({
  nome:      z.string().min(3).max(200).optional(),
  descricao: z.string().optional(),
  status:    z.enum(["RASCUNHO", "ATIVO", "ARQUIVADO"]).optional(),
});

export class CursoController {
  private service = new CursoService();

  listar = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const cursos = await this.service.listar(req.usuario!.sub, req.usuario!.papel);
      res.json(cursos);
    } catch (err) { next(err); }
  };

  buscar = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const curso = await this.service.buscarPorId(req.params["id"] as string, req.usuario!.sub);
      if (!curso) { res.status(404).json({ message: "Curso não encontrado." }); return; }
      res.json(curso);
    } catch (err) { next(err); }
  };

  criar = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const data  = criarCursoSchema.parse(req.body);
      const curso = await this.service.criar(data, req.usuario!.sub);
      res.status(201).json(curso);
    } catch (err) { next(err); }
  };

  atualizar = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const data  = atualizarCursoSchema.parse(req.body);
      const curso = await this.service.atualizar(req.params["id"] as string, data);
      res.json(curso);
    } catch (err) { next(err); }
  };

  arquivar = async (req: Request, res: Response, next: NextFunction) => {
    try {
      await this.service.arquivar(req.params["id"] as string);
      res.status(204).send();
    } catch (err) { next(err); }
  };

  excluir = async (req: Request, res: Response, next: NextFunction) => {
    try {
      await this.service.excluir(req.params["id"] as string);
      res.status(204).send();
    } catch (err) { next(err); }
  };

  // ── Importação ─────────────────────────────────────────────────────────────

  /** Faz o parse e retorna um preview SEM salvar no banco. Inclui responsáveis não encontrados no time. */
  importarPreview = async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!req.file) { res.status(400).json({ message: "Nenhum arquivo enviado." }); return; }

      const cursoId = req.params["id"] as string;
      const rows    = parseBuffer(req.file.buffer, req.file.originalname);
      const preview = buildPreview(rows);

      // Resolve responsáveis: primeiro membros do curso, depois usuários globais
      // Inclui e-mail para suportar planilhas com hyperlink "mailto:email"
      const membros = await prisma.cursoMembro.findMany({
        where:   { cursoId },
        include: { usuario: { select: { id: true, nome: true, email: true } } },
      });
      const todosUsuarios = await prisma.usuario.findMany({
        select: { id: true, nome: true, email: true },
      });

      /** Verifica se um valor (nome ou e-mail) resolve para algum usuário conhecido */
      const podeResolver = (valor: string): boolean => {
        const isEmail = valor.includes("@");
        if (isEmail) {
          const emailNorm = valor.toLowerCase();
          if (membros.some((m) => m.usuario.email.toLowerCase() === emailNorm)) return true;
          if (todosUsuarios.some((u) => u.email.toLowerCase() === emailNorm))   return true;
          return false;
        }
        return membros.some((m) => matchesNome(valor, m.usuario.nome)) ||
               todosUsuarios.some((u) => matchesNome(valor, u.nome));
      };

      const todosNomes = extractNomesResponsaveis(rows); // já retorna com mailto: removido
      preview.responsaveisNaoEncontrados = todosNomes.filter((nome) => !podeResolver(nome));

      res.json(preview);
    } catch (err) { next(err); }
  };

  // ── Importação MI ──────────────────────────────────────────────────────────

  importarMIPreview = async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!req.file) { res.status(400).json({ message: "Nenhum arquivo enviado." }); return; }
      const caps    = parseMI(req.file.buffer, req.file.originalname);
      const preview = buildMIPreview(caps);
      res.json(preview);
    } catch (err) { next(err); }
  };

  importarMIConfirmar = async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!req.file) { res.status(400).json({ message: "Nenhum arquivo enviado." }); return; }
      const cursoId = req.params["id"] as string;
      const curso   = await this.service.buscarPorId(cursoId, req.usuario!.sub);
      if (!curso) { res.status(404).json({ message: "Curso não encontrado." }); return; }
      const caps   = parseMI(req.file.buffer, req.file.originalname);
      const avisos = buildMIPreview(caps).avisos;
      const result = await persistMI(caps, cursoId);
      await salvarMIHistorico(caps, cursoId, req.usuario!.sub, result);
      res.json({
        message:              `MI importada: ${result.capitulosAtualizados} capítulos, ${result.objetivosCriados} objetivos, ${result.oasCriados} OAs gerados.`,
        cursoId,
        capitulosAtualizados: result.capitulosAtualizados,
        objetivosCriados:     result.objetivosCriados,
        oasCriados:           result.oasCriados,
        oasIgnorados:         result.oasIgnorados,
        avisos,
      });
    } catch (err) { next(err); }
  };

  // ── Criar curso + importar MI em uma única operação ────────────────────────

  importarMINovoCurso = async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!req.file) { res.status(400).json({ message: "Nenhum arquivo enviado." }); return; }

      const novoCursoSchema = z.object({
        codigo:     z.string().min(2).max(20),
        nome:       z.string().min(3).max(200),
        descricao:  z.string().optional(),
        dataInicio: z.string().optional(),  // ISO date string (YYYY-MM-DD)
      });

      const parsed = novoCursoSchema.safeParse(req.body);
      if (!parsed.success) {
        res.status(400).json({ message: "Campos obrigatórios: codigo e nome.", errors: parsed.error.flatten() });
        return;
      }

      const { codigo, nome, descricao, dataInicio } = parsed.data;
      const dataInicioDate = dataInicio ? new Date(dataInicio) : undefined;

      // Cria o curso e já adiciona o criador como ADMIN
      const curso = await prisma.curso.create({
        data: {
          codigo, nome, descricao: descricao ?? null,
          dataInicio: dataInicioDate ?? null,
          membros: { create: { usuarioId: req.usuario!.sub, papel: "ADMIN" } },
        },
      });

      const caps   = parseMI(req.file.buffer, req.file.originalname);
      const avisos = buildMIPreview(caps).avisos;
      const result = await persistMI(caps, curso.id, dataInicioDate ? { dataInicio: dataInicioDate } : {});
      await salvarMIHistorico(caps, curso.id, req.usuario!.sub, result);

      res.status(201).json({
        message:              `Curso criado e MI importada: ${result.capitulosAtualizados} capítulos, ${result.oasCriados} OAs gerados.`,
        cursoId:              curso.id,
        capitulosAtualizados: result.capitulosAtualizados,
        objetivosCriados:     result.objetivosCriados,
        oasCriados:           result.oasCriados,
        oasIgnorados:         result.oasIgnorados,
        avisos,
      });
    } catch (err) { next(err); }
  };

  /** Recebe o arquivo + novos usuários opcionais, cria-os e persiste a MC no banco. */
  importarConfirmar = async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!req.file) { res.status(400).json({ message: "Nenhum arquivo enviado." }); return; }

      const cursoId = req.params["id"] as string;

      // Verifica acesso
      const curso = await this.service.buscarPorId(cursoId, req.usuario!.sub);
      if (!curso) { res.status(404).json({ message: "Curso não encontrado." }); return; }

      // ── Cria novos usuários e adiciona ao time, se solicitado ──────────────
      type NovoUsuarioInput = { nomeNaPlanilha: string; email: string };
      type NovoUsuarioCriado = { nomeNaPlanilha: string; nome: string; email: string; senhaTemporaria: string };

      const novosUsuariosCriados: NovoUsuarioCriado[] = [];
      const novosUsuariosRaw = req.body?.novosUsuarios;

      if (novosUsuariosRaw) {
        const lista: NovoUsuarioInput[] = typeof novosUsuariosRaw === "string"
          ? JSON.parse(novosUsuariosRaw)
          : novosUsuariosRaw;

        for (const nu of lista) {
          if (!nu.email?.trim() || !nu.nomeNaPlanilha?.trim()) continue;

          const emailNorm = nu.email.trim().toLowerCase();
          const nome      = nu.nomeNaPlanilha.trim();

          // Cria usuário se ainda não existir
          let usuario = await prisma.usuario.findUnique({ where: { email: emailNorm }, select: { id: true, nome: true } });
          let senhaTemporaria = "(usuário já existia no sistema)";

          if (!usuario) {
            const pwd   = randomBytes(5).toString("hex"); // ex: "a1b2c3d4e5"
            const hash  = await bcrypt.hash(pwd, 12);
            usuario = await prisma.usuario.create({
              data:   { nome, email: emailNorm, senhaHash: hash, papelGlobal: "COLABORADOR" },
              select: { id: true, nome: true },
            });
            senhaTemporaria = pwd;
          }

          // Adiciona ao time do curso se ainda não for membro
          const jaMembro = await prisma.cursoMembro.findUnique({
            where: { cursoId_usuarioId: { cursoId, usuarioId: usuario.id } },
          });
          if (!jaMembro) {
            await prisma.cursoMembro.create({
              data: { cursoId, usuarioId: usuario.id, papel: "COLABORADOR" },
            });
          }

          novosUsuariosCriados.push({ nomeNaPlanilha: nu.nomeNaPlanilha, nome: usuario.nome, email: emailNorm, senhaTemporaria });
        }
      }

      // ── Executa importação (membros já incluem os recém-criados) ───────────
      const rows   = parseBuffer(req.file.buffer, req.file.originalname);
      const result = await persistMC(rows, cursoId);

      res.json({
        message:             `Importação concluída: ${result.criados} OAs criados, ${result.atualizados} atualizados, ${result.ignorados} ignorados.`,
        criados:             result.criados,
        atualizados:         result.atualizados,
        ignorados:           result.ignorados,
        avisos:              result.avisos,
        novosUsuariosCriados,
      });
    } catch (err) { next(err); }
  };
}
