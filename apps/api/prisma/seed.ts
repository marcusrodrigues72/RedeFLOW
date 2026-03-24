import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  console.log("🌱 Iniciando seed do banco de dados...\n");

  // ─── Usuários ───────────────────────────────────────────────────────────────
  const senhaAdmin = await bcrypt.hash("Admin@123456", 12);
  const senhaColaborador = await bcrypt.hash("Teste@123456", 12);

  const admin = await prisma.usuario.upsert({
    where: { email: "admin@iredeead.com.br" },
    update: {},
    create: { nome: "Coordenador iRede", email: "admin@iredeead.com.br", senhaHash: senhaAdmin, papelGlobal: "ADMIN" },
  });

  const di = await prisma.usuario.upsert({
    where: { email: "di@iredeead.com.br" },
    update: {},
    create: { nome: "Designer Instrucional", email: "di@iredeead.com.br", senhaHash: senhaColaborador, papelGlobal: "COLABORADOR" },
  });

  const conteudista = await prisma.usuario.upsert({
    where: { email: "conteudista@iredeead.com.br" },
    update: {},
    create: { nome: "Conteudista Teste", email: "conteudista@iredeead.com.br", senhaHash: senhaColaborador, papelGlobal: "COLABORADOR" },
  });

  console.log(`✅ Usuários criados: ${admin.nome}, ${di.nome}, ${conteudista.nome}`);

  // ─── Pipeline padrão (EtapaDefinicao) ───────────────────────────────────────
  // Etapas globais (aplicam a todos os tipos de OA)
  const etapasGlobais = [
    { nome: "Conteudista",           papel: "CONTEUDISTA",             ordem: 1, tipoOA: null },
    { nome: "Designer Instrucional", papel: "DESIGNER_INSTRUCIONAL",   ordem: 2, tipoOA: null },
    { nome: "Revisão Técnica",       papel: "PROFESSOR_TECNICO",       ordem: 4, tipoOA: null },
    { nome: "Acessibilidade",        papel: "ACESSIBILIDADE",          ordem: 5, tipoOA: null },
    { nome: "Produção Final",        papel: "PRODUTOR_FINAL",          ordem: 6, tipoOA: null },
    { nome: "Validação Final",       papel: "VALIDADOR_FINAL",         ordem: 7, tipoOA: null },
  ];

  // Etapa exclusiva de vídeo (Gravação — entre DI e Rev. Técnica)
  const etapaGravacao = {
    nome: "Gravação",
    papel: "PROFESSOR_ATOR",
    ordem: 3,
    tipoOA: "VIDEO" as const,
  };

  for (const etapa of etapasGlobais) {
    await prisma.etapaDefinicao.upsert({
      where: {
        id: `seed-${etapa.papel.toLowerCase()}-global`,
      },
      update: {},
      create: {
        id: `seed-${etapa.papel.toLowerCase()}-global`,
        nome: etapa.nome,
        papel: etapa.papel as any,
        ordem: etapa.ordem,
        tipoOA: null,
        obrigatorio: true,
        ativo: true,
      },
    });
  }

  await prisma.etapaDefinicao.upsert({
    where: { id: "seed-professor_ator-video" },
    update: {},
    create: {
      id: "seed-professor_ator-video",
      nome: etapaGravacao.nome,
      papel: etapaGravacao.papel as any,
      ordem: etapaGravacao.ordem,
      tipoOA: etapaGravacao.tipoOA,
      obrigatorio: true,
      ativo: true,
    },
  });

  console.log("✅ Pipeline padrão (7 etapas) configurado.");

  // ─── Resumo ─────────────────────────────────────────────────────────────────
  console.log("\n📋 Credenciais de acesso:");
  console.log("   Coordenador  → admin@iredeead.com.br          / Admin@123456");
  console.log("   DI           → di@iredeead.com.br             / Teste@123456");
  console.log("   Conteudista  → conteudista@iredeead.com.br    / Teste@123456");
}

main()
  .then(() => {
    console.log("\n🌱 Seed concluído.");
    return prisma.$disconnect();
  })
  .catch((err) => {
    console.error("❌ Erro no seed:", err);
    return prisma.$disconnect().then(() => process.exit(1));
  });
