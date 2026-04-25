-- RF-M2-05: campo "alteracoes" para rastrear campos modificados por versão da MI
ALTER TABLE "mi_historico" ADD COLUMN "alteracoes" JSONB;
