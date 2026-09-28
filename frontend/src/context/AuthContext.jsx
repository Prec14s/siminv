import { createContext, useCallback, useContext, useEffect, useState } from "react";
import api, { tokenStore } from "../api/client";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => {
    try { return JSON.parse(localStorage.getItem("siminv_user")); } catch { return null; }
  });
  const [ready, setReady] = useState(false);

  const saveUser = useCallback((u) => {
    setUser(u);
    if (u) localStorage.setItem("siminv_user", JSON.stringify(u));
  }, []);

  useEffect(() => {
    // Validasi sesi saat aplikasi dibuka
    if (!tokenStore.access) { setReady(true); return; }
    api.get("/auth/me")
      .then(({ data }) => saveUser(data.data))
      .catch(() => { tokenStore.clear(); setUser(null); })
      .finally(() => setReady(true));
  }, [saveUser]);

  useEffect(() => {
    const onLogout = () => setUser(null);
    window.addEventListener("siminv:logout", onLogout);
    return () => window.removeEventListener("siminv:logout", onLogout);
  }, []);

  const login = async (username, password) => {
    const { data } = await api.post("/auth/login", { username, password });
    tokenStore.set(data.data.access_token, data.data.refresh_token);
    saveUser(data.data.user);
    return data.data.user;
  };

  const logout = async () => {
    const refresh = tokenStore.refresh;
    try { await api.post("/auth/logout"); } catch { /* token mungkin sudah kedaluwarsa */ }
    try {
      if (refresh) await api.post("/auth/logout", null, { headers: { Authorization: `Bearer ${refresh}` } });
    } catch { /* abaikan */ }
    tokenStore.clear();
    setUser(null);
  };

  const hasRole = (...roles) => !!user && roles.includes(user.role);

  return (
    <AuthContext.Provider value={{ user, ready, login, logout, hasRole, setUser: saveUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
