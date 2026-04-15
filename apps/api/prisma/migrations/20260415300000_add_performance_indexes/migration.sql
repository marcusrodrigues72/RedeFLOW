-- Performance indexes for high-frequency queries

-- Comentarios: filtrar por oaId, etapaOaId, capituloId
CREATE INDEX IF NOT EXISTS "comentarios_oaId_idx"      ON "comentarios"("oaId");
CREATE INDEX IF NOT EXISTS "comentarios_etapaOaId_idx" ON "comentarios"("etapaOaId");
CREATE INDEX IF NOT EXISTS "comentarios_capituloId_idx" ON "comentarios"("capituloId");

-- Notificacoes: feed do usuário e badge de não-lidas
CREATE INDEX IF NOT EXISTS "notificacoes_usuarioId_lida_idx" ON "notificacoes"("usuarioId", "lida");

-- AuditLog: lookup por entidade
CREATE INDEX IF NOT EXISTS "audit_logs_entidadeTipo_entidadeId_idx" ON "audit_logs"("entidadeTipo", "entidadeId");
