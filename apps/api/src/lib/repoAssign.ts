import { randomUUID } from "node:crypto";
import { and, asc, eq } from "drizzle-orm";
import { getDb, isDbConfigured } from "../../../../packages/db/db.js";
import {
  assignments,
  meetings,
  parts,
  publishers,
  warnings,
} from "../../../../packages/db/schema.js";
import { listMeetings, type ListedMeeting } from "./repoNeon.js";
import { listPrayers, type Prayer } from "./prayersStore.js";
import { listUnavailability, type Unavailability } from "./unavailabilityStore.js";

// Fase 2B — operações Neon para assign/publish/sync.
// Filtro app-level obrigatório (RLS ainda comentado).
// Nunca lança: retorna null e a rota cai para memória.

export interface NeonPartHit {
  part: {
    id: string;
    meetingId: string;
    congregationId: string;
    tipoClave: string;
    requiereAyudante: boolean;
    needsReview: boolean;
  };
  meetingEstado: string;
  meetingFecha: string;
}

export interface NeonPublisher {
  id: string;
  sexo: string;
  cargo: string;
  congregationId: string;
}

export interface AssignRow {
  id: string;
  part_id: string;
  meeting_id: string;
  congregation_id: string;
  titular_id: string;
  ayudante_id: string | null;
  updated_at: string;
}

export interface WarningRow {
  id: string;
  meeting_id: string;
  publisher_id: string;
  part_id: string | null;
  tipo: string;
  mensaje_es: string;
  created_at: string;
}

function iso(v: unknown): string {
  try {
    const d = v instanceof Date ? v : new Date(String(v));
    if (!Number.isNaN(d.getTime())) return d.toISOString();
  } catch {
    // cai para string abaixo
  }
  return typeof v === "string" ? v : new Date().toISOString();
}

// Parte + reunião existem e são da congregação? (404 se não)
export async function findNeonPart(
  congregationId: string,
  partId: string
): Promise<NeonPartHit | null> {
  if (!isDbConfigured()) return null;
  try {
    const db = getDb();
    if (!db) return null;
    const ps = await db.select().from(parts).where(eq(parts.id, partId));
    const p = ps[0];
    if (!p || p.congregationId !== congregationId) return null;
    const ms = await db.select().from(meetings).where(eq(meetings.id, p.meetingId));
    const m = ms[0];
    if (!m || m.congregationId !== congregationId) return null;
    return {
      part: {
        id: p.id,
        meetingId: p.meetingId,
        congregationId: p.congregationId,
        tipoClave: p.tipoClave,
        requiereAyudante: p.requiereAyudante,
        needsReview: p.needsReview,
      },
      meetingEstado: m.estado,
      meetingFecha: m.fecha,
    };
  } catch {
    return null;
  }
}

export async function getNeonPublisher(
  id: string
): Promise<NeonPublisher | null> {
  if (!isDbConfigured()) return null;
  try {
    const db = getDb();
    if (!db) return null;
    const rows = await db.select().from(publishers).where(eq(publishers.id, id));
    const r = rows[0];
    if (!r) return null;
    return { id: r.id, sexo: r.sexo, cargo: r.cargo, congregationId: r.congregationId };
  } catch {
    return null;
  }
}

export async function titularAssignedNeon(
  meetingId: string,
  titularId: string,
  excludePartId: string
): Promise<boolean> {
  try {
    const db = getDb();
    if (!db) return false;
    const rows = await db
      .select()
      .from(assignments)
      .where(
        and(
          eq(assignments.meetingId, meetingId),
          eq(assignments.titularId, titularId)
        )
      );
    return rows.some((r) => r.partId !== excludePartId);
  } catch {
    return false;
  }
}

// Assignment atual da parte (para limpar o titular anterior).
export async function getNeonAssignment(
  partId: string
): Promise<{ titular_id: string } | null> {
  try {
    const db = getDb();
    if (!db) return null;
    const rows = await db
      .select()
      .from(assignments)
      .where(eq(assignments.partId, partId));
    const a = rows[0];
    return a ? { titular_id: a.titularId } : null;
  } catch {
    return null;
  }
}

export async function deleteNeonWarnings(
  meetingId: string,
  publisherId: string,
  partId?: string
): Promise<void> {
  try {
    const db = getDb();
    if (!db) return;
    if (partId) {
      await db
        .delete(warnings)
        .where(
          and(
            eq(warnings.meetingId, meetingId),
            eq(warnings.publisherId, publisherId),
            eq(warnings.partId, partId)
          )
        );
    } else {
      await db
        .delete(warnings)
        .where(
          and(
            eq(warnings.meetingId, meetingId),
            eq(warnings.publisherId, publisherId)
          )
        );
    }
  } catch {
    // best-effort
  }
}

// Upsert por part_id (unique) + 1 row por warning em
// assignment_warnings. Driver HTTP: sequencial best-effort.
export async function saveNeonAssignment(input: {
  partId: string;
  meetingId: string;
  congregationId: string;
  titularId: string;
  ayudanteId: string | null;
  items: { tipo: string; mensajeEs: string }[];
}): Promise<{ assignment: AssignRow; warnings: WarningRow[] } | null> {
  try {
    const db = getDb();
    if (!db) return null;
    await db
      .insert(assignments)
      .values({
        id: randomUUID(),
        partId: input.partId,
        meetingId: input.meetingId,
        congregationId: input.congregationId,
        titularId: input.titularId,
        ayudanteId: input.ayudanteId,
      })
      .onConflictDoUpdate({
        target: assignments.partId,
        set: {
          meetingId: input.meetingId,
          congregationId: input.congregationId,
          titularId: input.titularId,
          ayudanteId: input.ayudanteId,
          updatedAt: new Date(),
        },
      });
    // Update meeting's updatedAt to trigger incremental sync
    await db
      .update(meetings)
      .set({ updatedAt: new Date() })
      .where(eq(meetings.id, input.meetingId));
    // Delete warnings for this publisher in this meeting AND this part
    await db
      .delete(warnings)
      .where(
        and(
          eq(warnings.meetingId, input.meetingId),
          eq(warnings.publisherId, input.titularId),
          eq(warnings.partId, input.partId)
        )
      );
    for (const w of input.items) {
      await db.insert(warnings).values({
        id: randomUUID(),
        meetingId: input.meetingId,
        publisherId: input.titularId,
        partId: input.partId,
        tipo: w.tipo,
        mensajeEs: w.mensajeEs,
      });
    }
    const aRows = await db
      .select()
      .from(assignments)
      .where(eq(assignments.partId, input.partId));
    const a = aRows[0];
    if (!a) return null;
    const wRows = await db
      .select()
      .from(warnings)
      .where(
        and(
          eq(warnings.meetingId, input.meetingId),
          eq(warnings.publisherId, input.titularId)
        )
      )
      .orderBy(asc(warnings.createdAt));
    return {
      assignment: {
        id: a.id,
        part_id: a.partId,
        meeting_id: a.meetingId,
        congregation_id: a.congregationId,
        titular_id: a.titularId,
        ayudante_id: a.ayudanteId,
        updated_at: iso(a.updatedAt),
      },
      warnings: wRows.map((w) => ({
        id: w.id,
        meeting_id: w.meetingId,
        publisher_id: w.publisherId,
        part_id: w.partId ?? null,
        tipo: w.tipo,
        mensaje_es: w.mensajeEs,
        created_at: iso(w.createdAt),
      })),
    };
  } catch {
    return null;
  }
}

export async function publishNeonMeeting(
  congregationId: string,
  mid: string
): Promise<"ok" | "not_found" | "already" | null> {
  if (!isDbConfigured()) return null;
  try {
    const db = getDb();
    if (!db) return null;
    const rows = await db.select().from(meetings).where(eq(meetings.id, mid));
    const m = rows[0];
    if (!m || m.congregationId !== congregationId) return "not_found";
    if (m.estado === "published") return "already";
    await db
      .update(meetings)
      .set({ estado: "published", updatedAt: new Date() })
      .where(eq(meetings.id, mid));
    return "ok";
  } catch {
    return null;
  }
}

export interface SyncData {
  meetings: ListedMeeting[];
  assignments: AssignRow[];
  warnings: WarningRow[];
  prayers: Prayer[];
  unavailability: Unavailability[];
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
    };
  } catch {
    return null;
  }
}

// Fetch assignments with publisher names for a meeting (for template generation).
export async function getAssignmentsWithNames(
  congregationId: string,
  meetingId: string
): Promise<{ part_id: string; titular_name: string; ayudante_name?: string }[]> {
  if (!isDbConfigured()) return [];
  try {
    const db = getDb();
    if (!db) return [];
    const aRows = await db
      .select()
      .from(assignments)
      .where(
        and(
          eq(assignments.congregationId, congregationId),
          eq(assignments.meetingId, meetingId),
        )
      );
    const result: { part_id: string; titular_name: string; ayudante_name?: string }[] = [];
    for (const a of aRows) {
      const titRows = await db.select().from(publishers).where(eq(publishers.id, a.titularId));
      const titName = titRows[0]?.nombre ?? "";
      let ayuName: string | undefined;
      if (a.ayudanteId) {
        const ayuRows = await db.select().from(publishers).where(eq(publishers.id, a.ayudanteId));
        ayuName = ayuRows[0]?.nombre;
      }
      result.push({
        part_id: a.partId,
        titular_name: titName,
        ayudante_name: ayuName,
      });
    }
    return result;
  } catch {
    return [];
  }
}
