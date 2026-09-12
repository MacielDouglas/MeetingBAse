// Hook usePrograma: offline-first con TanStack Query.
// Online: GET /sync -> guarda en SQLite -> lee de SQLite.
// Offline: lee directo de SQLite. Devuelve { meetings, offline, lastSync }.
// Funciona igual en iOS y Android (expo-sqlite + fetch).

import { useQuery, type UseQueryResult } from "@tanstack/react-query";
import {
  getCongregationId,
  getSync,
  isNetworkError,
} from "../lib/api";
import {
  getLastSince,
  initDb,
  loadPrograma,
  saveSyncPayload,
  type ProgramaMeeting,
} from "../lib/db";

export interface ProgramaData {
  meetings: ProgramaMeeting[];
  offline: boolean;
  lastSync: string | null;
}

async function fetchPrograma(): Promise<ProgramaData> {
  await initDb();
  const congId = getCongregationId();
  const since = await getLastSince(congId);
  try {
    const payload = await getSync(congId, since ?? undefined);
    const lastSync = await saveSyncPayload(congId, payload);
    const meetings = await loadPrograma(congId);
    return { meetings, offline: false, lastSync };
  } catch (e) {
    if (isNetworkError(e)) {
      const meetings = await loadPrograma(congId);
      const last = await getLastSince(congId);
      return { meetings, offline: true, lastSync: last };
    }
    throw e;
  }
}

export interface ProgramaHook extends Omit<UseQueryResult<ProgramaData, Error>, "data"> {
  meetings: ProgramaMeeting[];
  offline: boolean;
  lastSync: string | null;
  data: ProgramaData | undefined;
}

export function usePrograma(): ProgramaHook {
  const q = useQuery<ProgramaData, Error>({
    queryKey: ["programa", getCongregationId()],
    queryFn: fetchPrograma,
    retry: 1,
    staleTime: 30_000,
  });
  return {
    ...q,
    meetings: q.data?.meetings ?? [],
    offline: q.data?.offline ?? false,
    lastSync: q.data?.lastSync ?? null,
  };
}
