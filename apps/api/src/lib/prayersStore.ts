import { randomUUID } from "node:crypto";
import { and, eq } from "drizzle-orm";
import { getDb, isDbConfigured } from "../../../../packages/db/db.js";
import { prayers as prayersTable } from "../../../../packages/db/schema.js";

// Fase 10 — orações (inicial/final) por reunião. Neon first, in-memory fallback.

export interface Prayer {
  id: string;
  meeting_id: string;
  congregation_id: string;
  tipo: "inicial" | "final";
  publisher_id: string | null;
}

const memPrayers = new Map<string, Prayer[]>(); // key: meetingId

function rowToPrayer(r: Record<string, unknown>): Prayer {
  return {
    id: String(r.id),
    meeting_id: String(r.meetingId),
    congregation_id: String(r.congregationId),
    tipo: r.tipo === "final" ? "final" : "inicial",
    publisher_id: r.publisherId ? String(r.publisherId) : null,
  };
}

export async function listPrayers(congregationId: string, meetingId?: string): Promise<Prayer[]> {
  if (isDbConfigured()) {
    try {
      const db = getDb();
      if (db) {
        const cond = meetingId
          ? and(
              eq(prayersTable.congregationId, congregationId),
              eq(prayersTable.meetingId, meetingId)
            )
          : eq(prayersTable.congregationId, congregationId);
        const rows = await db.select().from(prayersTable).where(cond);
        return rows.map(rowToPrayer);
      }
    } catch {
      // fallback to memory
    }
  }
  const all = memPrayers.get(meetingId ?? "") ?? [];
  if (meetingId) return all.filter((p) => p.congregation_id === congregationId);
  const out: Prayer[] = [];
  for (const list of memPrayers.values()) {
    for (const p of list) {
      if (p.congregation_id === congregationId && (!meetingId || p.meeting_id === meetingId)) {
        out.push(p);
      }
    }
  }
  return out;
}

export async function upsertPrayer(
  congregationId: string,
  meetingId: string,
  tipo: "inicial" | "final",
  publisherId: string | null
): Promise<Prayer> {
  if (isDbConfigured()) {
    try {
      const db = getDb();
      if (db) {
        await db
          .insert(prayersTable)
          .values({
            id: randomUUID(),
            meetingId,
            congregationId,
            tipo,
            publisherId,
          })
          .onConflictDoUpdate({
            target: [prayersTable.meetingId, prayersTable.tipo],
            set: { congregationId, publisherId },
          });
        const rows = await db
          .select()
          .from(prayersTable)
          .where(
            and(
              eq(prayersTable.meetingId, meetingId),
              eq(prayersTable.tipo, tipo)
            )
          );
        if (rows[0]) return rowToPrayer(rows[0] as unknown as Record<string, unknown>);
      }
    } catch {
      // fallback to memory
    }
  }
  const list = memPrayers.get(meetingId) ?? [];
  const idx = list.findIndex((p) => p.tipo === tipo);
  const row: Prayer = {
    id: idx >= 0 ? list[idx].id : randomUUID(),
    meeting_id: meetingId,
    congregation_id: congregationId,
    tipo,
    publisher_id: publisherId,
  };
  if (idx >= 0) list[idx] = row;
  else list.push(row);
  memPrayers.set(meetingId, list);
  return row;
}
