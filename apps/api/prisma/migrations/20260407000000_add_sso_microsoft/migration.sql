-- AlterTable: senhaHash agora opcional (usuários SSO não têm senha local)
ALTER TABLE "usuarios" ALTER COLUMN "senhaHash" DROP NOT NULL;

-- AlterTable: campos para autenticação SSO Microsoft
ALTER TABLE "usuarios" ADD COLUMN "microsoftId" TEXT;
ALTER TABLE "usuarios" ADD COLUMN "authProvider" TEXT NOT NULL DEFAULT 'LOCAL';

-- CreateIndex: microsoftId deve ser único
CREATE UNIQUE INDEX "usuarios_microsoftId_key" ON "usuarios"("microsoftId");
