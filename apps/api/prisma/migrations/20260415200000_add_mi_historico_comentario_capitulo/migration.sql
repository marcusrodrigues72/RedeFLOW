-- RF-M2-05: Histórico de versões da Matriz Instrucional
CREATE TABLE "mi_historico" (
    "id"             TEXT         NOT NULL,
    "cursoId"        TEXT         NOT NULL,
    "importadoPorId" TEXT         NOT NULL,
    "snapshot"       JSONB        NOT NULL,
    "resumo"         TEXT,
    "createdAt"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "mi_historico_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "mi_historico"
    ADD CONSTRAINT "mi_historico_cursoId_fkey"
    FOREIGN KEY ("cursoId") REFERENCES "cursos"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "mi_historico"
    ADD CONSTRAINT "mi_historico_importadoPorId_fkey"
    FOREIGN KEY ("importadoPorId") REFERENCES "usuarios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE INDEX "mi_historico_cursoId_createdAt_idx"
    ON "mi_historico"("cursoId", "createdAt" DESC);

-- RF-M2-06: Comentários por linha de capítulo na MI
ALTER TABLE "comentarios" ADD COLUMN "capituloId" TEXT;

ALTER TABLE "comentarios"
    ADD CONSTRAINT "comentarios_capituloId_fkey"
    FOREIGN KEY ("capituloId") REFERENCES "capitulos"("id") ON DELETE CASCADE ON UPDATE CASCADE;
