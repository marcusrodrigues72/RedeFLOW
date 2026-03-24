import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import type { Notificacao } from "shared";

export const notifKeys = {
  list:  () => ["notificacoes"]         as const,
  count: () => ["notificacoes", "count"] as const,
};

export function useNotificacoes() {
  return useQuery({
    queryKey: notifKeys.list(),
    queryFn:  () => api.get<Notificacao[]>("/notificacoes").then((r) => r.data),
    refetchInterval: 30_000,
  });
}

export function useNaoLidasCount() {
  return useQuery({
    queryKey: notifKeys.count(),
    queryFn:  () => api.get<{ count: number }>("/notificacoes/nao-lidas/count").then((r) => r.data.count),
    refetchInterval: 30_000,
  });
}

export function useMarcarLida() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.patch(`/notificacoes/${id}/ler`),
    onSuccess:  () => {
      qc.invalidateQueries({ queryKey: notifKeys.list() });
      qc.invalidateQueries({ queryKey: notifKeys.count() });
    },
  });
}

export function useMarcarTodasLidas() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => api.patch("/notificacoes/ler-todas"),
    onSuccess:  () => {
      qc.invalidateQueries({ queryKey: notifKeys.list() });
      qc.invalidateQueries({ queryKey: notifKeys.count() });
    },
  });
}
