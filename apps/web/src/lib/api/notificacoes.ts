import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import type { Notificacao, ConfigAlertaCurso } from "shared";

export const notifKeys = {
  list:        (tipo?: string, lida?: boolean) => ["notificacoes", tipo, lida] as const,
  count:       () => ["notificacoes", "count"]  as const,
  configCurso: (cursoId: string)               => ["cursos", cursoId, "config-alertas"] as const,
};

export function useNotificacoes(tipo?: string, lida?: boolean) {
  return useQuery({
    queryKey: notifKeys.list(tipo, lida),
    queryFn: () => {
      const params = new URLSearchParams();
      if (tipo  !== undefined) params.set("tipo",  tipo);
      if (lida  !== undefined) params.set("lida",  String(lida));
      params.set("limit", "200");
      return api.get<Notificacao[]>(`/notificacoes?${params.toString()}`).then((r) => r.data);
    },
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
      qc.invalidateQueries({ queryKey: ["notificacoes"] });
    },
  });
}

export function useMarcarTodasLidas() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => api.patch("/notificacoes/ler-todas"),
    onSuccess:  () => {
      qc.invalidateQueries({ queryKey: ["notificacoes"] });
    },
  });
}

// ─── Config de Alertas por Curso ─────────────────────────────────────────────

export function useConfigAlertasCurso(cursoId: string) {
  return useQuery({
    queryKey: notifKeys.configCurso(cursoId),
    queryFn:  () => api.get<ConfigAlertaCurso>(`/cursos/${cursoId}/config-alertas`).then((r) => r.data),
    enabled:  !!cursoId,
  });
}

export function useSalvarConfigAlertasCurso(cursoId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: Partial<Omit<ConfigAlertaCurso, "id" | "cursoId" | "updatedAt">>) =>
      api.put<ConfigAlertaCurso>(`/cursos/${cursoId}/config-alertas`, data).then((r) => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: notifKeys.configCurso(cursoId) });
    },
  });
}

// ─── Preferências de notificação por membro ───────────────────────────────────

export function useAtualizarNotifMembro(cursoId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ usuarioId, notifEmailAtivo, notifInAppAtivo }: {
      usuarioId:       string;
      notifEmailAtivo?: boolean;
      notifInAppAtivo?: boolean;
    }) =>
      api.patch(`/cursos/${cursoId}/membros/${usuarioId}/notif`, {
        notifEmailAtivo,
        notifInAppAtivo,
      }).then((r) => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["cursos", cursoId] });
    },
  });
}
