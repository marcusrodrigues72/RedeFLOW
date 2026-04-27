-- RF-M7-07: Webhook / integração
-- Cria tabela de webhooks para integrações externas (ex: Slack)

CREATE TABLE "webhooks" (
    "id"           TEXT         NOT NULL,
    "nome"         TEXT         NOT NULL,
    "url"          TEXT         NOT NULL,
    "segredo"      TEXT,
    "eventos"      TEXT[]       NOT NULL DEFAULT ARRAY[]::TEXT[],
    "ativo"        BOOLEAN      NOT NULL DEFAULT true,
    "cursoId"      TEXT,
    "criadoPorId"  TEXT         NOT NULL,
    "criadoEm"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "webhooks_pkey" PRIMARY KEY ("id")
);

-- Índices
CREATE INDEX "webhooks_cursoId_idx"     ON "webhooks"("cursoId");
CREATE INDEX "webhooks_criadoPorId_idx" ON "webhooks"("criadoPorId");

-- Foreign keys
ALTER TABLE "webhooks"
    ADD CONSTRAINT "webhooks_cursoId_fkey"
    FOREIGN KEY ("cursoId")
    REFERENCES "cursos"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "webhooks"
    ADD CONSTRAINT "webhooks_criadoPorId_fkey"
    FOREIGN KEY ("criadoPorId")
    REFERENCES "usuarios"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;
