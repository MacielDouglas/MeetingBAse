// Upload e confirmação de .jwpub (extraído de lib/api.ts).
// Subida via expo-file-system (multipart nativo, iOS + Android).

import { File, Paths, UploadType } from "expo-file-system";
import {
  API_URL,
  authHeaders,
  getCongregationId,
  toErrorMessage,
} from "./common";

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
