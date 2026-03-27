-- Marca etapas que produzem entregáveis (temArtefato = true)
-- Aplica tanto aos registros novos (por tipo de OA) quanto aos legados (pipeline global)
UPDATE "etapas_definicao"
SET "temArtefato" = true
WHERE papel IN ('CONTEUDISTA', 'PRODUTOR_FINAL', 'EDITOR_VIDEO', 'DESIGNER_GRAFICO');
