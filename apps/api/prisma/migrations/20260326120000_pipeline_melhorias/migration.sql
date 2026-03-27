-- Pipeline melhorias: novos tipos de OA, novos papéis de etapa, campos linkArtefato e temArtefato

-- Novos valores no enum TipoOA
ALTER TYPE "TipoOA" ADD VALUE IF NOT EXISTS 'INFOGRAFICO';
ALTER TYPE "TipoOA" ADD VALUE IF NOT EXISTS 'TIMELINE';

-- Novos valores no enum PapelEtapa
ALTER TYPE "PapelEtapa" ADD VALUE IF NOT EXISTS 'EDITOR_VIDEO';
ALTER TYPE "PapelEtapa" ADD VALUE IF NOT EXISTS 'DESIGNER_GRAFICO';

-- Campo de artefato na instância de etapa
ALTER TABLE "etapas_oa" ADD COLUMN IF NOT EXISTS "linkArtefato" TEXT;

-- Flag de artefato na definição de etapa
ALTER TABLE "etapas_definicao" ADD COLUMN IF NOT EXISTS "temArtefato" BOOLEAN NOT NULL DEFAULT false;
