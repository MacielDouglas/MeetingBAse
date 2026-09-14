// Congregações, perfil e senha (extraído de lib/api.ts).
// Usado por Registro (lista/cria) e Perfil (atualiza).

import {
  API_URL,
  authHeaders,
  toErrorMessage,
} from "./common";

export interface CongregationInfo {
  id: string;
  nombre: string;
  numero: string | null;
  circuito: string | null;
  timezone: string;
}

export async function listCongregations(): Promise<CongregationInfo[]> {
  const res = await fetch(`${API_URL}/auth/congregations`);
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(toErrorMessage(body, "Error al cargar congregaciones"));
  return (body as { congregations: CongregationInfo[] }).congregations ?? [];
}

export async function createCongregation(data: {
  nombre: string;
  numero?: string;
  circuito?: string;
  timezone?: string;
}): Promise<CongregationInfo> {
  const res = await fetch(`${API_URL}/auth/congregations`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(toErrorMessage(body, "Error al crear congregación"));
  return (body as { congregation: CongregationInfo }).congregation;
}

export async function updateProfile(data: {
  nombre?: string;
  email?: string;
  password?: string;
}): Promise<{ id: string; nombre: string; email: string; rol: string }> {
  const res = await fetch(`${API_URL}/auth/profile`, {
    method: "PUT",
    headers: { "Content-Type": "application/json", ...authHeaders() },
    body: JSON.stringify(data),
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(toErrorMessage(body, "Error al actualizar perfil"));
  return (body as { user: { id: string; nombre: string; email: string; rol: string } }).user;
}

export async function resetPassword(email: string): Promise<{ message: string; tempPassword?: string }> {
  const res = await fetch(`${API_URL}/auth/reset-password`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email }),
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(toErrorMessage(body, "Error al restablecer contraseña"));
  return body as { message: string; tempPassword?: string };
}
