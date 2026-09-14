// Base do cliente HTTP Meeting Base (iOS + Android).
// URL, sessão, headers e erros compartilhados pelos submódulos.

import { Platform } from "react-native";

// En Android Emulator, localhost es el propio emulador.
// 10.0.2.2 es el alias a la PC host. En iOS Simulator localhost sí
// llega a la PC. En dispositivo físico hay que definir
// EXPO_PUBLIC_API_URL con la IP LAN de la PC (ej. http://192.168.15.186:3001).
const DEFAULT_API_URL =
  Platform.OS === "android" ? "http://10.0.2.2:3001" : "http://localhost:3001";

export const API_URL = (
  process.env.EXPO_PUBLIC_API_URL ?? DEFAULT_API_URL
).replace(/\/+$/, "");

// Fase 5: getCongregationId() comes from auth session (set on login).
let _congregationId = "";
let _authToken = "";

export function setCongregationId(id: string) {
  _congregationId = id;
}

export function setAuthToken(token: string) {
  _authToken = token;
}

export function getCongregationId(): string {
  if (!_congregationId) throw new Error("No hay sesión activa. Inicie sesión primero.");
  return _congregationId;
}

export function authHeaders(): Record<string, string> {
  if (!_authToken) return {};
  return { Authorization: `Bearer ${_authToken}` };
}

export function toErrorMessage(body: unknown, fallback: string): string {
  if (body && typeof body === "object" && "error" in body) {
    const e = (body as { error?: unknown }).error;
    if (typeof e === "string" && e.length > 0) return e;
  }
  return fallback;
}

export function isNetworkError(e: unknown): boolean {
  const msg = e instanceof Error ? e.message : String(e);
  return /network|fetch|conexi|connection|failed/i.test(msg);
}
