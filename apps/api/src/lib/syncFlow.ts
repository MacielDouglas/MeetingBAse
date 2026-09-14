import { isDbConfigured } from "../../../../packages/db/db.js";
import {
  listMemAssignments,
  listMemDetailed,
  listMemWarnings,
} from "./assignStore.js";
import {
  type AssignRow,
  type WarningRow,
} from "./repoAssign.js";
import { fetchNeonSyncData, type SyncData } from "./repoSyncData.js";
import type { ListedMeeting } from "./repoNeon.js";
import { listPrayers, type Prayer } from "./prayersStore.js";
import { listUnavailability, type Unavailability } from "./unavailabilityStore.js";
import { getSongCatalog, getTalkCatalog } from "./importStore.js";

// Sync real para leitura offline (extraído de assignFlow — limite 400 linhas).
// Neon primeiro (se há DATABASE_URL), memória depois.

function sinceTime(raw: string | null): number | null {
  if (!raw) return null;
  const t = Date.parse(raw);
  return Number.isNaN(t) ? null : t;
}

export function buildSyncPayload(
  meetings: ListedMeeting[],
  assignments: AssignRow[],
  warnings: WarningRow[],
  sinceRaw: string | null,
  persistencia: "neon" | "memoria",
  prayers: Prayer[] = [],
  unavailability: Unavailability[] = []
) {
  const t = sinceTime(sinceRaw);

  // Filter meetings by updatedAt (incremental sync)
  const keepM =
    t === null
      ? meetings
      : meetings.filter((m) => {
          const mt = Date.parse(m.updated_at);
          return Number.isNaN(mt) || mt >= t;
        });
  const meetingIds = new Set(keepM.map((m) => m.id));

  const keepA =
    t === null
      ? assignments
      : assignments.filter((a) => {
          const at = Date.parse(a.updated_at);
          return Number.isNaN(at) || at >= t;
        });
  const keepW =
    t === null
      ? warnings
      : warnings.filter((w) => {
          const wt = Date.parse(w.created_at);
          return Number.isNaN(wt) || wt >= t;
        });

  return {
    since: sinceRaw,
    meetings: keepM.map((m) => ({
      id: m.id,
      congregation_id: m.congregation_id,
      import_id: m.import_id,
      fecha: m.fecha,
      tipo: m.tipo,
      semana_label: m.semana_label,
      estado: m.estado,
      sala: m.sala,
      updated_at: m.updated_at,
      hora_inicio: m.hora_inicio ?? null,
      lectura_semanal: m.lectura_semanal ?? null,
      titulo_atalaya: m.titulo_atalaya ?? null,
      cancion_inicial: m.cancion_inicial ?? null,
      cancion_intermedia: m.cancion_intermedia ?? null,
      cancion_final: m.cancion_final ?? null,
    })),
    parts: keepM.flatMap((m) =>
      m.parts.map((p) => ({
        id: p.id,
        meeting_id: m.id,
        orden: p.orden,
        seccion: p.seccion,
        tipo_clave: p.tipo_clave,
        titulo: p.titulo,
        sala: p.sala,
        requiere_ayudante: p.requiere_ayudante,
        needs_review: p.needs_review,
        duracion_min: p.duracion_min ?? null,
        hora_inicio: p.hora_inicio ?? null,
      }))
    ),
    assignments: keepA.filter((a) => meetingIds.has(a.meeting_id)),
    warnings: keepW
      .filter((w) => meetingIds.has(w.meeting_id))
      .map((w) => ({ ...w, part_id: w.part_id ?? null })),
    filtrado: t !== null,
    persistencia,
    prayers: prayers.filter((pr) => meetingIds.has(pr.meeting_id)),
    unavailability,
    // Todos os IDs atuais (sem filtro de data): o app apaga do SQLite
    // local as reuniões que não estão mais no servidor (ex. IDs antigos
    // de uma confirmação anterior — o sync incremental nunca apagava).
    all_meeting_ids: meetings.map((m) => m.id),
  };
}

async function memSyncData(congId: string): Promise<SyncData> {
  return {
    meetings: listMemDetailed(congId),
    assignments: listMemAssignments(congId),
    warnings: listMemWarnings(congId),
    prayers: await listPrayers(congId),
    unavailability: await listUnavailability(congId),
    songs: getSongCatalog(congId),
    talks: getTalkCatalog(congId),
  };
}

export async function syncCongregation(congId: string, sinceRaw: string | null) {
  if (isDbConfigured()) {
    try {
      const d = await fetchNeonSyncData(congId);
      if (d && d.meetings.length > 0)
        return {
          ...buildSyncPayload(d.meetings, d.assignments, d.warnings, sinceRaw, "neon", d.prayers, d.unavailability),
          songs: d.songs,
          talks: d.talks,
        };
    } catch {
      // cai para memória
    }
  }
  const d = await memSyncData(congId);
  return {
    ...buildSyncPayload(d.meetings, d.assignments, d.warnings, sinceRaw, "memoria", d.prayers, d.unavailability),
    songs: d.songs,
    talks: d.talks,
  };
}
