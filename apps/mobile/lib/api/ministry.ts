// Orações e ausências (extraído de lib/api.ts).
// Usado por Asignar (pickers) e Ausencias (CRUD).

import {
  API_URL,
  authHeaders,
  toErrorMessage,
} from "./common";

export interface SyncPrayer {
  id: string;
  meeting_id: string;
  congregation_id?: string;
  tipo: "inicial" | "final";
  publisher_id: string | null;
}

export interface SyncUnavailability {
  id: string;
  congregation_id?: string;
  publisher_id: string;
  fecha_inicio: string;
  fecha_fin: string;
  motivo?: string | null;
}

export async function getPrayers(congregationId: string, meetingId: string): Promise<SyncPrayer[]> {
  const res = await fetch(`${API_URL}/c/${congregationId}/meetings/${meetingId}/prayers`, {
    headers: authHeaders(),
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(toErrorMessage(body, "Error al cargar oraciones"));
  return ((body as { prayers?: SyncPrayer[] }).prayers ?? []) as SyncPrayer[];
}

export async function savePrayer(
  congregationId: string,
  meetingId: string,
  input: { tipo: "inicial" | "final"; publisher_id: string | null }
): Promise<SyncPrayer> {
  const res = await fetch(`${API_URL}/c/${congregationId}/meetings/${meetingId}/prayers`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...authHeaders() },
    body: JSON.stringify(input),
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(toErrorMessage(body, "Error al guardar oración"));
  return (body as { prayer: SyncPrayer }).prayer;
}

export async function getUnavailability(
  congregationId: string,
  opts?: { publisher_id?: string; fecha?: string }
): Promise<SyncUnavailability[]> {
  const qs = new URLSearchParams();
  if (opts?.publisher_id) qs.set("publisher_id", opts.publisher_id);
  if (opts?.fecha) qs.set("fecha", opts.fecha);
  const q = qs.toString() ? `?${qs.toString()}` : "";
  const res = await fetch(`${API_URL}/c/${congregationId}/unavailability${q}`, {
    headers: authHeaders(),
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(toErrorMessage(body, "Error al cargar ausencias"));
  return ((body as { unavailability?: SyncUnavailability[] }).unavailability ?? []) as SyncUnavailability[];
}

export async function createUnavailability(
  congregationId: string,
  input: { publisher_id: string; fecha_inicio: string; fecha_fin: string; motivo?: string | null }
): Promise<SyncUnavailability> {
  const res = await fetch(`${API_URL}/c/${congregationId}/unavailability`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...authHeaders() },
    body: JSON.stringify(input),
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(toErrorMessage(body, "Error al guardar ausencia"));
  return (body as { unavailability: SyncUnavailability }).unavailability;
}

export async function deleteUnavailability(congregationId: string, id: string): Promise<void> {
  const res = await fetch(`${API_URL}/c/${congregationId}/unavailability/${id}`, {
    method: "DELETE",
    headers: authHeaders(),
  });
  if (!res.ok) throw new Error(toErrorMessage(await res.json().catch(() => ({})), "Error al eliminar"));
}
