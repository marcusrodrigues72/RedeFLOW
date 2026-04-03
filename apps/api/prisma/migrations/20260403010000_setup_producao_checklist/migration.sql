-- Campos de validação da matriz e coordenador de produção no Curso
ALTER TABLE "cursos" ADD COLUMN "matrizValidadaEm"      TIMESTAMP(3);
ALTER TABLE "cursos" ADD COLUMN "matrizValidadaPorId"   TEXT;
ALTER TABLE "cursos" ADD COLUMN "coordenadorProducaoId" TEXT;

ALTER TABLE "cursos" ADD CONSTRAINT "cursos_matrizValidadaPorId_fkey"
  FOREIGN KEY ("matrizValidadaPorId")   REFERENCES "usuarios"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "cursos" ADD CONSTRAINT "cursos_coordenadorProducaoId_fkey"
  FOREIGN KEY ("coordenadorProducaoId") REFERENCES "usuarios"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Campos de checklist do Setup de Produção na EtapaOA
ALTER TABLE "etapas_oa" ADD COLUMN "templateGerado"     BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "etapas_oa" ADD COLUMN "templateOrganizado" BOOLEAN NOT NULL DEFAULT false;
