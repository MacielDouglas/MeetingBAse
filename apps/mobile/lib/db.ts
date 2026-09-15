// SQLite local solo lectura (offline). iOS + Android via expo-sqlite.
// Tablas: meetings, parts, assignments, warnings + sync_meta +
// prayers, unavailability, catálogos y publishers_cache.
// Sala siempre A, sin selector. Designar exige online (no se escribe aquí).

import * as SQLite from "expo-sqlite";

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
      cancion_final INTEGER,
      excepcion TEXT,
      visita_co INTEGER DEFAULT 0
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
      hora_inicio TEXT,
      hora_fin TEXT
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
    CREATE TABLE IF NOT EXISTS song_catalog (
      congregation_id TEXT NOT NULL,
      number INTEGER NOT NULL,
      title TEXT NOT NULL,
      PRIMARY KEY (congregation_id, number)
    );
    CREATE TABLE IF NOT EXISTS talk_catalog (
      congregation_id TEXT NOT NULL,
      number INTEGER NOT NULL,
      title TEXT NOT NULL,
      PRIMARY KEY (congregation_id, number)
    );
    CREATE TABLE IF NOT EXISTS publishers_cache (
      congregation_id TEXT NOT NULL,
      id TEXT NOT NULL,
      nombre TEXT NOT NULL,
      apellido TEXT,
      sexo TEXT NOT NULL DEFAULT '',
      familia_id TEXT,
      siervo INTEGER DEFAULT 0,
      anciano INTEGER DEFAULT 0,
      PRIMARY KEY (congregation_id, id)
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
  ensureColumn("publishers_cache", "apellido", "TEXT");
  ensureColumn("publishers_cache", "siervo", "INTEGER DEFAULT 0");
  ensureColumn("publishers_cache", "anciano", "INTEGER DEFAULT 0");
  ensureColumn("parts", "hora_fin", "TEXT");
  ensureColumn("meetings", "excepcion", "TEXT");
  ensureColumn("meetings", "visita_co", "INTEGER DEFAULT 0");
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

// ---------- tipos de lectura (ver ./dbPrograma) ----------

// ---------- sync (ver ./dbSync, ./dbPrograma) ----------

// ---------- publishers_cache (Fase 20: offline) ----------

export interface CachedPublisher {
  id: string;
  nombre: string;
  apellido?: string;
  sexo: string;
  familiaId?: string | null;
  siervo?: boolean;
  anciano?: boolean;
}

// Sobrescribe o cache da congregação (chamado após GET /publishers online).
export async function savePublishersCache(
  congregationId: string,
  pubs: CachedPublisher[]
): Promise<void> {
  const d = getDb();
  d.execSync("BEGIN");
  try {
    d.runSync("DELETE FROM publishers_cache WHERE congregation_id = ?", congregationId);
    for (const p of pubs) {
      d.runSync(
        "INSERT OR REPLACE INTO publishers_cache (congregation_id, id, nombre, apellido, sexo, familia_id, siervo, anciano) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
        congregationId,
        p.id,
        p.nombre,
        p.apellido ?? null,
        p.sexo ?? "",
        p.familiaId ?? null,
        p.siervo ? 1 : 0,
        p.anciano ? 1 : 0
      );
    }
    d.execSync("COMMIT");
  } catch {
    try {
      d.execSync("ROLLBACK");
    } catch {
      // best-effort
    }
  }
}

// Fallback offline do usePublishers (pickers do Asignar, nomes no Programa).
export async function loadPublishersCache(congregationId: string): Promise<CachedPublisher[]> {
  const rows = getDb().getAllSync<{
    id: string;
    nombre: string;
    apellido: string | null;
    sexo: string;
    familia_id: string | null;
    siervo: number;
    anciano: number;
  }>(
    "SELECT id, nombre, apellido, sexo, familia_id, siervo, anciano FROM publishers_cache WHERE congregation_id = ? ORDER BY nombre ASC",
    congregationId
  );
  return rows.map((r) => ({
    id: r.id,
    nombre: r.nombre,
    apellido: r.apellido ?? undefined,
    sexo: r.sexo,
    familiaId: r.familia_id ?? null,
    siervo: r.siervo === 1,
    anciano: r.anciano === 1,
  }));
}

export async function getLastSince(congregationId: string): Promise<string | null> {
  const row = getDb().getFirstSync<{ last_since: string | null }>(
    "SELECT last_since FROM sync_meta WHERE congregation_id = ?",
    congregationId
  );
  return row?.last_since ?? null;
}

export function str(v: unknown, fallback = ""): string {
  return typeof v === "string" ? v : fallback;
}

export function num(v: unknown, fallback = 0): number {
  return typeof v === "number" ? v : fallback;
}

// saveSyncPayload em ./dbSync.

// loadPrograma em ./dbPrograma.

