-- AlterTable: senhaHash agora opcional (usuários SSO não têm senha local)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'usuarios' AND column_name = 'senhaHash' AND is_nullable = 'NO'
  ) THEN
    ALTER TABLE "usuarios" ALTER COLUMN "senhaHash" DROP NOT NULL;
  END IF;
END $$;

-- AlterTable: campos para autenticação SSO Microsoft
ALTER TABLE "usuarios" ADD COLUMN IF NOT EXISTS "microsoftId" TEXT;
ALTER TABLE "usuarios" ADD COLUMN IF NOT EXISTS "authProvider" TEXT NOT NULL DEFAULT 'LOCAL';

-- CreateIndex: microsoftId deve ser único
CREATE UNIQUE INDEX IF NOT EXISTS "usuarios_microsoftId_key" ON "usuarios"("microsoftId");
