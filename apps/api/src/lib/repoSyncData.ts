import { eq } from "drizzle-orm";
import { getDb, isDbConfigured } from "../../../../packages/db/db.js";
import { assignments, warnings } from "../../../../packages/db/schema.js";
import { listMeetings, type ListedMeeting } from "./repoNeon.js";
import { listPrayers, type Prayer } from "./prayersStore.js";
import { listUnavailability, type Unavailability } from "./unavailabilityStore.js";
import {
  getSongCatalog,
  getTalkCatalog,
  loadCatalogsFromDb,
  type SongCatalogEntry,
  type TalkCatalogEntry,
} from "./importStore.js";
import { iso, type AssignRow, type WarningRow } from "./repoAssign.js";

// Dados brutos do sync Neon (extraído de repoAssign — limite 400 linhas).
// Filtro de data aplicado no builder (syncFlow), igual para neon e
// memória — mesmo formato garantido. Nunca lança: retorna null e a
// rota cai para memória.

export interface SyncData {
  meetings: ListedMeeting[];
  assignments: AssignRow[];
  warnings: WarningRow[];
  prayers: Prayer[];
  unavailability: Unavailability[];
  songs: SongCatalogEntry[];
  talks: TalkCatalogEntry[];
}

// Dados brutos do sync (filtro de data aplicado no builder,
// igual para neon e memória — mesmo formato garantido).
export async function fetchNeonSyncData(
  congregationId: string
): Promise<SyncData | null> {
  if (!isDbConfigured()) return null;
  try {
    const db = getDb();
    if (!db) return null;
    const listed = await listMeetings(congregationId);
    if (!listed.ok) return null;
    const aRows = await db
      .select()
      .from(assignments)
      .where(eq(assignments.congregationId, congregationId));
    const meetingIds = new Set(listed.meetings.map((m) => m.id));
    const wAll = await db.select().from(warnings);
    const wRows = wAll.filter((w) => meetingIds.has(w.meetingId));
    const prayers = await listPrayers(congregationId);
    const unavailability = await listUnavailability(congregationId);
    // Catálogos sjj/S-34: recarrega do Neon (memória zera no restart).
    try {
      await loadCatalogsFromDb(congregationId);
    } catch {
      // best-effort
    }
    return {
      meetings: listed.meetings,
      assignments: aRows.map((a) => ({
        id: a.id,
        part_id: a.partId,
        meeting_id: a.meetingId,
        congregation_id: a.congregationId,
        titular_id: a.titularId,
        ayudante_id: a.ayudanteId,
        updated_at: iso(a.updatedAt),
      })),
      warnings: wRows.map((w) => ({
        id: w.id,
        meeting_id: w.meetingId,
        publisher_id: w.publisherId,
        part_id: w.partId ?? null,
        tipo: w.tipo,
        mensaje_es: w.mensajeEs,
        created_at: iso(w.createdAt),
      })),
      prayers,
      unavailability,
      songs: getSongCatalog(congregationId),
      talks: getTalkCatalog(congregationId),
    };
  } catch {
    return null;
  }
}
