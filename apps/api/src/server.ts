import "dotenv/config";
import { createApp } from "./app.js";
import { logger } from "./lib/logger.js";
import { prisma } from "./lib/prisma.js";
import { startScheduler } from "./lib/scheduler.js";

const PORT = Number(process.env["PORT"] ?? 3001);

async function main() {
  // Verifica conexão com o banco antes de subir
  try {
    await prisma.$connect();
    logger.info("✅ Banco de dados conectado.");
  } catch (err) {
    logger.error({ err }, "❌ Falha ao conectar ao banco de dados.");
    process.exit(1);
  }

  const app = createApp();
  startScheduler();

  const server = app.listen(PORT, () => {
    logger.info(`🚀 API RedeFLOW rodando em http://localhost:${PORT}`);
    logger.info(`   Ambiente: ${process.env["NODE_ENV"] ?? "development"}`);
  });

  // Graceful shutdown
  const shutdown = async (signal: string) => {
    logger.info(`⚠️  ${signal} recebido. Encerrando servidor...`);
    server.close(async () => {
      await prisma.$disconnect();
      logger.info("👋 Servidor encerrado.");
      process.exit(0);
    });
  };

  process.on("SIGINT", () => shutdown("SIGINT"));
  process.on("SIGTERM", () => shutdown("SIGTERM"));
}

main();
