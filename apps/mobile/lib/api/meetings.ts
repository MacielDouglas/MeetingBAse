// Sync offline + designar/publicar (extraído de lib/api.ts).
// getSync alimenta o SQLite via dbSync; assign/publicar exigem online.

import {
  API_URL,
  authHeaders,
  getCongregationId,
  toErrorMessage,
} from "./common";
import type { SyncPrayer, SyncUnavailability } from "./ministry";

export interface SyncMeeting {
  id: string;
  congregation_id?: string;
  import_id?: string;
  fecha: string;
  tipo: string;
  semana_label?: string | null;
  estado: string;
  sala?: string;
  hora_inicio?: string | null;
  lectura_semanal?: string | null;
  titulo_atalaya?: string | null;
  cancion_inicial?: number | null;
  cancion_intermedia?: number | null;
  cancion_final?: number | null;
}

export interface SyncPart {
  id: string;
  meeting_id: string;
  orden: number;
  seccion?: string | null;
  tipo_clave?: string | null;
  titulo: string;
  sala?: string;
  requiere_ayudante?: boolean;
  needs_review?: boolean;
  duracion_min?: number | null;
  hora_inicio?: string | null;
}

export interface SyncAssignment {
  id: string;
  part_id: string;
  meeting_id: string;
  congregation_id?: string;
  titular_id: string;
  ayudante_id?: string | null;
  updated_at: string;
}

export interface SyncWarning {
  id: string;
  meeting_id: string;
  publisher_id: string;
  part_id?: string | null;
  tipo: string;
  mensaje_es: string;
  created_at: string;
}

export interface SyncCatalogEntry {
  number: number;
  title: string;
}

export interface SyncPayload {
  since: string | null;
  meetings: SyncMeeting[];
  parts: SyncPart[];
  assignments: SyncAssignment[];
  warnings: SyncWarning[];
  prayers?: SyncPrayer[];
  unavailability?: SyncUnavailability[];
  songs?: SyncCatalogEntry[];
  talks?: SyncCatalogEntry[];
  filtrado: boolean;
  persistencia?: "neon" | "memoria";
  all_meeting_ids?: string[];
}

export interface AssignWarning {
  tipo: string;
  mensaje_es: string;
}

export interface AssignResult {
  assignment: SyncAssignment;
  warnings: AssignWarning[];
  persistencia?: "neon" | "memoria";
}

export interface PublishResult {
  meeting_id: string;
  estado: string;
  persistencia?: "neon" | "memoria";
}

export async function getSync(
  congregationId = getCongregationId(),
  since?: string
): Promise<SyncPayload> {
  const qs = since ? `?since=${encodeURIComponent(since)}` : "";
  const res = await fetch(`${API_URL}/c/${congregationId}/sync${qs}`, {
    headers: authHeaders(),
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(toErrorMessage(body, "Error al sincronizar"));
  return body as SyncPayload;
}

export async function assignPart(
  congregationId: string,
  partId: string,
  input: { titular_id: string; ayudante_id?: string | null }
): Promise<AssignResult> {
  const res = await fetch(`${API_URL}/c/${congregationId}/parts/${partId}/assign`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...authHeaders() },
    body: JSON.stringify({
      titular_id: input.titular_id.trim(),
      ...(input.ayudante_id && input.ayudante_id.trim()
        ? { ayudante_id: input.ayudante_id.trim() }
        : {}),
    }),
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(toErrorMessage(body, "Error al asignar"));
  return body as AssignResult;
}

export async function publishMeeting(
  congregationId: string,
  meetingId: string
): Promise<PublishResult> {
  const res = await fetch(`${API_URL}/c/${congregationId}/meetings/${meetingId}/publish`, {
    method: "POST",
    headers: authHeaders(),
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(toErrorMessage(body, "Error al publicar"));
  return body as PublishResult;
}
