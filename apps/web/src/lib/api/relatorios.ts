import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import type { RelatorioCurso, RelatorioPipelineStatus, RelatorioAtrasoResponsavel } from "shared";

export const relatorioKeys = {
  progressoCursos:    () => ["relatorios", "progresso-cursos"]    as const,
  pipelineStatus:     () => ["relatorios", "pipeline-status"]     as const,
  atrasosResponsavel: () => ["relatorios", "atrasos-responsavel"] as const,
};

export function useProgressoCursos() {
  return useQuery({
    queryKey: relatorioKeys.progressoCursos(),
    queryFn:  () => api.get<RelatorioCurso[]>("/relatorios/progresso-cursos").then((r) => r.data),
  });
}

export function usePipelineStatus() {
  return useQuery({
    queryKey: relatorioKeys.pipelineStatus(),
    queryFn:  () => api.get<RelatorioPipelineStatus>("/relatorios/pipeline-status").then((r) => r.data),
  });
}

export function useAtrasosResponsavel() {
  return useQuery({
    queryKey: relatorioKeys.atrasosResponsavel(),
    queryFn:  () => api.get<RelatorioAtrasoResponsavel[]>("/relatorios/atrasos-responsavel").then((r) => r.data),
  });
}
