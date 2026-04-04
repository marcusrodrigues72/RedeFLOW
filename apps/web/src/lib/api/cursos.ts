import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import type { CursoResumo, CursoDetalhe, DashboardStats, ImportPreview, ImportResult, MIPreview, MIResult, OADetalhe, EtapaOADetalhe, ComentarioOA, DashboardDetalheTipo, DashboardDetalheOA, DashboardDetalheAtraso, AtribuicaoPreview, AtribuicaoResult, AuditLogEntry, UsuarioPublico } from "shared";
import { useAuthStore } from "@/stores/auth.store";

// ─── Keys ─────────────────────────────────────────────────────────────────────
export const cursoKeys = {
  all:    () => ["cursos"] as const,
  list:   () => [...cursoKeys.all(), "list"] as const,
  detail: (id: string) => [...cursoKeys.all(), "detail", id] as const,
  oas:    (id: string) => [...cursoKeys.all(), "oas", id] as const,
  stats:  () => ["dashboard", "stats"] as const,
};

export const oaKeys = {
  all:         () => ["oas"] as const,
  detail:      (id: string) => [...oaKeys.all(), "detail", id] as const,
  meuTrabalho: () => ["meu-trabalho"] as const,
};

// ─── Queries ──────────────────────────────────────────────────────────────────

export function useDashboardStats() {
  return useQuery({
    queryKey: cursoKeys.stats(),
    queryFn:  () => api.get<DashboardStats>("/dashboard/stats").then((r) => r.data),
  });
}

export function useDashboardDetalhe(tipo: DashboardDetalheTipo | null) {
  return useQuery<(DashboardDetalheAtraso | DashboardDetalheOA)[]>({
    queryKey: ["dashboard", "detalhe", tipo],
    queryFn:  () => tipo === "atrasos"
      ? api.get<DashboardDetalheAtraso[]>(`/dashboard/detalhe?tipo=${tipo}`).then((r) => r.data)
      : api.get<DashboardDetalheOA[]>(`/dashboard/detalhe?tipo=${tipo}`).then((r) => r.data),
    enabled:  !!tipo,
  });
}

export function useCursos() {
  return useQuery({
    queryKey: cursoKeys.list(),
    queryFn:  () => api.get<CursoResumo[]>("/cursos").then((r) => r.data),
  });
}

export function useCurso(id: string) {
  return useQuery({
    queryKey:  cursoKeys.detail(id),
    queryFn:   () => api.get<CursoDetalhe>(`/cursos/${id}`).then((r) => r.data),
    enabled:   !!id,
    staleTime: 60_000,
  });
}

// ─── Mutations ────────────────────────────────────────────────────────────────

export function useCriarCurso() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: { codigo: string; nome: string; descricao?: string }) =>
      api.post<CursoResumo>("/cursos", data).then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: cursoKeys.list() }),
  });
}

export function useAtualizarCurso(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: { nome?: string; descricao?: string; status?: string }) =>
      api.patch<CursoResumo>(`/cursos/${id}`, data).then((r) => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: cursoKeys.detail(id) });
      qc.invalidateQueries({ queryKey: cursoKeys.list() });
    },
  });
}

export function useExcluirCurso() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.delete(`/cursos/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: cursoKeys.list() });
      qc.invalidateQueries({ queryKey: cursoKeys.stats() });
    },
  });
}

export function useImportarPreview(cursoId: string) {
  return useMutation({
    mutationFn: (file: File) => {
      const fd = new FormData();
      fd.append("arquivo", file);
      return api.post<ImportPreview>(`/cursos/${cursoId}/importar/preview`, fd, {
        headers: { "Content-Type": "multipart/form-data" },
      }).then((r) => r.data);
    },
  });
}

// ─── OAs ──────────────────────────────────────────────────────────────────────

export function useOAsByCurso(cursoId: string, filters: { status?: string; tipo?: string } = {}) {
  const params = new URLSearchParams();
  if (filters.status) params.set("status", filters.status);
  if (filters.tipo)   params.set("tipo",   filters.tipo);
  return useQuery({
    queryKey:  [...cursoKeys.oas(cursoId), filters],
    queryFn:   () => api.get<OADetalhe[]>(`/cursos/${cursoId}/oas?${params}`).then((r) => r.data),
    enabled:   !!cursoId,
    staleTime: 30_000,   // não refaz o fetch se os dados têm menos de 30s
  });
}

export function useOA(id: string) {
  return useQuery({
    queryKey: oaKeys.detail(id),
    queryFn:  () => api.get<OADetalhe>(`/oas/${id}`).then((r) => r.data),
    enabled:  !!id,
  });
}

export function useMeuTrabalho() {
  return useQuery({
    queryKey: oaKeys.meuTrabalho(),
    queryFn:  () => api.get<OADetalhe[]>("/oas/meu-trabalho").then((r) => r.data),
  });
}

export function useAtualizarEtapa(oaId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ etapaId, data }: { etapaId: string; data: Partial<EtapaOADetalhe> & { deadlineReal?: string | null; deadlinePrevisto?: string | null; recalcularSequencia?: boolean; responsavelSecundarioId?: string | null } }) =>
      api.patch<EtapaOADetalhe>(`/oas/${oaId}/etapas/${etapaId}`, data).then((r) => r.data),

    onMutate: async ({ etapaId, data }) => {
      await qc.cancelQueries({ queryKey: oaKeys.detail(oaId) });
      const snapshot = qc.getQueryData<OADetalhe>(oaKeys.detail(oaId));
      const { recalcularSequencia: _rc, ...etapaFields } = data as AtualizarEtapaPayload;
      qc.setQueryData<OADetalhe>(oaKeys.detail(oaId), (oa) =>
        oa ? { ...oa, etapas: oa.etapas.map((e) => e.id !== etapaId ? e : { ...e, ...etapaFields }) } : oa
      );
      return { snapshot };
    },

    onError: (_err, _vars, context) => {
      if (context?.snapshot) qc.setQueryData(oaKeys.detail(oaId), context.snapshot);
    },

    onSuccess: (etapaAtualizada, vars) => {
      if (vars.data.recalcularSequencia) {
        qc.invalidateQueries({ queryKey: oaKeys.detail(oaId) });
      } else {
        qc.setQueryData<OADetalhe>(oaKeys.detail(oaId), (oa) =>
          oa ? { ...oa, etapas: oa.etapas.map((e) => e.id === etapaAtualizada.id ? { ...e, ...etapaAtualizada } : e) } : oa
        );
      }
    },

    onSettled: () => {
      qc.invalidateQueries({ queryKey: oaKeys.meuTrabalho() });
      qc.invalidateQueries({ queryKey: cursoKeys.stats() });
    },
  });
}

export function useAtualizarOA(oaId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: { linkObjeto?: string | null }) =>
      api.patch<{ id: string; linkObjeto: string | null }>(`/oas/${oaId}`, data).then((r) => r.data),

    onMutate: async (data) => {
      const [snapshots, cancels] = patchOACache(qc, oaId, (oa) => ({ ...oa, ...data }));
      await Promise.all(cancels);
      return { snapshots };
    },

    onError: (_err, _vars, context) => {
      for (const [key, d] of context?.snapshots ?? []) {
        qc.setQueryData(key, d);
      }
    },

    onSuccess: (updated) => {
      patchOACache(qc, updated.id, (oa) => ({ ...oa, linkObjeto: updated.linkObjeto }));
      qc.invalidateQueries({ queryKey: oaKeys.detail(oaId) });
    },
  });
}

export function useImportarMIPreview(cursoId: string) {
  return useMutation({
    mutationFn: (file: File) => {
      const fd = new FormData();
      fd.append("arquivo", file);
      return api.post<MIPreview>(`/cursos/${cursoId}/importar-mi/preview`, fd, {
        headers: { "Content-Type": "multipart/form-data" },
      }).then((r) => r.data);
    },
  });
}

export function useImportarMIConfirmar(cursoId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (file: File) => {
      const fd = new FormData();
      fd.append("arquivo", file);
      return api.post<MIResult>(`/cursos/${cursoId}/importar-mi/confirmar`, fd, {
        headers: { "Content-Type": "multipart/form-data" },
      }).then((r) => r.data);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: cursoKeys.list() });
    },
  });
}

/** Preview de MI sem precisar de curso pré-existente */
export function useImportarMINovoPreview() {
  return useMutation({
    mutationFn: (file: File) => {
      const fd = new FormData();
      fd.append("arquivo", file);
      return api.post<MIPreview>("/cursos/novo-via-mi/preview", fd, {
        headers: { "Content-Type": "multipart/form-data" },
      }).then((r) => r.data);
    },
  });
}

/** Cria o curso e importa a MI em uma única operação */
export function useImportarMINovoCurso() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ file, codigo, nome, descricao, dataInicio }: { file: File; codigo: string; nome: string; descricao?: string; dataInicio?: string }) => {
      const fd = new FormData();
      fd.append("arquivo", file);
      fd.append("codigo",  codigo);
      fd.append("nome",    nome);
      if (descricao)   fd.append("descricao",   descricao);
      if (dataInicio)  fd.append("dataInicio",  dataInicio);
      return api.post<MIResult>("/cursos/novo-via-mi/confirmar", fd, {
        headers: { "Content-Type": "multipart/form-data" },
      }).then((r) => r.data);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: cursoKeys.list() });
      qc.invalidateQueries({ queryKey: cursoKeys.stats() });
    },
  });
}

// Hook geral para atualizar qualquer etapa (sem precisar do cursoId no hook)
type AtualizarEtapaPayload = Partial<EtapaOADetalhe> & {
  deadlineReal?: string | null;
  responsavelSecundarioId?: string | null;
  recalcularSequencia?: boolean;
  templateGerado?: boolean;
  templateOrganizado?: boolean;
};

// Helpers para atualizar o cache de OAs cirurgicamente
function patchOACache(
  qc: ReturnType<typeof useQueryClient>,
  oaId: string,
  patchFn: (oa: OADetalhe) => OADetalhe,
): [ReturnType<typeof qc.getQueriesData<OADetalhe[]>>, Promise<void>[]] {
  const snapshots = qc.getQueriesData<OADetalhe[]>({ queryKey: ["cursos", "oas"] });
  const cancels: Promise<void>[] = [];
  for (const [key, oas] of snapshots) {
    if (!oas) continue;
    cancels.push(qc.cancelQueries({ queryKey: key as any }));
    qc.setQueryData<OADetalhe[]>(key, oas.map((oa) => oa.id !== oaId ? oa : patchFn(oa)));
  }
  return [snapshots, cancels];
}

export function useAtualizarEtapaGeral() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ oaId, etapaId, data }: { oaId: string; etapaId: string; data: AtualizarEtapaPayload }) =>
      api.patch<EtapaOADetalhe>(`/oas/${oaId}/etapas/${etapaId}`, data).then((r) => r.data),

    onMutate: async ({ oaId, etapaId, data }) => {
      const { recalcularSequencia: _rc, ...etapaFields } = data;
      const [snapshots, cancels] = patchOACache(qc, oaId, (oa) => ({
        ...oa,
        etapas: oa.etapas.map((e) => e.id !== etapaId ? e : { ...e, ...etapaFields }),
      }));
      await Promise.all(cancels);
      return { snapshots };
    },

    onError: (_err, _vars, context) => {
      for (const [key, data] of context?.snapshots ?? []) {
        qc.setQueryData(key, data);
      }
    },

    onSuccess: (etapaAtualizada, { oaId, data }) => {
      if (data.recalcularSequencia) {
        // Subsequentes tiveram deadlines recalculados no servidor — invalida todas as listas
        qc.invalidateQueries({ queryKey: ["cursos", "oas"] });
      } else {
        patchOACache(qc, oaId, (oa) => ({
          ...oa,
          etapas: oa.etapas.map((e) => e.id === etapaAtualizada.id ? { ...e, ...etapaAtualizada } : e),
        }));
      }
    },

    onSettled: () => {
      qc.invalidateQueries({ queryKey: oaKeys.meuTrabalho() });
      qc.invalidateQueries({ queryKey: cursoKeys.stats() });
    },
  });
}

// ─── Setup de Produção — Validação da matriz e Coordenador ────────────────────

export function useValidarMatriz(cursoId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () =>
      api.patch<{ id: string; matrizValidadaEm: string; matrizValidadaPorId: string; matrizValidadaPor: { id: string; nome: string } }>(
        `/cursos/${cursoId}/validar-matriz`
      ).then((r) => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: cursoKeys.detail(cursoId) });
      qc.invalidateQueries({ queryKey: cursoKeys.oas(cursoId) });
    },
  });
}

export function useDefinirCoordenadorProducao(cursoId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (coordenadorProducaoId: string | null) =>
      api.patch<{ id: string; coordenadorProducaoId: string | null; coordenadorProducao: { id: string; nome: string; fotoUrl: string | null } | null }>(
        `/cursos/${cursoId}/coordenador-producao`,
        { coordenadorProducaoId }
      ).then((r) => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: cursoKeys.detail(cursoId) });
      qc.invalidateQueries({ queryKey: cursoKeys.oas(cursoId) });
    },
  });
}

// Audit log de OA
export function useAuditLogOA(oaId: string) {
  return useQuery({
    queryKey: ["oas", oaId, "audit"],
    queryFn:  () => api.get<AuditLogEntry[]>(`/oas/${oaId}/audit`).then((r) => r.data),
    enabled:  !!oaId,
  });
}

// Comentários de OA
export const comentarioKeys = {
  list: (oaId: string) => ["oas", oaId, "comentarios"] as const,
};

export function useComentariosOA(oaId: string) {
  return useQuery({
    queryKey: comentarioKeys.list(oaId),
    queryFn:  () => api.get<ComentarioOA[]>(`/oas/${oaId}/comentarios`).then((r) => r.data),
    enabled:  !!oaId,
  });
}

export function useAdicionarComentario(oaId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: { texto: string; etapaOaId?: string }) =>
      api.post<ComentarioOA>(`/oas/${oaId}/comentarios`, data).then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: comentarioKeys.list(oaId) }),
  });
}

export function useExcluirComentario(oaId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (comentarioId: string) => api.delete(`/oas/${oaId}/comentarios/${comentarioId}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: comentarioKeys.list(oaId) }),
  });
}

// Membros do curso
export function useAdicionarMembro(cursoId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: { usuarioId: string; papel: string }) =>
      api.post(`/cursos/${cursoId}/membros`, data).then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: cursoKeys.detail(cursoId) }),
  });
}

export function useExportarMC(cursoId: string, codigoCurso: string) {
  return useMutation({
    mutationFn: async () => {
      const response = await api.get(`/cursos/${cursoId}/exportar-mc`, { responseType: "blob" });
      const url = URL.createObjectURL(response.data as Blob);
      const a   = document.createElement("a");
      a.href     = url;
      a.download = `MC_${codigoCurso}.xlsx`;
      a.click();
      URL.revokeObjectURL(url);
    },
  });
}

export function useAtribuicaoPreview(cursoId: string, params: { papelEtapa: string; sobrescrever: boolean; unidadesIds?: string[] } | null) {
  const query = params
    ? new URLSearchParams([
        ["papelEtapa",   params.papelEtapa],
        ["sobrescrever", String(params.sobrescrever)],
        ...(params.unidadesIds && params.unidadesIds.length > 0
          ? [["unidadesIds", params.unidadesIds.join(",")]]
          : []),
      ]).toString()
    : "";
  return useQuery({
    queryKey: ["cursos", cursoId, "atribuicao-preview", params],
    queryFn:  () => api.get<AtribuicaoPreview>(`/cursos/${cursoId}/atribuicao-preview?${query}`).then((r) => r.data),
    enabled:  !!cursoId && !!params?.papelEtapa,
  });
}

export function useAtribuirResponsaveis(cursoId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: { papelEtapa: string; responsavelId: string; sobrescrever: boolean; unidadesIds?: string[] }) =>
      api.post<AtribuicaoResult>(`/cursos/${cursoId}/atribuir-responsaveis`, data).then((r) => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["cursos", cursoId] });
      qc.invalidateQueries({ queryKey: cursoKeys.oas(cursoId) });
      qc.invalidateQueries({ queryKey: oaKeys.meuTrabalho() });
    },
  });
}

export function useRemoverMembro(cursoId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (usuarioId: string) => api.delete(`/cursos/${cursoId}/membros/${usuarioId}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: cursoKeys.detail(cursoId) }),
  });
}

export function useImportarConfirmar(cursoId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (file: File) => {
      const fd = new FormData();
      fd.append("arquivo", file);
      return api.post<ImportResult>(`/cursos/${cursoId}/importar/confirmar`, fd, {
        headers: { "Content-Type": "multipart/form-data" },
      }).then((r) => r.data);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: cursoKeys.list() });
      qc.invalidateQueries({ queryKey: cursoKeys.stats() });
    },
  });
}

// ─── Perfil do usuário ────────────────────────────────────────────────────────

export interface AtualizarPerfilPayload {
  nome?:            string;
  email?:           string;
  senhaAtual?:      string;
  novaSenha?:       string;
  notifEmailAtivo?: boolean;
}

export function useAtualizarPerfil() {
  const setUser = useAuthStore((s) => s.setUser);
  return useMutation({
    mutationFn: (data: AtualizarPerfilPayload) =>
      api.patch<UsuarioPublico>("/auth/me", data).then((r) => r.data),
    onSuccess: (updated) => setUser(updated),
  });
}
