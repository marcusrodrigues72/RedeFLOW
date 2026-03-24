import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import type { UsuarioAdmin } from "shared";

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
    mutationFn: ({ id, data }: { id: string; data: { nome?: string; email?: string; papelGlobal?: string; ativo?: boolean } }) =>
      api.patch<UsuarioAdmin>(`/usuarios/${id}`, data).then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: usuarioKeys.list() }),
  });
}

export function useExcluirUsuario() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.delete(`/usuarios/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: usuarioKeys.list() }),
  });
}
