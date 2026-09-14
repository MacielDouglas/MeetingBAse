// SQLite local solo lectura (offline). iOS + Android via expo-sqlite.
// Tablas: meetings, parts, assignments, warnings + sync_meta.
// Sala siempre A, sin selector. Designar exige online (no se escribe aquí).

import * as SQLite from "expo-sqlite";
import type { SyncPayload } from "./api";

const DB_NAME = "meeting-base.db";

let db: SQLite.SQLiteDatabase | null = null;

export function getDb(): SQLite.SQLiteDatabase {
  if (!db) db = SQLite.openDatabaseSync(DB_NAME);
  return db;
}

export async function initDb(): Promise<void> {
  getDb().execSync(`
    CREATE TABLE IF NOT EXISTS meetings (
      id TEXT PRIMARY KEY NOT NULL,
      congregation_id TEXT NOT NULL,
      import_id TEXT,
      fecha TEXT NOT NULL,
      tipo TEXT NOT NULL,
      semana_label TEXT,
      estado TEXT NOT NULL,
      sala TEXT NOT NULL DEFAULT 'A',
      hora_inicio TEXT,
      lectura_semanal TEXT,
      titulo_atalaya TEXT,
      cancion_inicial INTEGER,
      cancion_intermedia INTEGER,
      cancion_final INTEGER
    );
    CREATE TABLE IF NOT EXISTS parts (
      id TEXT PRIMARY KEY NOT NULL,
      meeting_id TEXT NOT NULL,
      orden INTEGER NOT NULL,
      seccion TEXT,
      tipo_clave TEXT,
      titulo TEXT NOT NULL,
      sala TEXT NOT NULL DEFAULT 'A',
      requiere_ayudante INTEGER NOT NULL DEFAULT 0,
      needs_review INTEGER NOT NULL DEFAULT 0,
      duracion_min INTEGER,
      hora_inicio TEXT
    );
    CREATE TABLE IF NOT EXISTS assignments (
      id TEXT PRIMARY KEY NOT NULL,
      part_id TEXT NOT NULL UNIQUE,
      meeting_id TEXT NOT NULL,
      congregation_id TEXT NOT NULL,
      titular_id TEXT NOT NULL,
      ayudante_id TEXT,
      updated_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS warnings (
      id TEXT PRIMARY KEY NOT NULL,
      meeting_id TEXT NOT NULL,
      publisher_id TEXT NOT NULL,
      part_id TEXT,
      tipo TEXT NOT NULL,
      mensaje_es TEXT NOT NULL,
      created_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS sync_meta (
      congregation_id TEXT PRIMARY KEY NOT NULL,
      last_since TEXT,
      updated_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS prayers (
      id TEXT PRIMARY KEY NOT NULL,
      meeting_id TEXT NOT NULL,
      congregation_id TEXT NOT NULL,
      tipo TEXT NOT NULL,
      publisher_id TEXT
    );
    CREATE TABLE IF NOT EXISTS unavailability (
      id TEXT PRIMARY KEY NOT NULL,
      congregation_id TEXT NOT NULL,
      publisher_id TEXT NOT NULL,
      fecha_inicio TEXT NOT NULL,
      fecha_fin TEXT NOT NULL,
      motivo TEXT
    );
    CREATE INDEX IF NOT EXISTS idx_parts_meeting ON parts(meeting_id);
    CREATE INDEX IF NOT EXISTS idx_assign_meeting ON assignments(meeting_id);
    CREATE INDEX IF NOT EXISTS idx_warn_meeting ON warnings(meeting_id);
    CREATE INDEX IF NOT EXISTS idx_prayer_meeting ON prayers(meeting_id);
  `);
  // Migración local: columnas agregadas después del primer release
  // (CREATE TABLE IF NOT EXISTS no las agrega en instalaciones antiguas).
  ensureColumn("warnings", "part_id", "TEXT");
  ensureColumn("meetings", "hora_inicio", "TEXT");
  ensureColumn("meetings", "lectura_semanal", "TEXT");
  ensureColumn("meetings", "titulo_atalaya", "TEXT");
  ensureColumn("meetings", "cancion_inicial", "INTEGER");
  ensureColumn("meetings", "cancion_intermedia", "INTEGER");
  ensureColumn("meetings", "cancion_final", "INTEGER");
  ensureColumn("parts", "duracion_min", "INTEGER");
  ensureColumn("parts", "hora_inicio", "TEXT");
}

function ensureColumn(table: string, column: string, type: string): void {
  try {
    const cols = getDb().getAllSync<{ name: string }>(
      `PRAGMA table_info(${table})`
    );
    if (!cols.some((c) => c.name === column)) {
      getDb().execSync(`ALTER TABLE ${table} ADD COLUMN ${column} ${type}`);
    }
  } catch {
    // best-effort: si falla aquí, la query que usa la columna mostrará el error
  }
}

// ---------- tipos de lectura ----------

export interface ProgramaWarning {
  id: string;
  tipo: string;
  mensaje_es: string;
}

export interface ProgramaPart {
  id: string;
  meeting_id: string;
  orden: number;
  seccion: string | null;
  tipo_clave: string | null;
  titulo: string;
  sala: string;
  requiere_ayudante: boolean;
  needs_review: boolean;
  duracion_min: number | null;
  hora_inicio: string | null;
  titular_id: string | null;
  ayudante_id: string | null;
  warnings: ProgramaWarning[];
}

export interface ProgramaPrayer {
  id: string;
  tipo: string;
  publisher_id: string | null;
}

export interface ProgramaMeeting {
  id: string;
  fecha: string;
  tipo: string;
  semana_label: string | null;
  estado: string;
  sala: string;
  hora_inicio: string | null;
  lectura_semanal: string | null;
  titulo_atalaya: string | null;
  cancion_inicial: number | null;
  cancion_intermedia: number | null;
  cancion_final: number | null;
  parts: ProgramaPart[];
  prayers: ProgramaPrayer[];
}

// ---------- sync ----------

export async function getLastSince(congregationId: string): Promise<string | null> {
  const row = getDb().getFirstSync<{ last_since: string | null }>(
    "SELECT last_since FROM sync_meta WHERE congregation_id = ?",
    congregationId
  );
  return row?.last_since ?? null;
}

function str(v: unknown, fallback = ""): string {
  return typeof v === "string" ? v : fallback;
}

function num(v: unknown, fallback = 0): number {
  return typeof v === "number" ? v : fallback;
}

// Guarda el snapshot /sync: meetings+parts se reemplazan (siempre
// completos en Fase 2B); assignments/warnings hacen upsert por id
// (incremental cuando `since` filtra). Devuelve el nuevo last_since.
export async function saveSyncPayload(
  congregationId: string,
  payload: SyncPayload
): Promise<string> {
  const now = new Date().toISOString();
  const d = getDb();
  d.withTransactionSync(() => {
    // Only DELETE all meetings if this is a full sync (not filtered/incremental).
    // Incremental syncs use UPSERT to avoid losing existing data.
    if (!payload.filtrado) {
      d.runSync("DELETE FROM parts WHERE meeting_id IN (SELECT id FROM meetings WHERE congregation_id = ?)", congregationId);
      d.runSync("DELETE FROM meetings WHERE congregation_id = ?", congregationId);
    }
    for (const m of payload.meetings ?? []) {
      d.runSync(
        "INSERT OR REPLACE INTO meetings (id, congregation_id, import_id, fecha, tipo, semana_label, estado, sala, hora_inicio, lectura_semanal, titulo_atalaya, cancion_inicial, cancion_intermedia, cancion_final) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
        str(m.id),
        str(m.congregation_id ?? congregationId, congregationId),
        str((m as { import_id?: unknown }).import_id ?? ""),
        str(m.fecha),
        str(m.tipo),
        (m.semana_label as string | null) ?? null,
        str(m.estado, "draft"),
        str((m as { sala?: unknown }).sala ?? "A", "A"),
        (m.hora_inicio as string | null) ?? null,
        (m.lectura_semanal as string | null) ?? null,
        (m.titulo_atalaya as string | null) ?? null,
        (m.cancion_inicial as number | null) ?? null,
        (m.cancion_intermedia as number | null) ?? null,
        (m.cancion_final as number | null) ?? null
      );
    }
    for (const p of payload.parts ?? []) {
      d.runSync(
        "INSERT OR REPLACE INTO parts (id, meeting_id, orden, seccion, tipo_clave, titulo, sala, requiere_ayudante, needs_review, duracion_min, hora_inicio) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
        str(p.id),
        str(p.meeting_id),
        num(p.orden),
        (p.seccion as string | null) ?? null,
        (p.tipo_clave as string | null) ?? null,
        str(p.titulo),
        str((p as { sala?: unknown }).sala ?? "A", "A"),
        p.requiere_ayudante ? 1 : 0,
        p.needs_review ? 1 : 0,
        (p.duracion_min as number | null) ?? null,
        (p.hora_inicio as string | null) ?? null
      );
    }
    for (const a of payload.assignments ?? []) {
      d.runSync(
        "INSERT OR REPLACE INTO assignments (id, part_id, meeting_id, congregation_id, titular_id, ayudante_id, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)",
        str(a.id),
        str(a.part_id),
        str(a.meeting_id),
        str(a.congregation_id ?? congregationId, congregationId),
        str(a.titular_id),
        (a.ayudante_id as string | null) ?? null,
        str(a.updated_at, now)
      );
    }
    for (const w of payload.warnings ?? []) {
      d.runSync(
        "INSERT OR REPLACE INTO warnings (id, meeting_id, publisher_id, part_id, tipo, mensaje_es, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)",
        str(w.id),
        str(w.meeting_id),
        str(w.publisher_id),
        (w as { part_id?: string | null }).part_id ?? null,
        str(w.tipo),
        str(w.mensaje_es),
        str(w.created_at, now)
      );
    }
    for (const pr of payload.prayers ?? []) {
      d.runSync(
        "INSERT OR REPLACE INTO prayers (id, meeting_id, congregation_id, tipo, publisher_id) VALUES (?, ?, ?, ?, ?)",
        str(pr.id),
        str(pr.meeting_id),
        str(pr.congregation_id ?? congregationId, congregationId),
        str(pr.tipo),
        (pr.publisher_id as string | null) ?? null
      );
    }
    if (!payload.filtrado) {
      d.runSync("DELETE FROM unavailability WHERE congregation_id = ?", congregationId);
    }
    for (const u of payload.unavailability ?? []) {
      d.runSync(
        "INSERT OR REPLACE INTO unavailability (id, congregation_id, publisher_id, fecha_inicio, fecha_fin, motivo) VALUES (?, ?, ?, ?, ?, ?)",
        str(u.id),
        str(u.congregation_id ?? congregationId, congregationId),
        str(u.publisher_id),
        str(u.fecha_inicio),
        str(u.fecha_fin),
        (u.motivo as string | null) ?? null
      );
    }
    d.runSync(
      "INSERT OR REPLACE INTO sync_meta (congregation_id, last_since, updated_at) VALUES (?, ?, ?)",
      congregationId,
      now,
      now
    );
    // Reconciliação: apaga do SQLite local as reuniões que não existem
    // mais no servidor (IDs fantasmas de confirmações antigas). Só quando
    // o payload veio do Neon (autoritativo); nunca no fallback de memória,
    // que pode estar incompleto (ex. API recém-reiniciada).
    const keepIds = payload.all_meeting_ids;
    if (payload.persistencia === "neon" && Array.isArray(keepIds)) {
      if (keepIds.length === 0) {
        d.runSync("DELETE FROM parts WHERE meeting_id IN (SELECT id FROM meetings WHERE congregation_id = ?)", congregationId);
        d.runSync("DELETE FROM assignments WHERE congregation_id = ?", congregationId);
        d.runSync("DELETE FROM warnings WHERE meeting_id IN (SELECT id FROM meetings WHERE congregation_id = ?)", congregationId);
        d.runSync("DELETE FROM prayers WHERE congregation_id = ?", congregationId);
        d.runSync("DELETE FROM meetings WHERE congregation_id = ?", congregationId);
      } else {
        const ph = keepIds.map(() => "?").join(",");
        d.runSync(
          `DELETE FROM parts WHERE meeting_id IN (SELECT id FROM meetings WHERE congregation_id = ? AND id NOT IN (${ph}))`,
          congregationId,
          ...keepIds
        );
        d.runSync(
          `DELETE FROM assignments WHERE congregation_id = ? AND meeting_id NOT IN (${ph})`,
          congregationId,
          ...keepIds
        );
        d.runSync(
          `DELETE FROM warnings WHERE meeting_id IN (SELECT id FROM meetings WHERE congregation_id = ? AND id NOT IN (${ph}))`,
          congregationId,
          ...keepIds
        );
        d.runSync(
          `DELETE FROM prayers WHERE congregation_id = ? AND meeting_id NOT IN (${ph})`,
          congregationId,
          ...keepIds
        );
        d.runSync(
          `DELETE FROM meetings WHERE congregation_id = ? AND id NOT IN (${ph})`,
          congregationId,
          ...keepIds
        );
      }
    }
  });
  return now;
}

// Lee el programa offline: meetings + parts + titular + warnings.
// Warnings son por (meeting, publisher): se muestran en cada parte
// cuyo titular coincide con publisher_id.
export async function loadPrograma(congregationId: string): Promise<ProgramaMeeting[]> {
  const d = getDb();
  const ms = d.getAllSync<{
    id: string;
    fecha: string;
    tipo: string;
    semana_label: string | null;
    estado: string;
    sala: string;
    hora_inicio: string | null;
    lectura_semanal: string | null;
    titulo_atalaya: string | null;
    cancion_inicial: number | null;
    cancion_intermedia: number | null;
    cancion_final: number | null;
  }>(
    "SELECT id, fecha, tipo, semana_label, estado, sala, hora_inicio, lectura_semanal, titulo_atalaya, cancion_inicial, cancion_intermedia, cancion_final FROM meetings WHERE congregation_id = ? ORDER BY fecha ASC",
    congregationId
  );
  if (ms.length === 0) return [];
  const ps = d.getAllSync<{
    id: string;
    meeting_id: string;
    orden: number;
    seccion: string | null;
    tipo_clave: string | null;
    titulo: string;
    sala: string;
    requiere_ayudante: number;
    needs_review: number;
    duracion_min: number | null;
    hora_inicio: string | null;
  }>(
    "SELECT id, meeting_id, orden, seccion, tipo_clave, titulo, sala, requiere_ayudante, needs_review, duracion_min, hora_inicio FROM parts WHERE meeting_id IN (SELECT id FROM meetings WHERE congregation_id = ?) ORDER BY meeting_id, orden ASC",
    congregationId
  );
  const as = d.getAllSync<{
    part_id: string;
    meeting_id: string;
    titular_id: string;
    ayudante_id: string | null;
  }>(
    "SELECT part_id, meeting_id, titular_id, ayudante_id FROM assignments WHERE congregation_id = ?",
    congregationId
  );
  const ws = d.getAllSync<{
    id: string;
    meeting_id: string;
    publisher_id: string;
    part_id: string | null;
    tipo: string;
    mensaje_es: string;
  }>(
    "SELECT id, meeting_id, publisher_id, part_id, tipo, mensaje_es FROM warnings WHERE meeting_id IN (SELECT id FROM meetings WHERE congregation_id = ?)",
    congregationId
  );

  const byPart = new Map(as.map((a) => [a.part_id, a]));
  const prs = d.getAllSync<{
    id: string;
    meeting_id: string;
    tipo: string;
    publisher_id: string | null;
  }>(
    "SELECT id, meeting_id, tipo, publisher_id FROM prayers WHERE congregation_id = ?",
    congregationId
  );
  const prayersByMeeting = new Map<string, ProgramaPrayer[]>();
  for (const pr of prs) {
    const list = prayersByMeeting.get(pr.meeting_id) ?? [];
    list.push({ id: pr.id, tipo: pr.tipo, publisher_id: pr.publisher_id });
    prayersByMeeting.set(pr.meeting_id, list);
  }
  const warnsByPart = new Map<string, ProgramaWarning[]>();
  for (const w of ws) {
    const k = w.part_id ?? `${w.meeting_id}::${w.publisher_id}`;
    const list = warnsByPart.get(k) ?? [];
    list.push({ id: w.id, tipo: w.tipo, mensaje_es: w.mensaje_es });
    warnsByPart.set(k, list);
  }
  const partsByMeeting = new Map<string, ProgramaPart[]>();
  for (const p of ps) {
    const a = byPart.get(p.id);
    const list = partsByMeeting.get(p.meeting_id) ?? [];
    list.push({
      id: p.id,
      meeting_id: p.meeting_id,
      orden: p.orden,
      seccion: p.seccion,
      tipo_clave: p.tipo_clave,
      titulo: p.titulo,
      sala: p.sala,
      requiere_ayudante: p.requiere_ayudante === 1,
      needs_review: p.needs_review === 1,
      duracion_min: p.duracion_min,
      hora_inicio: p.hora_inicio,
      titular_id: a?.titular_id ?? null,
      ayudante_id: a?.ayudante_id ?? null,
      warnings: warnsByPart.get(p.id) ?? [],
    });
    partsByMeeting.set(p.meeting_id, list);
  }
  return ms.map((m) => ({
    id: m.id,
    fecha: m.fecha,
    tipo: m.tipo,
    semana_label: m.semana_label,
    estado: m.estado,
    sala: m.sala,
    hora_inicio: m.hora_inicio,
    lectura_semanal: m.lectura_semanal,
    titulo_atalaya: m.titulo_atalaya,
    cancion_inicial: m.cancion_inicial,
    cancion_intermedia: m.cancion_intermedia,
    cancion_final: m.cancion_final,
    parts: partsByMeeting.get(m.id) ?? [],
    prayers: prayersByMeeting.get(m.id) ?? [],
  }));
}
