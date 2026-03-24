import type { Request, Response, NextFunction } from "express";
import { CursoService } from "../services/cursoService.js";
import { parseBuffer, buildPreview, persistMC, parseMI, buildMIPreview, persistMI } from "../services/importService.js";
import { prisma } from "../lib/prisma.js";
import { z } from "zod";

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
      const cursos = await this.service.listar(req.usuario!.sub);
      res.json(cursos);
    } catch (err) { next(err); }
  };

  buscar = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const curso = await this.service.buscarPorId(req.params["id"]!, req.usuario!.sub);
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
      const curso = await this.service.atualizar(req.params["id"]!, data);
      res.json(curso);
    } catch (err) { next(err); }
  };

  arquivar = async (req: Request, res: Response, next: NextFunction) => {
    try {
      await this.service.arquivar(req.params["id"]!);
      res.status(204).send();
    } catch (err) { next(err); }
  };

  excluir = async (req: Request, res: Response, next: NextFunction) => {
    try {
      await this.service.excluir(req.params["id"]!);
      res.status(204).send();
    } catch (err) { next(err); }
  };

  // ── Importação ─────────────────────────────────────────────────────────────

  /** Faz o parse e retorna um preview SEM salvar no banco. */
  importarPreview = async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!req.file) { res.status(400).json({ message: "Nenhum arquivo enviado." }); return; }

      const rows    = parseBuffer(req.file.buffer, req.file.originalname);
      const preview = buildPreview(rows);

      // Guarda as rows na sessão temporária via header (para simplicidade, usa o próprio body no confirmar)
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
      const cursoId = req.params["id"]!;
      const curso   = await this.service.buscarPorId(cursoId, req.usuario!.sub);
      if (!curso) { res.status(404).json({ message: "Curso não encontrado." }); return; }
      const caps   = parseMI(req.file.buffer, req.file.originalname);
      const result = await persistMI(caps, cursoId);
      res.json({
        message:              `MI importada: ${result.capitulosAtualizados} capítulos, ${result.objetivosCriados} objetivos, ${result.oasCriados} OAs gerados.`,
        cursoId,
        capitulosAtualizados: result.capitulosAtualizados,
        objetivosCriados:     result.objetivosCriados,
        oasCriados:           result.oasCriados,
        oasIgnorados:         result.oasIgnorados,
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
      const result = await persistMI(caps, curso.id, dataInicioDate ? { dataInicio: dataInicioDate } : {});

      res.status(201).json({
        message:              `Curso criado e MI importada: ${result.capitulosAtualizados} capítulos, ${result.oasCriados} OAs gerados.`,
        cursoId:              curso.id,
        capitulosAtualizados: result.capitulosAtualizados,
        objetivosCriados:     result.objetivosCriados,
        oasCriados:           result.oasCriados,
        oasIgnorados:         result.oasIgnorados,
      });
    } catch (err) { next(err); }
  };

  /** Recebe o arquivo novamente e persiste no banco. */
  importarConfirmar = async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!req.file) { res.status(400).json({ message: "Nenhum arquivo enviado." }); return; }

      const cursoId = req.params["id"]!;

      // Verifica acesso
      const curso = await this.service.buscarPorId(cursoId, req.usuario!.sub);
      if (!curso) { res.status(404).json({ message: "Curso não encontrado." }); return; }

      const rows   = parseBuffer(req.file.buffer, req.file.originalname);
      const result = await persistMC(rows, cursoId);

      res.json({
        message:  `Importação concluída: ${result.criados} OAs criados, ${result.ignorados} ignorados.`,
        criados:  result.criados,
        ignorados: result.ignorados,
      });
    } catch (err) { next(err); }
  };
}
