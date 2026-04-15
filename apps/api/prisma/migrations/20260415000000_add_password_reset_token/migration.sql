-- CreateTable: tokens de recuperação de senha
CREATE TABLE "password_reset_tokens" (
    "id"        TEXT        NOT NULL,
    "token"     TEXT        NOT NULL,
    "usuarioId" TEXT        NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "usado"     BOOLEAN     NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "password_reset_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "password_reset_tokens_token_key" ON "password_reset_tokens"("token");

-- AddForeignKey
ALTER TABLE "password_reset_tokens" ADD CONSTRAINT "password_reset_tokens_usuarioId_fkey"
    FOREIGN KEY ("usuarioId") REFERENCES "usuarios"("id") ON DELETE CASCADE ON UPDATE CASCADE;
