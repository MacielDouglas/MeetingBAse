import { randomUUID } from "node:crypto";
import { asc, eq, inArray } from "drizzle-orm";
import { getDb, isDbConfigured } from "../../../../packages/db/db.js";
import { imports, meetings, parts } from "../../../../packages/db/schema.js";
import type { ImportJob } from "./importStore.js";

// Fase 2A — persistencia Neon (imports -> meetings -> parts).
// Sala siempre "A", orden 1..13 (mwb) / 1..4 (w, ya viene del draft).
// Driver Neon HTTP: inserts secuenciales best-effort con limpieza
// parcial ante fallo (transaccion real queda para la 2B con pool).
// Sin DB (sin DATABASE_URL o fallo) devuelve { ok: false } y la ruta
// sigue en memoria con `persistencia: "memoria"`. Nunca lanza.

export interface MeetingDraftIn {
  id: string;
  congregation_id: string;
  import_id: string;
  fecha: string;
  tipo: string;
  lectura_semanal?: string | null;
  titulo_atalaya?: string | null;
  cancion_inicial?: number | null;
  cancion_intermedia?: number | null;
  cancion_final?: number | null;
  semana_label?: string | null;
  estado: string;
  parts: {
    orden: number;
    seccion: string;
    tipoClave: string;
    titulo: string;
    detalle?: string;
    duracionMin?: number;
    requiereAyudante: boolean;
    needsReview?: boolean;
    sala: "A";
  }[];
}

export interface ListedMeeting {
  id: string;
  congregation_id: string;
  import_id: string | null;
  fecha: string;
  tipo: string;
  semana_label: string | null;
  estado: string;
  sala: "A";
  parts_count: number;
  parts: {
    id: string;
    orden: number;
    seccion: string;
    tipo_clave: string;
    titulo: string;
    sala: "A";
    requiere_ayudante: boolean;
    needs_review: boolean;
  }[];
}

export type SaveResult = { ok: true } | { ok: false; error: string };
export type ListResult =
  | { ok: true; meetings: ListedMeeting[] }
  | { ok: false; error: string };

// Guarda confirmacion: 1 row imports + N meetings + M parts.
export async function saveConfirm(
  job: ImportJob,
  drafts: MeetingDraftIn[]
): Promise<SaveResult> {
  if (!isDbConfigured()) return { ok: false, error: "sin DATABASE_URL" };
  const db = getDb();
  if (!db) return { ok: false, error: "db no disponible" };
  const done: string[] = [];
  try {
    await db.insert(imports).values({
      id: job.id,
      congregationId: job.congregationId,
      filename: job.filename,
      kind: job.kind,
      estado: "confirmado",
      weeksCount: job.weeks.length,
    });
    for (const m of drafts) {
      await db.insert(meetings).values({
        id: m.id,
        congregationId: m.congregation_id,
        importId: m.import_id,
        fecha: m.fecha,
        tipo: m.tipo,
        lecturaSemanal: m.lectura_semanal ?? null,
        tituloAtalaya: m.titulo_atalaya ?? null,
        cancionInicial: m.cancion_inicial ?? null,
        cancionIntermedia: m.cancion_intermedia ?? null,
        cancionFinal: m.cancion_final ?? null,
        semanaLabel: m.semana_label ?? null,
        estado: "draft",
      });
      done.push(m.id);
      for (const p of m.parts) {
        await db.insert(parts).values({
          id: randomUUID(),
          meetingId: m.id,
          congregationId: m.congregation_id,
          orden: p.orden,
          seccion: p.seccion,
          tipoClave: p.tipoClave,
          titulo: p.titulo,
          detalle: p.detalle ?? null,
          duracionMin: p.duracionMin ?? null,
          sala: "A",
          requiereAyudante: p.requiereAyudante,
          needsReview: p.needsReview ?? false,
        });
      }
    }
    return { ok: true };
  } catch (e) {
    // Limpieza parcial best-effort (sin transaccion en driver HTTP).
    try {
      if (done.length > 0) {
        await db.delete(parts).where(inArray(parts.meetingId, done));
        await db.delete(meetings).where(inArray(meetings.id, done));
      }
    } catch {
      // ignora fallo de limpieza
    }
    return { ok: false, error: e instanceof Error ? e.message : "error Neon" };
  }
}

// Lista meetings + parts por congregacion, ordenado por fecha.
// Filtro app-level obligatorio (RLS aun comentado en SQL).
export async function listMeetings(
  congregationId: string
): Promise<ListResult> {
  if (!isDbConfigured()) return { ok: false, error: "sin DATABASE_URL" };
  const db = getDb();
  if (!db) return { ok: false, error: "db no disponible" };
  try {
    const rows = await db
      .select()
      .from(meetings)
      .where(eq(meetings.congregationId, congregationId))
      .orderBy(asc(meetings.fecha));
    const out: ListedMeeting[] = [];
    for (const m of rows) {
      const ps = await db
        .select()
        .from(parts)
        .where(eq(parts.meetingId, m.id))
        .orderBy(asc(parts.orden));
      out.push({
        id: m.id,
        congregation_id: m.congregationId,
        import_id: m.importId,
        fecha: m.fecha,
        tipo: m.tipo,
        semana_label: m.semanaLabel,
        estado: m.estado,
        sala: "A",
        parts_count: ps.length,
        parts: ps.map((p) => ({
          id: p.id,
          orden: p.orden,
          seccion: p.seccion,
          tipo_clave: p.tipoClave,
          titulo: p.titulo,
          sala: "A",
          requiere_ayudante: p.requiereAyudante,
          needs_review: p.needsReview,
        })),
      });
    }
    return { ok: true, meetings: out };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "error Neon" };
  }
}
