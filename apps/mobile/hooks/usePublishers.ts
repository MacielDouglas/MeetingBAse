// Hook usePublishers: lista de publicadores da congregação.
// Online-first com fallback SQLite (Fase 20): após GET ok, salva no
// publishers_cache; se a API falhar, devolve o cache (pickers do
// Asignar e nomes no Programa funcionam offline).
// Compartilhado por Programa, Asignar e Ausencias.
// Mesma queryKey ["publishers", congId] = cache compartilhado.

import { useQuery } from "@tanstack/react-query";
import { API_URL, authHeaders } from "../lib/api";
import { initDb, loadPublishersCache, savePublishersCache } from "../lib/db";

export interface PublisherRef {
  id: string;
  nombre: string;
  sexo: string;
  cargo: string;
}

export function usePublishers(congId: string | null) {
  return useQuery<PublisherRef[], Error>({
    queryKey: ["publishers", congId],
    queryFn: async () => {
      try {
        const res = await fetch(`${API_URL}/c/${congId}/publishers`, {
          headers: authHeaders(),
        });
        const body = await res.json().catch(() => ({}));
        if (!res.ok)
          throw new Error((body as { error?: string }).error ?? "Error al cargar publicadores");
        const pubs = ((body as { publishers?: PublisherRef[] }).publishers ?? []) as PublisherRef[];
        try {
          await initDb();
          await savePublishersCache(congId as string, pubs);
        } catch {
          // cache best-effort
        }
        return pubs;
      } catch (e) {
        try {
          await initDb();
          const cached = await loadPublishersCache(congId as string);
          if (cached.length > 0) return cached;
        } catch {
          // sem SQLite: propaga o erro original
        }
        throw e;
      }
    },
    enabled: !!congId,
    retry: 1,
    staleTime: 30_000,
  });
}

// Monta resolvedor id -> nombre (offline: cai para os 8 primeiros do UUID).
export function makePubNameResolver(publishers: PublisherRef[]) {
  const byId = new Map(publishers.map((p) => [p.id, p.nombre]));
  return (id: string | null): string => {
    if (!id) return "";
    return byId.get(id) ?? id.slice(0, 8);
  };
}
