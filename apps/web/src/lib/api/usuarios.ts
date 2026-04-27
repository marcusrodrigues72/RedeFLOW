import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import type { UsuarioAdmin, EtapaDefinicaoAdmin, WebhookItem, CriarWebhookPayload, AtualizarWebhookPayload } from "shared";

export const usuarioKeys = {
  list: () => ["usuarios"] as const,
};

export function useUsuarios() {
  return useQuery({
    queryKey: usuarioKeys.list(),
    queryFn:  () => api.get<UsuarioAdmin[]>("/usuarios").then((r) => r.data),
  });
}

export function useCriarUsuario() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: { nome: string; email: string; senha: string; papelGlobal: string }) =>
      api.post<UsuarioAdmin>("/usuarios", data).then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: usuarioKeys.list() }),
  });
}

export function useAtualizarUsuario() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: { nome?: string; email?: string; papelGlobal?: string; ativo?: boolean; senha?: string; capacidadeHorasSemanais?: number } }) =>
      api.patch<UsuarioAdmin>(`/usuarios/${id}`, data).then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: usuarioKeys.list() }),
  });
}

// ─── Pipeline ─────────────────────────────────────────────────────────────────

export const pipelineKeys = { list: () => ["admin-pipeline"] as const };

export function usePipeline() {
  return useQuery({
    queryKey: pipelineKeys.list(),
    queryFn:  () => api.get<EtapaDefinicaoAdmin[]>("/admin/pipeline").then((r) => r.data),
  });
}

export function useAtualizarEtapaDefinicao() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: { esforcoHoras?: number; nome?: string; ativo?: boolean } }) =>
      api.patch<EtapaDefinicaoAdmin>(`/admin/pipeline/${id}`, data).then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: pipelineKeys.list() }),
  });
}

export function useExcluirUsuario() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.delete(`/usuarios/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: usuarioKeys.list() }),
  });
}

// ─── Webhooks (RF-M7-07) ──────────────────────────────────────────────────────

export const webhookKeys = { list: () => ["admin-webhooks"] as const };

export function useWebhooks() {
  return useQuery({
    queryKey: webhookKeys.list(),
    queryFn:  () => api.get<WebhookItem[]>("/webhooks").then((r) => r.data),
  });
}

export function useCriarWebhook() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: CriarWebhookPayload) =>
      api.post<WebhookItem>("/webhooks", data).then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: webhookKeys.list() }),
  });
}

export function useAtualizarWebhook() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: AtualizarWebhookPayload }) =>
      api.patch<WebhookItem>(`/webhooks/${id}`, data).then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: webhookKeys.list() }),
  });
}

export function useExcluirWebhook() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.delete(`/webhooks/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: webhookKeys.list() }),
  });
}

export function useTestarWebhook() {
  return useMutation({
    mutationFn: (id: string) =>
      api.post<{ ok: boolean; evento: string; url: string }>(`/webhooks/${id}/test`).then((r) => r.data),
  });
}
