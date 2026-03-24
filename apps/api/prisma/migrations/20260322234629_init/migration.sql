-- CreateEnum
CREATE TYPE "PapelGlobal" AS ENUM ('ADMIN', 'COLABORADOR', 'LEITOR');

-- CreateEnum
CREATE TYPE "StatusCurso" AS ENUM ('RASCUNHO', 'ATIVO', 'ARQUIVADO');

-- CreateEnum
CREATE TYPE "TipoOA" AS ENUM ('VIDEO', 'SLIDE', 'QUIZ', 'EBOOK', 'PLANO_AULA', 'TAREFA');

-- CreateEnum
CREATE TYPE "StatusOA" AS ENUM ('PENDENTE', 'EM_ANDAMENTO', 'BLOQUEADO', 'CONCLUIDO');

-- CreateEnum
CREATE TYPE "StatusEtapa" AS ENUM ('PENDENTE', 'EM_ANDAMENTO', 'CONCLUIDA', 'BLOQUEADA');

-- CreateEnum
CREATE TYPE "NivelBloom" AS ENUM ('LEMBRAR', 'COMPREENDER', 'APLICAR', 'ANALISAR', 'AVALIAR', 'CRIAR');

-- CreateEnum
CREATE TYPE "PapelEtapa" AS ENUM ('CONTEUDISTA', 'DESIGNER_INSTRUCIONAL', 'PROFESSOR_ATOR', 'PROFESSOR_TECNICO', 'ACESSIBILIDADE', 'PRODUTOR_FINAL', 'VALIDADOR_FINAL');

-- CreateTable
CREATE TABLE "usuarios" (
    "id" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "senhaHash" TEXT NOT NULL,
    "papelGlobal" "PapelGlobal" NOT NULL DEFAULT 'COLABORADOR',
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "fotoUrl" TEXT,
    "mfaSecret" TEXT,
    "mfaAtivo" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "usuarios_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "refresh_tokens" (
    "id" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "usuarioId" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "refresh_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cursos" (
    "id" TEXT NOT NULL,
    "codigo" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "descricao" TEXT,
    "chTotalPlanejada" INTEGER NOT NULL DEFAULT 0,
    "dataInicio" TIMESTAMP(3),
    "dataFim" TIMESTAMP(3),
    "status" "StatusCurso" NOT NULL DEFAULT 'RASCUNHO',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "cursos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "curso_membros" (
    "id" TEXT NOT NULL,
    "cursoId" TEXT NOT NULL,
    "usuarioId" TEXT NOT NULL,
    "papel" "PapelGlobal" NOT NULL DEFAULT 'COLABORADOR',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "curso_membros_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "unidades" (
    "id" TEXT NOT NULL,
    "cursoId" TEXT NOT NULL,
    "numero" INTEGER NOT NULL,
    "nome" TEXT NOT NULL,
    "chSincrona" DECIMAL(6,2),
    "chAssincrona" DECIMAL(6,2),
    "chAtividades" DECIMAL(6,2),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "unidades_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "capitulos" (
    "id" TEXT NOT NULL,
    "unidadeId" TEXT NOT NULL,
    "numero" INTEGER NOT NULL,
    "nome" TEXT NOT NULL,
    "conteudoResumo" TEXT,
    "periodoDias" INTEGER,
    "ferramentas" TEXT,
    "atividadeFormativa" TEXT,
    "atividadeSomativa" TEXT,
    "feedback" TEXT,
    "chSincrona" DECIMAL(6,2),
    "chAssincrona" DECIMAL(6,2),
    "chAtividades" DECIMAL(6,2),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "capitulos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "objetivos_educacionais" (
    "id" TEXT NOT NULL,
    "capituloId" TEXT NOT NULL,
    "numero" INTEGER NOT NULL,
    "descricao" TEXT NOT NULL,
    "nivelBloom" "NivelBloom",
    "papeisAtores" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "objetivos_educacionais_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "etapas_definicao" (
    "id" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "tipoOA" "TipoOA",
    "papel" "PapelEtapa" NOT NULL,
    "ordem" INTEGER NOT NULL,
    "obrigatorio" BOOLEAN NOT NULL DEFAULT true,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "etapas_definicao_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "objetos_aprendizagem" (
    "id" TEXT NOT NULL,
    "capituloId" TEXT NOT NULL,
    "codigo" TEXT NOT NULL,
    "tipo" "TipoOA" NOT NULL,
    "numero" INTEGER NOT NULL,
    "titulo" TEXT,
    "descricao" TEXT,
    "status" "StatusOA" NOT NULL DEFAULT 'PENDENTE',
    "progressoPct" INTEGER NOT NULL DEFAULT 0,
    "linkObjeto" TEXT,
    "linkObjetoFinal" TEXT,
    "deadlineFinal" TIMESTAMP(3),
    "pontuacao" DECIMAL(6,2),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "objetos_aprendizagem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "etapas_oa" (
    "id" TEXT NOT NULL,
    "oaId" TEXT NOT NULL,
    "etapaDefId" TEXT NOT NULL,
    "responsavelId" TEXT,
    "status" "StatusEtapa" NOT NULL DEFAULT 'PENDENTE',
    "deadlinePrevisto" TIMESTAMP(3),
    "deadlineReal" TIMESTAMP(3),
    "ordem" INTEGER NOT NULL,
    "observacoes" TEXT,
    "bloqueada" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "etapas_oa_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "arquivos" (
    "id" TEXT NOT NULL,
    "oaId" TEXT NOT NULL,
    "etapaOaId" TEXT,
    "nome" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "tipoMime" TEXT,
    "tamanho" INTEGER,
    "autorId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "arquivos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "comentarios" (
    "id" TEXT NOT NULL,
    "texto" TEXT NOT NULL,
    "autorId" TEXT NOT NULL,
    "oaId" TEXT,
    "etapaOaId" TEXT,
    "parentId" TEXT,
    "mencoes" TEXT[],
    "editado" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "comentarios_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notificacoes" (
    "id" TEXT NOT NULL,
    "usuarioId" TEXT NOT NULL,
    "tipo" TEXT NOT NULL,
    "titulo" TEXT NOT NULL,
    "corpo" TEXT,
    "lida" BOOLEAN NOT NULL DEFAULT false,
    "entidadeTipo" TEXT,
    "entidadeId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notificacoes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_logs" (
    "id" TEXT NOT NULL,
    "usuarioId" TEXT,
    "acao" TEXT NOT NULL,
    "entidadeTipo" TEXT NOT NULL,
    "entidadeId" TEXT NOT NULL,
    "payloadAntes" JSONB,
    "payloadDepois" JSONB,
    "ip" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "usuarios_email_key" ON "usuarios"("email");

-- CreateIndex
CREATE UNIQUE INDEX "refresh_tokens_token_key" ON "refresh_tokens"("token");

-- CreateIndex
CREATE UNIQUE INDEX "cursos_codigo_key" ON "cursos"("codigo");

-- CreateIndex
CREATE UNIQUE INDEX "curso_membros_cursoId_usuarioId_key" ON "curso_membros"("cursoId", "usuarioId");

-- CreateIndex
CREATE UNIQUE INDEX "unidades_cursoId_numero_key" ON "unidades"("cursoId", "numero");

-- CreateIndex
CREATE UNIQUE INDEX "capitulos_unidadeId_numero_key" ON "capitulos"("unidadeId", "numero");

-- CreateIndex
CREATE UNIQUE INDEX "objetos_aprendizagem_codigo_key" ON "objetos_aprendizagem"("codigo");

-- AddForeignKey
ALTER TABLE "refresh_tokens" ADD CONSTRAINT "refresh_tokens_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "usuarios"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "curso_membros" ADD CONSTRAINT "curso_membros_cursoId_fkey" FOREIGN KEY ("cursoId") REFERENCES "cursos"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "curso_membros" ADD CONSTRAINT "curso_membros_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "usuarios"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "unidades" ADD CONSTRAINT "unidades_cursoId_fkey" FOREIGN KEY ("cursoId") REFERENCES "cursos"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "capitulos" ADD CONSTRAINT "capitulos_unidadeId_fkey" FOREIGN KEY ("unidadeId") REFERENCES "unidades"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "objetivos_educacionais" ADD CONSTRAINT "objetivos_educacionais_capituloId_fkey" FOREIGN KEY ("capituloId") REFERENCES "capitulos"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "objetos_aprendizagem" ADD CONSTRAINT "objetos_aprendizagem_capituloId_fkey" FOREIGN KEY ("capituloId") REFERENCES "capitulos"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "etapas_oa" ADD CONSTRAINT "etapas_oa_oaId_fkey" FOREIGN KEY ("oaId") REFERENCES "objetos_aprendizagem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "etapas_oa" ADD CONSTRAINT "etapas_oa_etapaDefId_fkey" FOREIGN KEY ("etapaDefId") REFERENCES "etapas_definicao"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "etapas_oa" ADD CONSTRAINT "etapas_oa_responsavelId_fkey" FOREIGN KEY ("responsavelId") REFERENCES "usuarios"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "arquivos" ADD CONSTRAINT "arquivos_oaId_fkey" FOREIGN KEY ("oaId") REFERENCES "objetos_aprendizagem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "arquivos" ADD CONSTRAINT "arquivos_autorId_fkey" FOREIGN KEY ("autorId") REFERENCES "usuarios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "comentarios" ADD CONSTRAINT "comentarios_autorId_fkey" FOREIGN KEY ("autorId") REFERENCES "usuarios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "comentarios" ADD CONSTRAINT "comentarios_oaId_fkey" FOREIGN KEY ("oaId") REFERENCES "objetos_aprendizagem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "comentarios" ADD CONSTRAINT "comentarios_etapaOaId_fkey" FOREIGN KEY ("etapaOaId") REFERENCES "etapas_oa"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "comentarios" ADD CONSTRAINT "comentarios_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "comentarios"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notificacoes" ADD CONSTRAINT "notificacoes_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "usuarios"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "usuarios"("id") ON DELETE SET NULL ON UPDATE CASCADE;
