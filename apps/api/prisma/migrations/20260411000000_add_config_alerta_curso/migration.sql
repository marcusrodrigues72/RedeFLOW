-- AlterTable: adiciona preferências de notificação por curso ao membro
ALTER TABLE "curso_membros" ADD COLUMN "notifEmailAtivo" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "curso_membros" ADD COLUMN "notifInAppAtivo" BOOLEAN NOT NULL DEFAULT true;

-- CreateTable: configuração de alertas por curso
CREATE TABLE "config_alerta_curso" (
    "id" TEXT NOT NULL,
    "cursoId" TEXT NOT NULL,
    "diasAntecedencia" INTEGER NOT NULL DEFAULT 3,
    "alertDeadlineVencido" BOOLEAN NOT NULL DEFAULT true,
    "alertPrazoProximo" BOOLEAN NOT NULL DEFAULT true,
    "alertEtapaLiberada" BOOLEAN NOT NULL DEFAULT true,
    "alertMencao" BOOLEAN NOT NULL DEFAULT true,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "config_alerta_curso_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "config_alerta_curso_cursoId_key" ON "config_alerta_curso"("cursoId");

-- AddForeignKey
ALTER TABLE "config_alerta_curso" ADD CONSTRAINT "config_alerta_curso_cursoId_fkey"
    FOREIGN KEY ("cursoId") REFERENCES "cursos"("id") ON DELETE CASCADE ON UPDATE CASCADE;
