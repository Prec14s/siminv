import axios from "axios";

export const API_URL = import.meta.env.VITE_API_URL || "http://localhost:5000";

const api = axios.create({ baseURL: `${API_URL}/api/v1` });

export const tokenStore = {
  get access() { return localStorage.getItem("siminv_access"); },
  get refresh() { return localStorage.getItem("siminv_refresh"); },
  set(access, refresh) {
    if (access) localStorage.setItem("siminv_access", access);
    if (refresh) localStorage.setItem("siminv_refresh", refresh);
  },
  clear() {
    localStorage.removeItem("siminv_access");
    localStorage.removeItem("siminv_refresh");
    localStorage.removeItem("siminv_user");
  },
};

api.interceptors.request.use((config) => {
  const token = tokenStore.access;
  if (token && !config.headers.Authorization) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// Refresh token otomatis saat access token kedaluwarsa (satu refresh untuk banyak request)
let refreshing = null;
api.interceptors.response.use(
  (res) => res,
  async (error) => {
    const original = error.config;
    const isAuthCall = original?.url?.includes("/auth/login") || original?.url?.includes("/auth/refresh")
      || original?.url?.includes("/auth/logout");
    if (error.response?.status === 401 && original && !original._retry && !isAuthCall && tokenStore.refresh) {
      original._retry = true;
      try {
        refreshing = refreshing || axios.post(`${API_URL}/api/v1/auth/refresh`, null, {
          headers: { Authorization: `Bearer ${tokenStore.refresh}` },
        });
        const { data } = await refreshing;
        tokenStore.set(data.data.access_token);
        original.headers.Authorization = `Bearer ${data.data.access_token}`;
        return api(original);
      } catch (e) {
        tokenStore.clear();
        window.dispatchEvent(new Event("siminv:logout"));
        return Promise.reject(error);
      } finally {
        refreshing = null;
      }
    }
    if (error.response?.status === 401 && !isAuthCall) {
      tokenStore.clear();
      window.dispatchEvent(new Event("siminv:logout"));
    }
    return Promise.reject(error);
  }
);

export function errorMessage(err, fallback = "Terjadi kesalahan. Coba lagi.") {
  if (!err.response) return "Tidak dapat terhubung ke server. Pastikan backend berjalan.";
  return err.response.data?.message || fallback;
}

export function fieldErrors(err) {
  return err.response?.data?.errors || {};
}

export async function download(url, params, fallbackName = "laporan") {
  const res = await api.get(url, { params, responseType: "blob" });
  const disp = res.headers["content-disposition"] || "";
  const match = disp.match(/filename="?([^"]+)"?/);
  const href = URL.createObjectURL(res.data);
  const a = document.createElement("a");
  a.href = href;
  a.download = match ? match[1] : fallbackName;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(href);
}

export const assetUrl = (path) => (path ? `${API_URL}${path}` : null);

export default api;
