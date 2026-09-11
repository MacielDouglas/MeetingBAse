import { randomUUID } from "node:crypto";
import { and, asc, eq } from "drizzle-orm";
import { getDb, isDbConfigured } from "../../../../packages/db/db.js";
import { speakers as speakersTable, visits as visitsTable } from "../../../../packages/db/schema.js";

// Fase 5 — speakers + visits store. Neon first, in-memory fallback.

export interface Speaker {
  id: string;
  congregationId: string;
  nombre: string;
  telefono?: string;
  celular?: string;
  email?: string;
  talkNumbers: number[];
  activo: boolean;
  createdAt: string;
}

export interface Visit {
  id: string;
  congregationId: string;
  speakerId: string;
  fecha: string;
  talkNumber?: number;
  notas?: string;
  estado: string;
  createdAt: string;
}

// In-memory fallback
const memSpeakers = new Map<string, Speaker[]>();
const memVisits = new Map<string, Visit[]>();

function rowToSpeaker(r: Record<string, unknown>): Speaker {
  return {
    id: String(r.id),
    congregationId: String(r.congregationId),
    nombre: String(r.nombre),
    telefono: r.telefono ? String(r.telefono) : undefined,
    celular: r.celular ? String(r.celular) : undefined,
    email: r.email ? String(r.email) : undefined,
    talkNumbers: Array.isArray(r.talkNumbers) ? (r.talkNumbers as number[]) : [],
    activo: Boolean(r.activo),
    createdAt: r.createdAt ? String(r.createdAt) : new Date().toISOString(),
  };
}

function rowToVisit(r: Record<string, unknown>): Visit {
  return {
    id: String(r.id),
    congregationId: String(r.congregationId),
    speakerId: String(r.speakerId),
    fecha: String(r.fecha),
    talkNumber: r.talkNumber != null ? Number(r.talkNumber) : undefined,
    notas: r.notas ? String(r.notas) : undefined,
    estado: String(r.estado),
    createdAt: r.createdAt ? String(r.createdAt) : new Date().toISOString(),
  };
}

// --- Speakers ---

export async function listSpeakers(congregationId: string): Promise<Speaker[]> {
  if (isDbConfigured()) {
    try {
      const db = getDb();
      if (db) {
        const rows = await db
          .select()
          .from(speakersTable)
          .where(and(
            eq(speakersTable.congregationId, congregationId),
            eq(speakersTable.activo, true),
          ));
        return rows.map(rowToSpeaker);
      }
    } catch {
      // fallback
    }
  }
  return (memSpeakers.get(congregationId) ?? []).filter((s) => s.activo);
}

export async function getSpeaker(congregationId: string, id: string): Promise<Speaker | undefined> {
  if (isDbConfigured()) {
    try {
      const db = getDb();
      if (db) {
        const rows = await db
          .select()
          .from(speakersTable)
          .where(and(
            eq(speakersTable.congregationId, congregationId),
            eq(speakersTable.id, id),
          ));
        return rows[0] ? rowToSpeaker(rows[0]) : undefined;
      }
    } catch {
      // fallback
    }
  }
  return (memSpeakers.get(congregationId) ?? []).find((s) => s.id === id);
}

export async function createSpeaker(
  congregationId: string,
  data: { nombre: string; telefono?: string; celular?: string; email?: string; talkNumbers?: number[] }
): Promise<Speaker> {
  const speaker: Speaker = {
    id: randomUUID(),
    congregationId,
    nombre: data.nombre,
    telefono: data.telefono,
    celular: data.celular,
    email: data.email,
    talkNumbers: data.talkNumbers ?? [],
    activo: true,
    createdAt: new Date().toISOString(),
  };

  if (isDbConfigured()) {
    try {
      const db = getDb();
      if (db) {
        await db.insert(speakersTable).values({
          id: speaker.id,
          congregationId,
          nombre: speaker.nombre,
          telefono: speaker.telefono ?? null,
          celular: speaker.celular ?? null,
          email: speaker.email ?? null,
          talkNumbers: speaker.talkNumbers,
          activo: true,
        });
        return speaker;
      }
    } catch {
      // fallback
    }
  }

  const list = memSpeakers.get(congregationId) ?? [];
  list.push(speaker);
  memSpeakers.set(congregationId, list);
  return speaker;
}

export async function updateSpeaker(
  congregationId: string,
  id: string,
  data: Partial<{ nombre: string; telefono: string; celular: string; email: string; talkNumbers: number[]; activo: boolean }>
): Promise<Speaker | undefined> {
  if (isDbConfigured()) {
    try {
      const db = getDb();
      if (db) {
        const rows = await db
          .select()
          .from(speakersTable)
          .where(and(
            eq(speakersTable.congregationId, congregationId),
            eq(speakersTable.id, id),
          ));
        if (!rows[0]) return undefined;
        const sets: Record<string, unknown> = {};
        if (data.nombre !== undefined) sets.nombre = data.nombre;
        if (data.telefono !== undefined) sets.telefono = data.telefono;
        if (data.celular !== undefined) sets.celular = data.celular;
        if (data.email !== undefined) sets.email = data.email;
        if (data.talkNumbers !== undefined) sets.talkNumbers = data.talkNumbers;
        if (data.activo !== undefined) sets.activo = data.activo;
        if (Object.keys(sets).length > 0) {
          await db.update(speakersTable).set(sets).where(eq(speakersTable.id, id));
        }
        const updated = await db.select().from(speakersTable).where(eq(speakersTable.id, id));
        return updated[0] ? rowToSpeaker(updated[0]) : undefined;
      }
    } catch {
      // fallback
    }
  }

  const list = memSpeakers.get(congregationId) ?? [];
  const idx = list.findIndex((s) => s.id === id);
  if (idx < 0) return undefined;
  const s = list[idx];
  if (data.nombre !== undefined) s.nombre = data.nombre;
  if (data.telefono !== undefined) s.telefono = data.telefono;
  if (data.celular !== undefined) s.celular = data.celular;
  if (data.email !== undefined) s.email = data.email;
  if (data.talkNumbers !== undefined) s.talkNumbers = data.talkNumbers;
  if (data.activo !== undefined) s.activo = data.activo;
  list[idx] = s;
  return s;
}

export async function deleteSpeaker(congregationId: string, id: string): Promise<boolean> {
  if (isDbConfigured()) {
    try {
      const db = getDb();
      if (db) {
        await db.update(speakersTable).set({ activo: false }).where(eq(speakersTable.id, id));
        return true;
      }
    } catch {
      // fallback
    }
  }

  const list = memSpeakers.get(congregationId) ?? [];
  const idx = list.findIndex((s) => s.id === id);
  if (idx < 0) return false;
  list[idx].activo = false;
  return true;
}

// --- Visits ---

export async function listVisits(congregationId: string): Promise<Visit[]> {
  if (isDbConfigured()) {
    try {
      const db = getDb();
      if (db) {
        const rows = await db
          .select()
          .from(visitsTable)
          .where(eq(visitsTable.congregationId, congregationId))
          .orderBy(asc(visitsTable.fecha));
        return rows.map(rowToVisit);
      }
    } catch {
      // fallback
    }
  }
  return (memVisits.get(congregationId) ?? []).slice().sort((a, b) =>
    a.fecha < b.fecha ? -1 : a.fecha > b.fecha ? 1 : 0
  );
}

export async function createVisit(
  congregationId: string,
  data: { speakerId: string; fecha: string; talkNumber?: number; notas?: string }
): Promise<Visit> {
  const visit: Visit = {
    id: randomUUID(),
    congregationId,
    speakerId: data.speakerId,
    fecha: data.fecha,
    talkNumber: data.talkNumber,
    notas: data.notas,
    estado: "pendiente",
    createdAt: new Date().toISOString(),
  };

  if (isDbConfigured()) {
    try {
      const db = getDb();
      if (db) {
        await db.insert(visitsTable).values({
          id: visit.id,
          congregationId,
          speakerId: visit.speakerId,
          fecha: visit.fecha,
          talkNumber: visit.talkNumber ?? null,
          notas: visit.notas ?? null,
          estado: visit.estado,
        });
        return visit;
      }
    } catch {
      // fallback
    }
  }

  const list = memVisits.get(congregationId) ?? [];
  list.push(visit);
  memVisits.set(congregationId, list);
  return visit;
}

export async function deleteVisit(congregationId: string, id: string): Promise<boolean> {
  if (isDbConfigured()) {
    try {
      const db = getDb();
      if (db) {
        await db.delete(visitsTable).where(eq(visitsTable.id, id));
        return true;
      }
    } catch {
      // fallback
    }
  }

  const list = memVisits.get(congregationId) ?? [];
  const idx = list.findIndex((v) => v.id === id);
  if (idx < 0) return false;
  list.splice(idx, 1);
  return true;
}

export async function updateVisit(
  congregationId: string,
  id: string,
  data: Partial<{ estado: string; notas: string }>
): Promise<Visit | undefined> {
  if (isDbConfigured()) {
    try {
      const db = getDb();
      if (db) {
        const rows = await db
          .select()
          .from(visitsTable)
          .where(eq(visitsTable.id, id));
        if (!rows[0]) return undefined;
        const sets: Record<string, unknown> = {};
        if (data.estado !== undefined) sets.estado = data.estado;
        if (data.notas !== undefined) sets.notas = data.notas;
        if (Object.keys(sets).length > 0) {
          await db.update(visitsTable).set(sets).where(eq(visitsTable.id, id));
        }
        const updated = await db.select().from(visitsTable).where(eq(visitsTable.id, id));
        return updated[0] ? rowToVisit(updated[0]) : undefined;
      }
    } catch {
      // fallback
    }
  }

  const list = memVisits.get(congregationId) ?? [];
  const idx = list.findIndex((v) => v.id === id);
  if (idx < 0) return undefined;
  const v = list[idx];
  if (data.estado !== undefined) v.estado = data.estado;
  if (data.notas !== undefined) v.notas = data.notas;
  list[idx] = v;
  return v;
}

// Seed dev speakers (só em memória)
export function seedSpeakers(congregationId: string): void {
  if ((memSpeakers.get(congregationId) ?? []).length > 0) return;
  const names = [
    { nombre: "Roberto Díaz", telefono: "+56912345678", talkNumbers: [1, 5, 12, 30] },
    { nombre: "Fernando Vargas", telefono: "+56987654321", talkNumbers: [3, 8, 15] },
    { nombre: "Jorge Campos", celular: "+56911223344", talkNumbers: [2, 10, 25] },
  ];
  for (const n of names) {
    const speaker: Speaker = {
      id: randomUUID(),
      congregationId,
      nombre: n.nombre,
      telefono: n.telefono,
      celular: n.celular,
      talkNumbers: n.talkNumbers,
      activo: true,
      createdAt: new Date().toISOString(),
    };
    const list = memSpeakers.get(congregationId) ?? [];
    list.push(speaker);
    memSpeakers.set(congregationId, list);
  }
}
