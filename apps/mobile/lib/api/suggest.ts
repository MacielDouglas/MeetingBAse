// Sugestão inteligente + histórico (extraído de lib/api.ts).
// Usado pelo botão Sugerir no Asignar.

import {
  API_URL,
  authHeaders,
  toErrorMessage,
} from "./common";

export interface SuggestCandidate {
  id: string;
  nombre: string;
  motivo: string;
}

export async function suggestCandidates(
  congregationId: string,
  partId: string
): Promise<SuggestCandidate[]> {
  const res = await fetch(`${API_URL}/c/${congregationId}/parts/${partId}/suggest`, {
    method: "POST",
    headers: authHeaders(),
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(toErrorMessage(body, "Error al sugerir"));
  return ((body as { candidates?: SuggestCandidate[] }).candidates ?? []) as SuggestCandidate[];
}

export interface PublisherHistory {
  total: number;
  as_titular: number;
  as_ayudante: number;
  by_tipo: { tipo_clave: string; count: number }[];
  last_fecha: string | null;
}

export async function getPublisherHistory(
  congregationId: string,
  publisherId: string
): Promise<PublisherHistory> {
  const res = await fetch(`${API_URL}/c/${congregationId}/publishers/${publisherId}/history`, {
    headers: authHeaders(),
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(toErrorMessage(body, "Error al cargar historial"));
  return (body as { history: PublisherHistory }).history;
}

export async function suggestHelpers(
  congregationId: string,
  partId: string,
  titularId: string
): Promise<SuggestCandidate[]> {
  const res = await fetch(`${API_URL}/c/${congregationId}/parts/${partId}/suggest-helpers`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...authHeaders() },
    body: JSON.stringify({ titular_id: titularId }),
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(toErrorMessage(body, "Error al sugerir ayudantes"));
  return ((body as { candidates?: SuggestCandidate[] }).candidates ?? []) as SuggestCandidate[];
}
