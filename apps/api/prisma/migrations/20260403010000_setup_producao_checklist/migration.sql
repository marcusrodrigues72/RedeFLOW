-- Campos de validação da matriz e coordenador de produção no Curso
ALTER TABLE "cursos" ADD COLUMN IF NOT EXISTS "matrizValidadaEm"      TIMESTAMP(3);
ALTER TABLE "cursos" ADD COLUMN IF NOT EXISTS "matrizValidadaPorId"   TEXT;
ALTER TABLE "cursos" ADD COLUMN IF NOT EXISTS "coordenadorProducaoId" TEXT;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'cursos_matrizValidadaPorId_fkey'
  ) THEN
    ALTER TABLE "cursos" ADD CONSTRAINT "cursos_matrizValidadaPorId_fkey"
      FOREIGN KEY ("matrizValidadaPorId") REFERENCES "usuarios"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'cursos_coordenadorProducaoId_fkey'
  ) THEN
    ALTER TABLE "cursos" ADD CONSTRAINT "cursos_coordenadorProducaoId_fkey"
      FOREIGN KEY ("coordenadorProducaoId") REFERENCES "usuarios"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

-- Campos de checklist do Setup de Produção na EtapaOA
ALTER TABLE "etapas_oa" ADD COLUMN IF NOT EXISTS "templateGerado"     BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "etapas_oa" ADD COLUMN IF NOT EXISTS "templateOrganizado" BOOLEAN NOT NULL DEFAULT false;
