import { randomUUID } from "node:crypto";
import { and, eq } from "drizzle-orm";
import { getDb, isDbConfigured } from "../../../../packages/db/db.js";
import { unavailability as unavTable } from "../../../../packages/db/schema.js";

// Fase 11 — indisponibilidade de publicadores. Neon first, in-memory fallback.

export interface Unavailability {
  id: string;
  congregation_id: string;
  publisher_id: string;
  fecha_inicio: string;
  fecha_fin: string;
  motivo: string | null;
}

const memUnav = new Map<string, Unavailability[]>(); // key: congregationId

function rowToUnav(r: Record<string, unknown>): Unavailability {
  return {
    id: String(r.id),
    congregation_id: String(r.congregationId),
    publisher_id: String(r.publisherId),
    fecha_inicio: String(r.fechaInicio),
    fecha_fin: String(r.fechaFin),
    motivo: r.motivo ? String(r.motivo) : null,
  };
}

export async function listUnavailability(
  congregationId: string,
  opts?: { publisherId?: string; fecha?: string }
): Promise<Unavailability[]> {
  const match = (u: Unavailability) =>
    (!opts?.publisherId || u.publisher_id === opts.publisherId) &&
    (!opts?.fecha || (u.fecha_inicio <= opts.fecha && opts.fecha <= u.fecha_fin));
  if (isDbConfigured()) {
    try {
      const db = getDb();
      if (db) {
        const rows = await db
          .select()
          .from(unavTable)
          .where(eq(unavTable.congregationId, congregationId));
        return rows.map((r) => rowToUnav(r as unknown as Record<string, unknown>)).filter(match);
      }
    } catch {
      // fallback to memory
    }
  }
  return (memUnav.get(congregationId) ?? []).filter(match);
}

export async function createUnavailability(input: {
  congregationId: string;
  publisherId: string;
  fechaInicio: string;
  fechaFin: string;
  motivo?: string | null;
}): Promise<Unavailability> {
  const row: Unavailability = {
    id: randomUUID(),
    congregation_id: input.congregationId,
    publisher_id: input.publisherId,
    fecha_inicio: input.fechaInicio,
    fecha_fin: input.fechaFin,
    motivo: input.motivo ?? null,
  };
  if (isDbConfigured()) {
    try {
      const db = getDb();
      if (db) {
        await db.insert(unavTable).values({
          id: row.id,
          congregationId: row.congregation_id,
          publisherId: row.publisher_id,
          fechaInicio: row.fecha_inicio,
          fechaFin: row.fecha_fin,
          motivo: row.motivo,
        });
        return row;
      }
    } catch {
      // fallback to memory
    }
  }
  const list = memUnav.get(input.congregationId) ?? [];
  list.push(row);
  memUnav.set(input.congregationId, list);
  return row;
}

export async function deleteUnavailability(congregationId: string, id: string): Promise<boolean> {
  if (isDbConfigured()) {
    try {
      const db = getDb();
      if (db) {
        await db.delete(unavTable).where(eq(unavTable.id, id));
        return true;
      }
    } catch {
      // fallback to memory
    }
  }
  const list = memUnav.get(congregationId) ?? [];
  const idx = list.findIndex((u) => u.id === id);
  if (idx < 0) return false;
  list.splice(idx, 1);
  return true;
}

// Publicadores indisponíveis numa data (para filtrar pickers e elegibilidade).
export async function unavailablePublisherIds(
  congregationId: string,
  fecha: string
): Promise<Set<string>> {
  const rows = await listUnavailability(congregationId, { fecha });
  return new Set(rows.map((r) => r.publisher_id));
}
