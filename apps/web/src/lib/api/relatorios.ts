import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import type { RelatorioCurso, RelatorioPipelineStatus, RelatorioAtrasoResponsavel, RelatorioAlocacao, RelatorioBurndown } from "shared";

export const relatorioKeys = {
  progressoCursos:    () => ["relatorios", "progresso-cursos"]    as const,
  pipelineStatus:     () => ["relatorios", "pipeline-status"]     as const,
  atrasosResponsavel: () => ["relatorios", "atrasos-responsavel"] as const,
  alocacao:           () => ["relatorios", "alocacao"]            as const,
};

export function useProgressoCursos() {
  return useQuery({
    queryKey: relatorioKeys.progressoCursos(),
    queryFn:  () => api.get<RelatorioCurso[]>("/relatorios/progresso-cursos").then((r) => r.data),
  });
}

export function usePipelineStatus(cursoId?: string | null) {
  return useQuery({
    queryKey: [...relatorioKeys.pipelineStatus(), cursoId ?? "all"],
    queryFn:  () => {
      const url = cursoId ? `/relatorios/pipeline-status?cursoId=${cursoId}` : "/relatorios/pipeline-status";
      return api.get<RelatorioPipelineStatus>(url).then((r) => r.data);
    },
  });
}

export function useAtrasosResponsavel(cursoId?: string | null) {
  return useQuery({
    queryKey: [...relatorioKeys.atrasosResponsavel(), cursoId ?? "all"],
    queryFn:  () => {
      const url = cursoId ? `/relatorios/atrasos-responsavel?cursoId=${cursoId}` : "/relatorios/atrasos-responsavel";
      return api.get<RelatorioAtrasoResponsavel[]>(url).then((r) => r.data);
    },
  });
}

export function useAlocacao() {
  return useQuery({
    queryKey: relatorioKeys.alocacao(),
    queryFn:  () => api.get<RelatorioAlocacao>("/relatorios/alocacao").then((r) => r.data),
  });
}

export function useBurndown(cursoId: string | null) {
  return useQuery({
    queryKey: ["relatorios", "burndown", cursoId],
    queryFn:  () => api.get<RelatorioBurndown>(`/relatorios/burndown?cursoId=${cursoId}`).then((r) => r.data),
    enabled:  !!cursoId,
  });
}
