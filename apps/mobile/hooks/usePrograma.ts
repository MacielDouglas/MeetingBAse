// Hook usePrograma: offline-first con TanStack Query.
// Online: GET /sync -> guarda en SQLite -> lee de SQLite.
// Offline: lee directo de SQLite. Devuelve { meetings, offline, lastSync }.
// Funciona igual en iOS y Android (expo-sqlite + fetch).

import { useQuery, type UseQueryResult } from "@tanstack/react-query";
import {
  CONGREGATION_ID,
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
  const since = await getLastSince(CONGREGATION_ID);
  try {
    const payload = await getSync(CONGREGATION_ID, since ?? undefined);
    const lastSync = await saveSyncPayload(CONGREGATION_ID, payload);
    const meetings = await loadPrograma(CONGREGATION_ID);
    return { meetings, offline: false, lastSync };
  } catch (e) {
    if (isNetworkError(e)) {
      const meetings = await loadPrograma(CONGREGATION_ID);
      const last = await getLastSince(CONGREGATION_ID);
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
    queryKey: ["programa", CONGREGATION_ID],
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
