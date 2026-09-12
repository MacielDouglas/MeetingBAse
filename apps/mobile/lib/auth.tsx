import { createContext, useContext, useState, useEffect, type ReactNode } from "react";
import * as SecureStore from "expo-secure-store";
import { API_URL, setCongregationId } from "./api";

const TOKEN_KEY = "mb_auth_token";
const USER_KEY = "mb_auth_user";

export interface AuthUser {
  id: string;
  congregationId: string;
  email: string;
  nombre: string;
  rol: string;
}

interface AuthContextType {
  user: AuthUser | null;
  token: string | null;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  token: null,
  isLoading: true,
  login: async () => {},
  logout: async () => {},
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const savedToken = await SecureStore.getItemAsync(TOKEN_KEY);
        const savedUser = await SecureStore.getItemAsync(USER_KEY);
        if (savedToken && savedUser) {
          const user = JSON.parse(savedUser);
          setToken(savedToken);
          setUser(user);
          if (user.congregationId) setCongregationId(user.congregationId);
        }
      } catch {}
      setIsLoading(false);
    })();
  }, []);

  const login = async (email: string, password: string) => {
    const res = await fetch(`${API_URL}/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });
    const body = await res.json();
    if (!res.ok) throw new Error(body.error ?? "Error al iniciar sesión");
    await SecureStore.setItemAsync(TOKEN_KEY, body.token);
    await SecureStore.setItemAsync(USER_KEY, JSON.stringify(body.user));
    setToken(body.token);
    setUser(body.user);
    setCongregationId(body.user.congregationId);
  };

  const logout = async () => {
    await SecureStore.deleteItemAsync(TOKEN_KEY);
    await SecureStore.deleteItemAsync(USER_KEY);
    setToken(null);
    setUser(null);
    setCongregationId("");
  };

  return (
    <AuthContext.Provider value={{ user, token, isLoading, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}

// Helper: get auth headers
export function authHeaders(token: string | null): Record<string, string> {
  if (!token) return {};
  return { Authorization: `Bearer ${token}` };
}

// Helper: get congregation ID from auth (required — no fallback)
export function getCongregationId(user: AuthUser | null): string {
  if (!user?.congregationId) throw new Error("No hay sesión activa. Inicie sesión primero.");
  return user.congregationId;
}
