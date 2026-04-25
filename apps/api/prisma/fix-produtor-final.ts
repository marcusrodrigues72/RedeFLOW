/**
 * fix-produtor-final.ts
 *
 * Script de migração de dados: insere a etapa "Produção Final" (PRODUTOR_FINAL)
 * em todos os OAs que não a possuem ainda, e reordena a "Validação Final" para
 * vir logo depois.
 *
 * Execução (no servidor EC2 ou local com DATABASE_URL correto):
 *   npm run db:fix-produtor-final
 *   — ou diretamente:
 *   npx tsx prisma/fix-produtor-final.ts
 */

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  console.log("🔧 Iniciando correção: inserindo etapa Produção Final nos OAs...\n");

  // 1. Carrega todos os EtapaDefs ativos, indexados por (papel, tipoOA)
  const todosOsDefs = await prisma.etapaDefinicao.findMany({ where: { ativo: true } });

  const produtorDefs = todosOsDefs.filter((d) => d.papel === "PRODUTOR_FINAL");
  const validadorDefs = todosOsDefs.filter((d) => d.papel === "VALIDADOR_FINAL");

  if (produtorDefs.length === 0) {
    console.error("❌ Nenhum EtapaDefinicao de PRODUTOR_FINAL encontrado. Execute o seed antes.");
    return;
  }

  const produtorByTipo  = new Map(produtorDefs.map((d)  => [d.tipoOA as string, d]));
  const validadorByTipo = new Map(validadorDefs.map((d) => [d.tipoOA as string, d]));

  console.log(`✅ EtapaDefs PRODUTOR_FINAL encontrados para: ${[...produtorByTipo.keys()].join(", ")}\n`);

  // 2. Carrega todos os OAs com suas etapas
  const oas = await prisma.objetoAprendizagem.findMany({
    select: {
      id:     true,
      tipo:   true,
      codigo: true,
      etapas: {
        select: { id: true, ordem: true, etapaDef: { select: { papel: true } } },
        orderBy: { ordem: "asc" },
      },
    },
  });

  let corrigidos        = 0;
  let semDef            = 0;
  let jaTemPF           = 0;
  let piplineReconstruido = 0;

  for (const oa of oas) {
    const jaTemProdutor = oa.etapas.some((e) => e.etapaDef.papel === "PRODUTOR_FINAL");
    if (jaTemProdutor) {
      jaTemPF++;
      continue;
    }

    const prodDef = produtorByTipo.get(oa.tipo as string);
    if (!prodDef) {
      semDef++;
      console.warn(`⚠️  Sem EtapaDef PRODUTOR_FINAL para tipo ${oa.tipo} — OA ${oa.codigo} ignorado.`);
      continue;
    }

    const validadorEtapa = oa.etapas.find((e) => e.etapaDef.papel === "VALIDADOR_FINAL");

    if (validadorEtapa) {
      // Caso normal: insere PRODUTOR_FINAL antes do VALIDADOR_FINAL existente
      await prisma.$transaction([
        prisma.etapaOA.create({
          data: {
            oaId:       oa.id,
            etapaDefId: prodDef.id,
            status:     "PENDENTE",
            ordem:      validadorEtapa.ordem,
          },
        }),
        prisma.etapaOA.update({
          where: { id: validadorEtapa.id },
          data:  { ordem: validadorEtapa.ordem + 1 },
        }),
      ]);
      corrigidos++;
    } else {
      // Pipeline incompleto: falta VALIDADOR_FINAL também — insere ambos no final
      const validDef = validadorByTipo.get(oa.tipo as string);
      if (!validDef) {
        console.warn(`⚠️  OA ${oa.codigo}: sem EtapaDef VALIDADOR_FINAL para tipo ${oa.tipo} — pulando.`);
        continue;
      }

      const maxOrdem = oa.etapas.length > 0
        ? Math.max(...oa.etapas.map((e) => e.ordem))
        : 4;

      console.log(`🔨 OA ${oa.codigo} (${oa.tipo}): pipeline incompleto — inserindo PRODUTOR_FINAL(${maxOrdem + 1}) e VALIDADOR_FINAL(${maxOrdem + 2})`);

      await prisma.$transaction([
        prisma.etapaOA.create({
          data: {
            oaId:       oa.id,
            etapaDefId: prodDef.id,
            status:     "PENDENTE",
            ordem:      maxOrdem + 1,
          },
        }),
        prisma.etapaOA.create({
          data: {
            oaId:       oa.id,
            etapaDefId: validDef.id,
            status:     "PENDENTE",
            ordem:      maxOrdem + 2,
          },
        }),
      ]);
      piplineReconstruido++;
      corrigidos++;
    }
  }

  console.log("\n📊 Resultado:");
  console.log(`   ✅ OAs corrigidos (PRODUTOR_FINAL inserido):          ${corrigidos}`);
  console.log(`      ↳ com pipeline reconstruído (sem VALIDADOR_FINAL): ${piplineReconstruido}`);
  console.log(`   ⏭️  OAs que já tinham PRODUTOR_FINAL:                 ${jaTemPF}`);
  console.log(`   ⚠️  OAs sem EtapaDef para o tipo:                     ${semDef}`);
}

main()
  .then(() => {
    console.log("\n🏁 Correção concluída.");
    return prisma.$disconnect();
  })
  .catch((err) => {
    console.error("❌ Erro durante a correção:", err);
    return prisma.$disconnect().then(() => process.exit(1));
  });
