// Cliente HTTP mínimo para la API Meeting Base (iOS + Android).
// Sin dependencias nativas: solo fetch + FormData.

export const API_URL =
  process.env.EXPO_PUBLIC_API_URL ?? "http://localhost:3001";

// TODO Fase 2: congregation_id vendrá de auth/sesión. Fijo en Fase 1.
export const CONGREGATION_ID = "00000000-0000-0000-0000-000000000000";

export interface WeekSummary {
  index: number;
  fecha: string;
  tipo: string;
  semana: string;
  lectura: string;
  parts_count: number;
  needs_review: number;
}

export interface UploadPreview {
  job_id: string;
  kind: string;
  filename: string;
  weeks: WeekSummary[];
}

export interface DraftMeeting {
  id: string;
  fecha: string;
  tipo: string;
  semana_label: string;
  sala: string;
  parts: { orden: number; titulo: string; sala: string }[];
}

export interface ConfirmResult {
  job_id: string;
  estado: string;
  meetings: DraftMeeting[];
}

function toErrorMessage(body: unknown, fallback: string): string {
  if (body && typeof body === "object" && "error" in body) {
    const e = (body as { error?: unknown }).error;
    if (typeof e === "string" && e.length > 0) return e;
  }
  return fallback;
}

export async function uploadJwpub(
  fileUri: string,
  fileName: string,
  mimeType = "application/octet-stream"
): Promise<UploadPreview> {
  const form = new FormData();
  // @ts-expect-error RN FormData acepta { uri, name, type }
  form.append("file", { uri: fileUri, name: fileName, type: mimeType });
  const res = await fetch(`${API_URL}/c/${CONGREGATION_ID}/imports`, {
    method: "POST",
    body: form,
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(toErrorMessage(body, "Error al subir el archivo"));
  return body as UploadPreview;
}

export async function confirmImport(jobId: string, weeks?: number[]): Promise<ConfirmResult> {
  const res = await fetch(`${API_URL}/imports/${jobId}/confirm`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(weeks && weeks.length > 0 ? { weeks } : {}),
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(toErrorMessage(body, "Error al confirmar"));
  return body as ConfirmResult;
}

export interface MeetingPartItem {
  id: string;
  orden: number;
  titulo: string;
  sala: string;
}

export interface MeetingListItem {
  id: string;
  fecha: string;
  tipo: string;
  semana_label?: string | null;
  estado: string;
  sala: string;
  parts_count: number;
  parts: MeetingPartItem[];
}

export interface MeetingsResult {
  meetings: MeetingListItem[];
  persistencia?: "neon" | "memoria";
}

export async function getMeetings(congregationId = CONGREGATION_ID): Promise<MeetingsResult> {
  const res = await fetch(`${API_URL}/c/${congregationId}/meetings`);
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(toErrorMessage(body, "Error al cargar el programa"));
  return body as MeetingsResult;
}
export function isNetworkError(e: unknown): boolean {
  const msg = e instanceof Error ? e.message : String(e);
  return /network|fetch|conexi|connection|failed/i.test(msg);
}

// ---------- Fase 3: sync offline + asignar/publicar online ----------

export interface SyncMeeting {
  id: string;
  congregation_id?: string;
  import_id?: string;
  fecha: string;
  tipo: string;
  semana_label?: string | null;
  estado: string;
  sala?: string;
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
  tipo: string;
  mensaje_es: string;
  created_at: string;
}

export interface SyncPayload {
  since: string | null;
  meetings: SyncMeeting[];
  parts: SyncPart[];
  assignments: SyncAssignment[];
  warnings: SyncWarning[];
  filtrado: boolean;
  persistencia?: "neon" | "memoria";
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

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isUuid(v: string): boolean {
  return UUID_RE.test(v.trim());
}

export async function getSync(
  congregationId = CONGREGATION_ID,
  since?: string
): Promise<SyncPayload> {
  const qs = since ? `?since=${encodeURIComponent(since)}` : "";
  const res = await fetch(`${API_URL}/c/${congregationId}/sync${qs}`);
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
    headers: { "Content-Type": "application/json" },
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
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(toErrorMessage(body, "Error al publicar"));
  return body as PublishResult;
}
