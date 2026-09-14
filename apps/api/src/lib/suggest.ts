import { eq } from "drizzle-orm";
import { getDb, isDbConfigured } from "../../../../packages/db/db.js";
import { assignments, meetings, parts } from "../../../../packages/db/schema.js";
import { listMeetings } from "./repoNeon.js";
import { listConfirmedMeetings } from "./importStore.js";
import { listMemAssignments } from "./assignStore.js";
import { listPublishers } from "./publishersStore.js";
import { unavailablePublisherIds } from "./unavailabilityStore.js";
import { findMemPart } from "./assignStore.js";
import { findNeonPart } from "./repoAssign.js";

// Fase 13 — designação inteligente: histórico, repetição e sugestões.
// Neon primeiro, memória depois. Nunca lança (retorna vazio).

export interface HistoryEntry {
  total: number;
  as_titular: number;
  as_ayudante: number;
  by_tipo: { tipo_clave: string; count: number }[];
  last_fecha: string | null;
}

interface SimpleAssign {
  part_id: string;
  meeting_id: string;
  titular_id: string;
  ayudante_id: string | null;
}

async function allAssignments(congId: string): Promise<SimpleAssign[]> {
  if (isDbConfigured()) {
    try {
      const db = getDb();
      if (db) {
        const rows = await db
          .select()
          .from(assignments)
          .where(eq(assignments.congregationId, congId));
        return rows.map((a) => ({
          part_id: a.partId,
          meeting_id: a.meetingId,
          titular_id: a.titularId,
          ayudante_id: a.ayudanteId,
        }));
      }
    } catch {
      // cai para memória
    }
  }
  return listMemAssignments(congId).map((a) => ({
    part_id: a.part_id,
    meeting_id: a.meeting_id,
    titular_id: a.titular_id,
    ayudante_id: a.ayudante_id,
  }));
}

async function partTipo(congId: string, partId: string): Promise<string | null> {
  if (isDbConfigured()) {
    const hit = await findNeonPart(congId, partId);
    if (hit) return hit.part.tipoClave;
  }
  const mem = findMemPart(congId, partId);
  return mem ? mem.part.tipoClave : null;
}

export async function publisherHistory(congId: string, publisherId: string): Promise<HistoryEntry> {
  const all = await allAssignments(congId);
  const mine = all.filter((a) => a.titular_id === publisherId || a.ayudante_id === publisherId);
  const byTipo = new Map<string, number>();
  for (const a of mine) {
    const t = (await partTipo(congId, a.part_id)) ?? "desconocido";
    byTipo.set(t, (byTipo.get(t) ?? 0) + 1);
  }
  // Última data: busca nas reuniões.
  let lastFecha: string | null = null;
  const fechas = new Map<string, string>();
  if (isDbConfigured()) {
    const listed = await listMeetings(congId);
    if (listed.ok) {
      for (const m of listed.meetings) fechas.set(m.id, m.fecha);
    }
  } else {
    for (const m of listConfirmedMeetings(congId)) fechas.set(m.id, m.fecha);
  }
  for (const a of mine) {
    const f = fechas.get(a.meeting_id);
    if (f && (!lastFecha || f > lastFecha)) lastFecha = f;
  }
  return {
    total: mine.length,
    as_titular: mine.filter((a) => a.titular_id === publisherId).length,
    as_ayudante: mine.filter((a) => a.ayudante_id === publisherId).length,
    by_tipo: [...byTipo.entries()]
      .map(([tipo_clave, count]) => ({ tipo_clave, count }))
      .sort((a, b) => b.count - a.count),
    last_fecha: lastFecha,
  };
}

// Reunião anterior do mesmo tipo (por data) — para regra de repetição.
export async function prevMeetingSameTipo(
  congId: string,
  meetingId: string
): Promise<{ id: string; fecha: string; tipo: string } | null> {
  let list: { id: string; fecha: string; tipo: string }[] = [];
  if (isDbConfigured()) {
    const listed = await listMeetings(congId);
    if (listed.ok) list = listed.meetings.map((m) => ({ id: m.id, fecha: m.fecha, tipo: m.tipo }));
  } else {
    list = listConfirmedMeetings(congId).map((m) => ({ id: m.id, fecha: m.fecha, tipo: m.tipo }));
  }
  list.sort((a, b) => (a.fecha < b.fecha ? -1 : a.fecha > b.fecha ? 1 : 0));
  const idx = list.findIndex((m) => m.id === meetingId);
  if (idx <= 0) return null;
  const cur = list[idx];
  for (let i = idx - 1; i >= 0; i -= 1) {
    if (list[i].tipo === cur.tipo) return list[i];
  }
  return null;
}

// Titular teve a MESMA parte (tipoClave) na reunião anterior do mesmo tipo?
export async function titularRepeatedLastWeek(
  congId: string,
  meetingId: string,
  tipoClave: string,
  titularId: string
): Promise<boolean> {
  const prev = await prevMeetingSameTipo(congId, meetingId);
  if (!prev) return false;
  const all = await allAssignments(congId);
  for (const a of all) {
    if (a.meeting_id !== prev.id || a.titular_id !== titularId) continue;
    const t = await partTipo(congId, a.part_id);
    if (t === tipoClave) return true;
  }
  return false;
}

export interface Candidate {
  id: string;
  nombre: string;
  motivo: string;
}

const MALE_ONLY = new Set(["mwb_tgw_bread", "mwb_ayf_part1", "mwb_ayf_part2", "mwb_ayf_part3", "mwb_ayf_part4"]);
const isMaleSex = (sexo: string) => ["m", "hombre", "varon", "varón", "masculino"].includes(sexo.trim().toLowerCase());

// Candidatos ordenados: disponíveis, sem parte na semana, menos designações.
export async function suggestCandidates(congId: string, partId: string): Promise<Candidate[]> {
  let tipoClave: string | null = null;
  let meetingId: string | null = null;
  let meetingFecha = "";
  if (isDbConfigured()) {
    const hit = await findNeonPart(congId, partId);
    if (hit) {
      tipoClave = hit.part.tipoClave;
      meetingId = hit.part.meetingId;
    }
  }
  if (!tipoClave || !meetingId) {
    const mem = findMemPart(congId, partId);
    if (!mem) return [];
    tipoClave = mem.part.tipoClave;
    meetingId = mem.meetingId;
  }
  // Fecha da reunião.
  if (isDbConfigured()) {
    try {
      const db = getDb();
      if (db) {
        const rows = await db.select().from(meetings).where(eq(meetings.id, meetingId));
        if (rows[0]) meetingFecha = String(rows[0].fecha);
      }
    } catch {
      // ignora
    }
  }
  if (!meetingFecha) {
    meetingFecha = listConfirmedMeetings(congId).find((m) => m.id === meetingId)?.fecha ?? "";
  }

  const pubs = await listPublishers(congId);
  const unav = meetingFecha ? await unavailablePublisherIds(congId, meetingFecha) : new Set<string>();
  const all = await allAssignments(congId);
  const assignedThisWeek = new Set(
    all.filter((a) => a.meeting_id === meetingId).flatMap((a) => [a.titular_id, a.ayudante_id].filter(Boolean) as string[])
  );
  const totals = new Map<string, number>();
  for (const a of all) {
    totals.set(a.titular_id, (totals.get(a.titular_id) ?? 0) + 1);
    if (a.ayudante_id) totals.set(a.ayudante_id, (totals.get(a.ayudante_id) ?? 0) + 1);
  }

  const maleOnly = MALE_ONLY.has(tipoClave);
  const rows = pubs
    .filter((p) => p.activo)
    .filter((p) => !unav.has(p.id))
    .map((p) => {
      const busy = assignedThisWeek.has(p.id);
      const total = totals.get(p.id) ?? 0;
      const wrongSex = maleOnly && !isMaleSex(p.sexo);
      return {
        id: p.id,
        nombre: p.nombre,
        motivo: busy
          ? "Ya tiene parte esta semana"
          : total === 0
            ? "Disponible, sin designaciones"
            : `Disponible, ${total} designaciones`,
        rank: (wrongSex ? 1000 : 0) + (busy ? 100 : 0) + total,
      };
    })
    .sort((a, b) => a.rank - b.rank || a.nombre.localeCompare(b.nombre));
  return rows.map(({ id, nombre, motivo }) => ({ id, nombre, motivo }));
}
