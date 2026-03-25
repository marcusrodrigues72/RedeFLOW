-- AlterTable: adiciona responsavelSecundarioId à tabela etapas_oa
ALTER TABLE "etapas_oa" ADD COLUMN "responsavelSecundarioId" TEXT;

-- AddForeignKey
ALTER TABLE "etapas_oa" ADD CONSTRAINT "etapas_oa_responsavelSecundarioId_fkey"
  FOREIGN KEY ("responsavelSecundarioId") REFERENCES "usuarios"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
