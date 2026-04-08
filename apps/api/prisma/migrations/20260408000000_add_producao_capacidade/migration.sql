-- AlterTable: capacidade de produção semanal global do usuário
ALTER TABLE "usuarios" ADD COLUMN IF NOT EXISTS "capacidadeHorasSemanais" INTEGER NOT NULL DEFAULT 40;

-- AlterTable: papéis de produção por membro no curso
ALTER TABLE "curso_membros" ADD COLUMN IF NOT EXISTS "papeisProducao" TEXT[] NOT NULL DEFAULT '{}';

-- AlterTable: esforço estimado por etapa (em horas por OA)
ALTER TABLE "etapas_definicao" ADD COLUMN IF NOT EXISTS "esforcoHoras" DOUBLE PRECISION NOT NULL DEFAULT 2.0;
