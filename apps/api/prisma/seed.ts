import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

// ─── Pipeline por tipo de OA ───────────────────────────────────────────────────
//
// Todas: Setup(0) → Conteudista(1) → DI(2) → ...tipo específico... → Produção Final(5) → Validação Final(6)
// VIDEO: Setup → Conteudista(roteiro) → DI → Gravação → Edição de Vídeo → Produção Final → Validação Final
// Demais: Setup → Conteudista(preliminar) → DI → Acessibilidade → Diagramação → Produção Final → Validação Final
//
type TipoOA = "VIDEO" | "SLIDE" | "EBOOK" | "QUIZ" | "PLANO_AULA" | "TAREFA" | "INFOGRAFICO" | "TIMELINE" | "ANIMACAO";
type PapelEtapa =
  | "COORDENADOR_PRODUCAO"
  | "CONTEUDISTA" | "DESIGNER_INSTRUCIONAL" | "PROFESSOR_ATOR" | "PROFESSOR_TECNICO"
  | "ACESSIBILIDADE" | "EDITOR_VIDEO" | "DESIGNER_GRAFICO" | "PRODUTOR_FINAL" | "VALIDADOR_FINAL";

interface EtapaDef {
  id:          string;
  nome:        string;
  papel:       PapelEtapa;
  ordem:       number;
  tipoOA:      TipoOA | null;
  obrigatorio: boolean;
  temArtefato: boolean;
}

const PIPELINE: EtapaDef[] = [
  // ── VIDEO ──────────────────────────────────────────────────────────────────
  { id: "seed-video-0-setup",          nome: "Setup de Produção",         papel: "COORDENADOR_PRODUCAO",  ordem: 0, tipoOA: "VIDEO",     obrigatorio: true, temArtefato: false },
  { id: "seed-video-1-conteudista",    nome: "Produção de Conteúdo",      papel: "CONTEUDISTA",           ordem: 1, tipoOA: "VIDEO",     obrigatorio: true, temArtefato: true  },
  { id: "seed-video-2-di",             nome: "Validação DI",              papel: "DESIGNER_INSTRUCIONAL", ordem: 2, tipoOA: "VIDEO",     obrigatorio: true, temArtefato: false },
  { id: "seed-video-3-gravacao",       nome: "Gravação",                  papel: "PROFESSOR_ATOR",        ordem: 3, tipoOA: "VIDEO",     obrigatorio: true, temArtefato: false },
  { id: "seed-video-4-edicao",         nome: "Edição de Vídeo",           papel: "EDITOR_VIDEO",          ordem: 4, tipoOA: "VIDEO",     obrigatorio: true, temArtefato: true  },
  { id: "seed-video-5-producao",       nome: "Produção Final",            papel: "PRODUTOR_FINAL",        ordem: 5, tipoOA: "VIDEO",     obrigatorio: true, temArtefato: true  },
  { id: "seed-video-5-validacao",      nome: "Validação Final",           papel: "VALIDADOR_FINAL",       ordem: 6, tipoOA: "VIDEO",     obrigatorio: true, temArtefato: false },

  // ── SLIDE ──────────────────────────────────────────────────────────────────
  { id: "seed-slide-0-setup",          nome: "Setup de Produção",         papel: "COORDENADOR_PRODUCAO",  ordem: 0, tipoOA: "SLIDE",     obrigatorio: true, temArtefato: false },
  { id: "seed-slide-1-conteudista",    nome: "Produção de Conteúdo",      papel: "CONTEUDISTA",           ordem: 1, tipoOA: "SLIDE",     obrigatorio: true, temArtefato: true  },
  { id: "seed-slide-2-di",             nome: "Validação DI",              papel: "DESIGNER_INSTRUCIONAL", ordem: 2, tipoOA: "SLIDE",     obrigatorio: true, temArtefato: false },
  { id: "seed-slide-3-acessibilidade", nome: "Acessibilidade",            papel: "ACESSIBILIDADE",        ordem: 3, tipoOA: "SLIDE",     obrigatorio: true, temArtefato: false },
  { id: "seed-slide-4-diagramacao",    nome: "Diagramação",               papel: "DESIGNER_GRAFICO",      ordem: 4, tipoOA: "SLIDE",     obrigatorio: true, temArtefato: true  },
  { id: "seed-slide-5-producao",       nome: "Produção Final",            papel: "PRODUTOR_FINAL",        ordem: 5, tipoOA: "SLIDE",     obrigatorio: true, temArtefato: true  },
  { id: "seed-slide-5-validacao",      nome: "Validação Final",           papel: "VALIDADOR_FINAL",       ordem: 6, tipoOA: "SLIDE",     obrigatorio: true, temArtefato: false },

  // ── EBOOK ──────────────────────────────────────────────────────────────────
  { id: "seed-ebook-0-setup",          nome: "Setup de Produção",         papel: "COORDENADOR_PRODUCAO",  ordem: 0, tipoOA: "EBOOK",     obrigatorio: true, temArtefato: false },
  { id: "seed-ebook-1-conteudista",    nome: "Produção de Conteúdo",      papel: "CONTEUDISTA",           ordem: 1, tipoOA: "EBOOK",     obrigatorio: true, temArtefato: true  },
  { id: "seed-ebook-2-di",             nome: "Validação DI",              papel: "DESIGNER_INSTRUCIONAL", ordem: 2, tipoOA: "EBOOK",     obrigatorio: true, temArtefato: false },
  { id: "seed-ebook-3-acessibilidade", nome: "Acessibilidade",            papel: "ACESSIBILIDADE",        ordem: 3, tipoOA: "EBOOK",     obrigatorio: true, temArtefato: false },
  { id: "seed-ebook-4-diagramacao",    nome: "Diagramação",               papel: "DESIGNER_GRAFICO",      ordem: 4, tipoOA: "EBOOK",     obrigatorio: true, temArtefato: true  },
  { id: "seed-ebook-5-producao",       nome: "Produção Final",            papel: "PRODUTOR_FINAL",        ordem: 5, tipoOA: "EBOOK",     obrigatorio: true, temArtefato: true  },
  { id: "seed-ebook-5-validacao",      nome: "Validação Final",           papel: "VALIDADOR_FINAL",       ordem: 6, tipoOA: "EBOOK",     obrigatorio: true, temArtefato: false },

  // ── QUIZ ───────────────────────────────────────────────────────────────────
  { id: "seed-quiz-0-setup",           nome: "Setup de Produção",         papel: "COORDENADOR_PRODUCAO",  ordem: 0, tipoOA: "QUIZ",      obrigatorio: true, temArtefato: false },
  { id: "seed-quiz-1-conteudista",     nome: "Produção de Conteúdo",      papel: "CONTEUDISTA",           ordem: 1, tipoOA: "QUIZ",      obrigatorio: true, temArtefato: true  },
  { id: "seed-quiz-2-di",              nome: "Validação DI",              papel: "DESIGNER_INSTRUCIONAL", ordem: 2, tipoOA: "QUIZ",      obrigatorio: true, temArtefato: false },
  { id: "seed-quiz-3-acessibilidade",  nome: "Acessibilidade",            papel: "ACESSIBILIDADE",        ordem: 3, tipoOA: "QUIZ",      obrigatorio: true, temArtefato: false },
  { id: "seed-quiz-4-diagramacao",     nome: "Diagramação",               papel: "DESIGNER_GRAFICO",      ordem: 4, tipoOA: "QUIZ",      obrigatorio: true, temArtefato: true  },
  { id: "seed-quiz-5-producao",        nome: "Produção Final",            papel: "PRODUTOR_FINAL",        ordem: 5, tipoOA: "QUIZ",      obrigatorio: true, temArtefato: true  },
  { id: "seed-quiz-5-validacao",       nome: "Validação Final",           papel: "VALIDADOR_FINAL",       ordem: 6, tipoOA: "QUIZ",      obrigatorio: true, temArtefato: false },

  // ── INFOGRAFICO ────────────────────────────────────────────────────────────
  { id: "seed-info-0-setup",           nome: "Setup de Produção",         papel: "COORDENADOR_PRODUCAO",  ordem: 0, tipoOA: "INFOGRAFICO", obrigatorio: true, temArtefato: false },
  { id: "seed-info-1-conteudista",     nome: "Produção de Conteúdo",      papel: "CONTEUDISTA",           ordem: 1, tipoOA: "INFOGRAFICO", obrigatorio: true, temArtefato: true  },
  { id: "seed-info-2-di",              nome: "Validação DI",              papel: "DESIGNER_INSTRUCIONAL", ordem: 2, tipoOA: "INFOGRAFICO", obrigatorio: true, temArtefato: false },
  { id: "seed-info-3-acessibilidade",  nome: "Acessibilidade",            papel: "ACESSIBILIDADE",        ordem: 3, tipoOA: "INFOGRAFICO", obrigatorio: true, temArtefato: false },
  { id: "seed-info-4-diagramacao",     nome: "Diagramação",               papel: "DESIGNER_GRAFICO",      ordem: 4, tipoOA: "INFOGRAFICO", obrigatorio: true, temArtefato: true  },
  { id: "seed-info-5-producao",        nome: "Produção Final",            papel: "PRODUTOR_FINAL",        ordem: 5, tipoOA: "INFOGRAFICO", obrigatorio: true, temArtefato: true  },
  { id: "seed-info-5-validacao",       nome: "Validação Final",           papel: "VALIDADOR_FINAL",       ordem: 6, tipoOA: "INFOGRAFICO", obrigatorio: true, temArtefato: false },

  // ── TIMELINE ───────────────────────────────────────────────────────────────
  { id: "seed-timeline-0-setup",          nome: "Setup de Produção",      papel: "COORDENADOR_PRODUCAO",  ordem: 0, tipoOA: "TIMELINE",  obrigatorio: true, temArtefato: false },
  { id: "seed-timeline-1-conteudista",    nome: "Produção de Conteúdo",   papel: "CONTEUDISTA",           ordem: 1, tipoOA: "TIMELINE",  obrigatorio: true, temArtefato: true  },
  { id: "seed-timeline-2-di",             nome: "Validação DI",           papel: "DESIGNER_INSTRUCIONAL", ordem: 2, tipoOA: "TIMELINE",  obrigatorio: true, temArtefato: false },
  { id: "seed-timeline-3-acessibilidade", nome: "Acessibilidade",         papel: "ACESSIBILIDADE",        ordem: 3, tipoOA: "TIMELINE",  obrigatorio: true, temArtefato: false },
  { id: "seed-timeline-4-diagramacao",    nome: "Diagramação",            papel: "DESIGNER_GRAFICO",      ordem: 4, tipoOA: "TIMELINE",  obrigatorio: true, temArtefato: true  },
  { id: "seed-timeline-5-producao",       nome: "Produção Final",         papel: "PRODUTOR_FINAL",        ordem: 5, tipoOA: "TIMELINE",  obrigatorio: true, temArtefato: true  },
  { id: "seed-timeline-5-validacao",      nome: "Validação Final",        papel: "VALIDADOR_FINAL",       ordem: 6, tipoOA: "TIMELINE",  obrigatorio: true, temArtefato: false },

  // ── TAREFA ─────────────────────────────────────────────────────────────────
  { id: "seed-tarefa-0-setup",         nome: "Setup de Produção",         papel: "COORDENADOR_PRODUCAO",  ordem: 0, tipoOA: "TAREFA",    obrigatorio: true, temArtefato: false },
  { id: "seed-tarefa-1-conteudista",   nome: "Produção de Conteúdo",      papel: "CONTEUDISTA",           ordem: 1, tipoOA: "TAREFA",    obrigatorio: true, temArtefato: true  },
  { id: "seed-tarefa-2-di",            nome: "Validação DI",              papel: "DESIGNER_INSTRUCIONAL", ordem: 2, tipoOA: "TAREFA",    obrigatorio: true, temArtefato: false },
  { id: "seed-tarefa-3-acessibilidade",nome: "Acessibilidade",            papel: "ACESSIBILIDADE",        ordem: 3, tipoOA: "TAREFA",    obrigatorio: true, temArtefato: false },
  { id: "seed-tarefa-4-diagramacao",   nome: "Diagramação",               papel: "DESIGNER_GRAFICO",      ordem: 4, tipoOA: "TAREFA",    obrigatorio: true, temArtefato: true  },
  { id: "seed-tarefa-5-producao",      nome: "Produção Final",            papel: "PRODUTOR_FINAL",        ordem: 5, tipoOA: "TAREFA",    obrigatorio: true, temArtefato: true  },
  { id: "seed-tarefa-5-validacao",     nome: "Validação Final",           papel: "VALIDADOR_FINAL",       ordem: 6, tipoOA: "TAREFA",    obrigatorio: true, temArtefato: false },

  // ── PLANO_AULA ─────────────────────────────────────────────────────────────
  { id: "seed-plano-0-setup",          nome: "Setup de Produção",         papel: "COORDENADOR_PRODUCAO",  ordem: 0, tipoOA: "PLANO_AULA", obrigatorio: true, temArtefato: false },
  { id: "seed-plano-1-conteudista",    nome: "Produção de Conteúdo",      papel: "CONTEUDISTA",           ordem: 1, tipoOA: "PLANO_AULA", obrigatorio: true, temArtefato: true  },
  { id: "seed-plano-2-di",             nome: "Validação DI",              papel: "DESIGNER_INSTRUCIONAL", ordem: 2, tipoOA: "PLANO_AULA", obrigatorio: true, temArtefato: false },
  { id: "seed-plano-3-acessibilidade", nome: "Acessibilidade",            papel: "ACESSIBILIDADE",        ordem: 3, tipoOA: "PLANO_AULA", obrigatorio: true, temArtefato: false },
  { id: "seed-plano-4-diagramacao",    nome: "Diagramação",               papel: "DESIGNER_GRAFICO",      ordem: 4, tipoOA: "PLANO_AULA", obrigatorio: true, temArtefato: true  },
  { id: "seed-plano-5-producao",       nome: "Produção Final",            papel: "PRODUTOR_FINAL",        ordem: 5, tipoOA: "PLANO_AULA", obrigatorio: true, temArtefato: true  },
  { id: "seed-plano-5-validacao",      nome: "Validação Final",           papel: "VALIDADOR_FINAL",       ordem: 6, tipoOA: "PLANO_AULA", obrigatorio: true, temArtefato: false },

  // ── ANIMACAO ───────────────────────────────────────────────────────────────
  { id: "seed-anim-0-setup",           nome: "Setup de Produção",         papel: "COORDENADOR_PRODUCAO",  ordem: 0, tipoOA: "ANIMACAO",   obrigatorio: true, temArtefato: false },
  { id: "seed-anim-1-conteudista",     nome: "Produção de Conteúdo",      papel: "CONTEUDISTA",           ordem: 1, tipoOA: "ANIMACAO",   obrigatorio: true, temArtefato: true  },
  { id: "seed-anim-2-di",              nome: "Validação DI",              papel: "DESIGNER_INSTRUCIONAL", ordem: 2, tipoOA: "ANIMACAO",   obrigatorio: true, temArtefato: false },
  { id: "seed-anim-3-gravacao",        nome: "Gravação",                  papel: "PROFESSOR_ATOR",        ordem: 3, tipoOA: "ANIMACAO",   obrigatorio: true, temArtefato: false },
  { id: "seed-anim-4-edicao",          nome: "Edição de Vídeo",           papel: "EDITOR_VIDEO",          ordem: 4, tipoOA: "ANIMACAO",   obrigatorio: true, temArtefato: true  },
  { id: "seed-anim-5-producao",        nome: "Produção Final",            papel: "PRODUTOR_FINAL",        ordem: 5, tipoOA: "ANIMACAO",   obrigatorio: true, temArtefato: true  },
  { id: "seed-anim-5-validacao",       nome: "Validação Final",           papel: "VALIDADOR_FINAL",       ordem: 6, tipoOA: "ANIMACAO",   obrigatorio: true, temArtefato: false },
];

// IDs das antigas etapas globais (criadas pelo seed anterior) — serão desativadas
const OLD_GLOBAL_IDS = [
  "seed-conteudista-global",
  "seed-designer_instrucional-global",
  "seed-professor_tecnico-global",
  "seed-acessibilidade-global",
  "seed-produtor_final-global",
  "seed-validador_final-global",
  "seed-professor_ator-video",
];

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

  // ─── Desativa etapas globais legadas ────────────────────────────────────────
  for (const id of OLD_GLOBAL_IDS) {
    await prisma.etapaDefinicao.updateMany({ where: { id }, data: { ativo: false } });
  }

  // ─── Pipeline por tipo de OA ─────────────────────────────────────────────────
  for (const etapa of PIPELINE) {
    await prisma.etapaDefinicao.upsert({
      where:  { id: etapa.id },
      update: { nome: etapa.nome, papel: etapa.papel as any, ordem: etapa.ordem,
                tipoOA: etapa.tipoOA as any, obrigatorio: etapa.obrigatorio,
                temArtefato: etapa.temArtefato, ativo: true },
      create: { id: etapa.id, nome: etapa.nome, papel: etapa.papel as any, ordem: etapa.ordem,
                tipoOA: etapa.tipoOA as any, obrigatorio: etapa.obrigatorio,
                temArtefato: etapa.temArtefato, ativo: true },
    });
  }

  console.log(`✅ Pipeline configurado: ${PIPELINE.length} etapas distribuídas por tipo de OA.`);

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
