import { randomUUID } from "node:crypto";
import { and, eq } from "drizzle-orm";
import { getDb, isDbConfigured } from "../../../../packages/db/db.js";
import { publishers as publishersTable } from "../../../../packages/db/schema.js";

// Fase 23 — publishers store simplificado (sem privilegios granulares).
// Neon first, in-memory fallback. Sexo: hombre/mujer.

export interface Publisher {
  id: string;
  congregationId: string;
  nombre: string;
  sexo: string;
  cargo: string;
  activo: boolean;
  telefono?: string;
  email?: string;
  userId?: string;
  familiaId?: string | null;
  createdAt: string;
}

// In-memory fallback
const memPublishers = new Map<string, Publisher[]>();

function rowToPublisher(r: Record<string, unknown>): Publisher {
  return {
    id: String(r.id),
    congregationId: String(r.congregationId),
    nombre: String(r.nombre),
    sexo: String(r.sexo),
    cargo: String(r.cargo),
    activo: Boolean(r.activo),
    telefono: r.telefono ? String(r.telefono) : undefined,
    email: r.email ? String(r.email) : undefined,
    userId: r.userId ? String(r.userId) : undefined,
    familiaId: r.familiaId ? String(r.familiaId) : null,
    createdAt: r.createdAt ? String(r.createdAt) : new Date().toISOString(),
  };
}

export async function listPublishers(congregationId: string): Promise<Publisher[]> {
  if (isDbConfigured()) {
    try {
      const db = getDb();
      if (db) {
        const rows = await db
          .select()
          .from(publishersTable)
          .where(and(
            eq(publishersTable.congregationId, congregationId),
            eq(publishersTable.activo, true),
          ));
        return rows.map(rowToPublisher);
      }
    } catch {
      // fallback to memory
    }
  }
  return (memPublishers.get(congregationId) ?? []).filter((p) => p.activo);
}

export async function getPublisher(congregationId: string, id: string): Promise<Publisher | undefined> {
  if (isDbConfigured()) {
    try {
      const db = getDb();
      if (db) {
        const rows = await db
          .select()
          .from(publishersTable)
          .where(and(
            eq(publishersTable.congregationId, congregationId),
            eq(publishersTable.id, id),
          ));
        return rows[0] ? rowToPublisher(rows[0]) : undefined;
      }
    } catch {
      // fallback to memory
    }
  }
  return (memPublishers.get(congregationId) ?? []).find((p) => p.id === id);
}

export async function createPublisher(
  congregationId: string,
  data: {
    nombre: string;
    sexo: string;
    cargo?: string;
    telefono?: string;
    email?: string;
    familiaId?: string | null;
  }
): Promise<Publisher> {
  const cargo = data.cargo ?? 'publicador';

  const pub: Publisher = {
    id: randomUUID(),
    congregationId,
    nombre: data.nombre,
    sexo: data.sexo,
    cargo,
    activo: true,
    telefono: data.telefono,
    email: data.email,
    familiaId: data.familiaId ?? null,
    createdAt: new Date().toISOString(),
  };

  if (isDbConfigured()) {
    try {
      const db = getDb();
      if (db) {
        await db.insert(publishersTable).values({
          id: pub.id,
          congregationId: pub.congregationId,
          nombre: pub.nombre,
          sexo: pub.sexo,
          cargo: pub.cargo,
          activo: pub.activo,
          telefono: pub.telefono ?? null,
          email: pub.email ?? null,
          familiaId: pub.familiaId ?? null,
        });
        return pub;
      }
    } catch {
      // fallback to memory
    }
  }

  const list = memPublishers.get(congregationId) ?? [];
  list.push(pub);
  memPublishers.set(congregationId, list);
  return pub;
}

export async function updatePublisher(
  congregationId: string,
  id: string,
  data: Partial<{
    nombre: string;
    sexo: string;
    cargo: string;
    telefono: string;
    email: string;
    activo: boolean;
    familiaId: string | null;
  }>
): Promise<Publisher | undefined> {
  if (isDbConfigured()) {
    try {
      const db = getDb();
      if (db) {
        const rows = await db
          .select()
          .from(publishersTable)
          .where(and(
            eq(publishersTable.congregationId, congregationId),
            eq(publishersTable.id, id),
          ));
        if (!rows[0]) return undefined;

        const sets: Record<string, unknown> = {};
        if (data.nombre !== undefined) sets.nombre = data.nombre;
        if (data.sexo !== undefined) sets.sexo = data.sexo;
        if (data.cargo !== undefined) sets.cargo = data.cargo;
        if (data.telefono !== undefined) sets.telefono = data.telefono;
        if (data.email !== undefined) sets.email = data.email;
        if (data.activo !== undefined) sets.activo = data.activo;
        if (data.familiaId !== undefined) sets.familiaId = data.familiaId;
        if (Object.keys(sets).length > 0) {
          await db.update(publishersTable).set(sets).where(eq(publishersTable.id, id));
        }
        const updated = await db.select().from(publishersTable).where(eq(publishersTable.id, id));
        return updated[0] ? rowToPublisher(updated[0]) : undefined;
      }
    } catch {
      // fallback to memory
    }
  }

  const list = memPublishers.get(congregationId) ?? [];
  const idx = list.findIndex((p) => p.id === id);
  if (idx < 0) return undefined;
  const pub = list[idx];
  if (data.nombre !== undefined) pub.nombre = data.nombre;
  if (data.sexo !== undefined) pub.sexo = data.sexo;
  if (data.cargo !== undefined) pub.cargo = data.cargo;
  if (data.telefono !== undefined) pub.telefono = data.telefono;
  if (data.email !== undefined) pub.email = data.email;
  if (data.activo !== undefined) pub.activo = data.activo;
  if (data.familiaId !== undefined) pub.familiaId = data.familiaId;
  list[idx] = pub;
  return pub;
}

export async function deletePublisher(congregationId: string, id: string): Promise<boolean> {
  if (isDbConfigured()) {
    try {
      const db = getDb();
      if (db) {
        await db.update(publishersTable).set({ activo: false }).where(eq(publishersTable.id, id));
        return true;
      }
    } catch {
      // fallback to memory
    }
  }

  const list = memPublishers.get(congregationId) ?? [];
  const idx = list.findIndex((p) => p.id === id);
  if (idx < 0) return false;
  list[idx].activo = false;
  return true;
}

// Seed dev publishers (só em memória — não insere no Neon)
export function seedPublishers(congregationId: string): void {
  if ((memPublishers.get(congregationId) ?? []).length > 0) return;
  const names = [
    { nombre: "Carlos Méndez", sexo: "M", cargo: "anciano" },
    { nombre: "Luis Rodríguez", sexo: "M", cargo: "siervo_ministerial" },
    { nombre: "María García", sexo: "F", cargo: "publicador" },
    { nombre: "Ana López", sexo: "F", cargo: "publicador" },
    { nombre: "Pedro Sánchez", sexo: "M", cargo: "publicador" },
  ];
  for (const n of names) {
    const pub: Publisher = {
      id: randomUUID(),
      congregationId,
      ...n,
      activo: true,
      createdAt: new Date().toISOString(),
    };
    const list = memPublishers.get(congregationId) ?? [];
    list.push(pub);
    memPublishers.set(congregationId, list);
  }
}
