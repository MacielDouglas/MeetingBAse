// Hook usePublishers: lista de publicadores da congregação (online).
// Compartilhado por Programa (resolver nomes de titular/ayudante),
// Asignar (pickers) e Publicadores usa query própria com CRUD.
// Mesma queryKey ["publishers", congId] = cache compartilhado.

import { useQuery } from "@tanstack/react-query";
import { API_URL } from "../lib/api";
import { authHeaders } from "../lib/auth";

export interface PublisherRef {
  id: string;
  nombre: string;
  sexo: string;
  cargo: string;
}

export function usePublishers(congId: string | null, token: string | null) {
  return useQuery<PublisherRef[], Error>({
    queryKey: ["publishers", congId],
    queryFn: async () => {
      const res = await fetch(`${API_URL}/c/${congId}/publishers`, {
        headers: authHeaders(token),
      });
      const body = await res.json().catch(() => ({}));
      return (body.publishers ?? []) as PublisherRef[];
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
