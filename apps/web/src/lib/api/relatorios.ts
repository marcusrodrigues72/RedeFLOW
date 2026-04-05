import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import type { RelatorioCurso, RelatorioPipelineStatus, RelatorioAtrasoResponsavel, RelatorioAlocacao, RelatorioBurndown, RelatorioDesvio } from "shared";

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

export function useDesvioDeadline(cursoId?: string | null) {
  return useQuery({
    queryKey: ["relatorios", "desvio-deadline", cursoId ?? "all"],
    queryFn:  () => {
      const url = cursoId ? `/relatorios/desvio-deadline?cursoId=${cursoId}` : "/relatorios/desvio-deadline";
      return api.get<RelatorioDesvio>(url).then((r) => r.data);
    },
  });
}

/** Dispara download de .xlsx autenticado */
export function downloadRelatorio(endpoint: string, cursoId?: string | null) {
  const stored = localStorage.getItem("redeflow-auth");
  const token  = stored ? (JSON.parse(stored)?.state?.accessToken ?? "") : "";
  const base   = (import.meta.env.VITE_API_URL as string | undefined) ?? "";
  const url    = `${base}${endpoint}${cursoId ? `?cursoId=${cursoId}` : ""}`;
  fetch(url, { headers: { Authorization: `Bearer ${token}` } })
    .then((r) => r.blob())
    .then((blob) => {
      const a = document.createElement("a");
      a.href  = URL.createObjectURL(blob);
      a.download = (endpoint.split("/").pop() ?? "relatorio") + ".xlsx";
      a.click();
      URL.revokeObjectURL(a.href);
    });
}
