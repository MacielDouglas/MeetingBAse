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

export function isNetworkError(e: unknown): boolean {
  const msg = e instanceof Error ? e.message : String(e);
  return /network|fetch|conexi|connection|failed/i.test(msg);
}
