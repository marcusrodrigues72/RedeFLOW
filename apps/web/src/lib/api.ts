import axios from "axios";
import { useAuthStore } from "@/stores/auth.store";

export const api = axios.create({
  baseURL: "/api",
  headers: { "Content-Type": "application/json" },
  withCredentials: true,
});

// Injeta o accessToken em todas as requisições
api.interceptors.request.use((config) => {
  const token = useAuthStore.getState().accessToken;
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Tenta renovar o token quando recebe 401
let refreshPromise: Promise<string | null> | null = null;

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    if (
      error.response?.status === 401 &&
      !originalRequest._retry &&
      // Evita loop infinito nas rotas de auth
      !originalRequest.url?.includes("/auth/")
    ) {
      originalRequest._retry = true;

      // Evita múltiplas chamadas de refresh simultâneas
      if (!refreshPromise) {
        const { refreshToken, setTokens, logout } = useAuthStore.getState();

        if (!refreshToken) {
          logout();
          return Promise.reject(error);
        }

        refreshPromise = axios
          .post<{ accessToken: string; refreshToken: string }>(
            "/api/auth/refresh",
            { refreshToken }
          )
          .then((res) => {
            setTokens(res.data.accessToken, res.data.refreshToken);
            return res.data.accessToken;
          })
          .catch(() => {
            logout();
            return null;
          })
          .finally(() => {
            refreshPromise = null;
          });
      }

      const newToken = await refreshPromise;
      if (!newToken) return Promise.reject(error);

      originalRequest.headers.Authorization = `Bearer ${newToken}`;
      return api(originalRequest);
    }

    return Promise.reject(error);
  }
);
