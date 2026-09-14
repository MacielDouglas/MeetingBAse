// Cliente HTTP mínimo para la API Meeting Base (iOS + Android).
// JSON via fetch; subida de archivos via expo-file-system (multipart nativo).

import { File, Paths, UploadType } from "expo-file-system";
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

const UPLOAD_TIMEOUT_MS = 120_000;

function uploadSignal(): AbortSignal | undefined {
  try {
    const AnyAbort = AbortSignal as unknown as {
      timeout?: (ms: number) => AbortSignal;
    };
    if (typeof AnyAbort.timeout === "function") return AnyAbort.timeout(UPLOAD_TIMEOUT_MS);
  } catch {}
  return undefined;
}

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

function authHeaders(): Record<string, string> {
  if (!_authToken) return {};
  return { Authorization: `Bearer ${_authToken}` };
}

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
  replaced?: boolean;
  uploaded_files?: UploadedFileInfo[];
  weeks: WeekSummary[];
}

export interface UploadedFileInfo {
  filename: string;
  kind: string;
  uploaded_at: string;
}

export interface UploadedFilesResult {
  files: (UploadedFileInfo & { job_id: string })[];
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
  persistencia?: "neon" | "memoria";
  meetings: DraftMeeting[];
}

function toErrorMessage(body: unknown, fallback: string): string {
  if (body && typeof body === "object" && "error" in body) {
    const e = (body as { error?: unknown }).error;
    if (typeof e === "string" && e.length > 0) return e;
  }
  return fallback;
}

function parseUploadBody(result: { body: string; status: number }): UploadPreview {
  let body: unknown = {};
  try {
    body = result.body ? JSON.parse(result.body) : {};
  } catch {
    body = {};
  }
  if (result.status < 200 || result.status >= 300) {
    throw new Error(toErrorMessage(body, "Error al subir el archivo"));
  }
  return body as UploadPreview;
}

export async function uploadJwpubFile(
  picked: File,
  mimeType = "application/octet-stream",
  congregationId: string
): Promise<UploadPreview> {
  // Subida directa del File devuelto por el picker nativo (iOS + Android).
  // Sin copia intermedia: evita "isn't readable" / "Missing READ permission"
  // de DocumentPicker en Android (Expo Go). El filename multipart usa
  // picked.name, que preserva mwb_*.jwpub para detección en el servidor.
  const result = await picked.upload(
    `${API_URL}/c/${congregationId}/imports`,
    {
      httpMethod: "POST",
      uploadType: UploadType.MULTIPART,
      fieldName: "file",
      mimeType,
      headers: authHeaders(),
      signal: uploadSignal(),
    }
  );
  return parseUploadBody(result);
}

export async function uploadJwpub(
  fileUri: string,
  fileName: string,
  mimeType = "application/octet-stream"
): Promise<UploadPreview> {
  // Fallback DocumentPicker (iOS + Android). Intenta subida directa primero;
  // solo copia a caché con el nombre original si hace falta (el servidor
  // usa el filename para detectar mwb_/w_).
  const safeName =
    fileName.split(/[\\/]/).pop()?.replace(/[^A-Za-z0-9._-]+/g, "_") ||
    "archivo.jwpub";
  const src = new File(fileUri);
  try {
    const direct = await src.upload(
      `${API_URL}/c/${getCongregationId()}/imports`,
      {
        httpMethod: "POST",
        uploadType: UploadType.MULTIPART,
        fieldName: "file",
        mimeType,
        headers: authHeaders(),
        signal: uploadSignal(),
      }
    );
    // Si el nombre del cache (uuid) no preserva mwb_, el servidor puede
    // rechazar; en ese caso seguimos al flujo con copia renombrada.
    if (direct.status >= 200 && direct.status < 300) {
      try {
        return parseUploadBody(direct);
      } catch {}
    }
  } catch {}
  const dest = new File(Paths.cache, `mb-upload-${Date.now()}-${safeName}`);
  await src.copy(dest);
  try {
    const result = await dest.upload(
      `${API_URL}/c/${getCongregationId()}/imports`,
      {
        httpMethod: "POST",
        uploadType: UploadType.MULTIPART,
        fieldName: "file",
        mimeType,
        headers: authHeaders(),
        signal: uploadSignal(),
      }
    );
    return parseUploadBody(result);
  } finally {
    try {
      if (dest.exists) dest.delete();
    } catch {}
  }
}

export async function confirmImport(jobId: string, weeks?: number[]): Promise<ConfirmResult> {
  const res = await fetch(`${API_URL}/imports/${jobId}/confirm`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...authHeaders() },
    body: JSON.stringify(weeks && weeks.length > 0 ? { weeks } : {}),
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(toErrorMessage(body, "Error al confirmar"));
  return body as ConfirmResult;
}

export async function getUploadedFiles(
  congregationId = getCongregationId()
): Promise<UploadedFilesResult> {
  const res = await fetch(`${API_URL}/c/${congregationId}/imports/files`, {
    headers: authHeaders(),
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(toErrorMessage(body, "Error al cargar archivos"));
  return body as UploadedFilesResult;
}

export async function mergeImports(
  jobIds: string[],
  congregationId = getCongregationId()
): Promise<UploadPreview> {
  const res = await fetch(`${API_URL}/c/${congregationId}/imports/merge`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...authHeaders() },
    body: JSON.stringify({ job_ids: jobIds }),
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(toErrorMessage(body, "Error al fusionar importaciones"));
  return body as UploadPreview;
}

export async function deleteImport(
  jobId: string,
  congregationId = getCongregationId()
): Promise<{ ok: boolean; uploaded_files: { filename: string; kind: string }[] }> {
  const res = await fetch(`${API_URL}/c/${congregationId}/imports/${jobId}`, {
    method: "DELETE",
    headers: authHeaders(),
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(toErrorMessage(body, "Error al eliminar"));
  return body as { ok: boolean; uploaded_files: { filename: string; kind: string }[] };
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

export async function getMeetings(congregationId = getCongregationId()): Promise<MeetingsResult> {
  const res = await fetch(`${API_URL}/c/${congregationId}/meetings`, {
    headers: authHeaders(),
  });
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

export interface SyncPrayer {
  id: string;
  meeting_id: string;
  congregation_id?: string;
  tipo: "inicial" | "final";
  publisher_id: string | null;
}

export interface SyncPayload {
  since: string | null;
  meetings: SyncMeeting[];
  parts: SyncPart[];
  assignments: SyncAssignment[];
  warnings: SyncWarning[];
  prayers?: SyncPrayer[];
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

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isUuid(v: string): boolean {
  return UUID_RE.test(v.trim());
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

// ---------- Congregations ----------

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
