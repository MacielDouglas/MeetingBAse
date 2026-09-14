import { randomUUID } from "node:crypto";
import { neon } from "@neondatabase/serverless";
import {
  applyStartTimes,
  mapMwbToParts,
  mapWatchtowerToParts,
  parseMeetingStart,
  type PartDraft,
} from "../../../../packages/db/mapping.js";
import type { ParsedPub } from "./parsePub.js";

// Multi-file import model. Each .jwpub upload creates a job.
// Jobs can be merged into complete meetings (midweek + weekend).
// sjj (songs) and S-34 (talks) are stored as catalogs, not weeks.

export interface WeekPreview {
  index: number;
  fecha: string;
  tipo: "entre_semana" | "fin_semana";
  semanaLabel: string;
  lecturaSemanal?: string;
  tituloAtalaya?: string;
  cancionInicial?: number;
  cancionIntermedia?: number;
  cancionFinal?: number;
  horaInicio?: string | null;
  parts: (PartDraft & { sala: "A" })[];
}

export interface ImportJob {
  id: string;
  congregationId: string;
  filename: string;
  kind: "mwb" | "w" | "s34" | "sjj";
  estado: "preview" | "confirmado";
  weeks: WeekPreview[];
  createdAt: string;
  confirmedAt?: string;
}

export interface ConfirmedMeeting {
  id: string;
  congregation_id: string;
  import_id: string;
  fecha: string;
  tipo: string;
  semana_label?: string | null;
  estado: string;
  sala: "A";
  lectura_semanal?: string | null;
  titulo_atalaya?: string | null;
  cancion_inicial?: number | null;
  cancion_intermedia?: number | null;
  cancion_final?: number | null;
  hora_inicio?: string | null;
  parts: (PartDraft & { sala: "A"; id: string })[];
}

export interface UploadedFile {
  filename: string;
  kind: "mwb" | "w" | "s34" | "sjj";
  jobId: string;
  uploadedAt: string;
}

// Catalog entries for sjj (songs) and S-34 (public talks)
export interface SongCatalogEntry {
  number: number;
  title: string;
}

export interface TalkCatalogEntry {
  number: number;
  title: string;
}

const jobs = new Map<string, ImportJob>();
const confirmed = new Map<string, ConfirmedMeeting[]>();
const uploaded = new Map<string, UploadedFile[]>(); // congregationId -> files

// Catalog stores: congregationId → entries
const songCatalog = new Map<string, SongCatalogEntry[]>();
const talkCatalog = new Map<string, TalkCatalogEntry[]>();

// --- Upload tracking & duplicate detection ---

export function listUploaded(congregationId: string): UploadedFile[] {
  return uploaded.get(congregationId) ?? [];
}

export function findDuplicate(
  congregationId: string,
  kind: string
): UploadedFile | undefined {
  const files = uploaded.get(congregationId) ?? [];
  return files.find((f) => f.kind === kind);
}

export function registerUpload(congregationId: string, file: UploadedFile): void {
  const files = uploaded.get(congregationId) ?? [];
  // Replace existing of same kind
  const idx = files.findIndex((f) => f.kind === file.kind);
  if (idx >= 0) {
    files[idx] = file;
  } else {
    files.push(file);
  }
  uploaded.set(congregationId, files);
}

export function removeUpload(congregationId: string, kind: string): void {
  const files = uploaded.get(congregationId) ?? [];
  uploaded.set(
    congregationId,
    files.filter((f) => f.kind !== kind)
  );
}

export function isComplete(congregationId: string): boolean {
  const files = uploaded.get(congregationId) ?? [];
  const kinds = new Set(files.map((f) => f.kind));
  // Midweek: mwb + sjj | Weekend: w + s34 + sjj
  const hasMidweek = kinds.has("mwb") && kinds.has("sjj");
  const hasWeekend = kinds.has("w") && kinds.has("s34") && kinds.has("sjj");
  return hasMidweek || hasWeekend;
}

// --- Catalog accessors (sjj → songs, s34 → talks) ---

const neonSql = process.env.DATABASE_URL ? neon(process.env.DATABASE_URL) : null;

export function getSongCatalog(congregationId: string): SongCatalogEntry[] {
  return songCatalog.get(congregationId) ?? [];
}

export function getTalkCatalog(congregationId: string): TalkCatalogEntry[] {
  return talkCatalog.get(congregationId) ?? [];
}

async function persistCatalog(congregationId: string, kind: string, data: unknown): Promise<void> {
  if (!neonSql) return;
  try {
    await neonSql`
      INSERT INTO catalogs (congregation_id, kind, data)
      VALUES (${congregationId}, ${kind}, ${JSON.stringify(data)})
      ON CONFLICT (congregation_id, kind)
      DO UPDATE SET data = ${JSON.stringify(data)}
    `;
  } catch (e) {
    console.error(`[importStore] Failed to persist ${kind} catalog:`, e);
  }
}

export async function loadCatalogsFromDb(congregationId: string): Promise<void> {
  if (!neonSql) return;
  try {
    const rows = await neonSql`SELECT kind, data FROM catalogs WHERE congregation_id = ${congregationId}`;
    for (const row of rows) {
      const data = typeof row.data === "string" ? JSON.parse(row.data) : row.data;
      if (row.kind === "sjj") {
        const entries: SongCatalogEntry[] = (data as SongCatalogEntry[]).filter(
          (e) => e.number > 0 && e.title
        );
        songCatalog.set(congregationId, entries);
      } else if (row.kind === "s34") {
        const entries: TalkCatalogEntry[] = (data as TalkCatalogEntry[]).filter(
          (e) => e.title
        );
        talkCatalog.set(congregationId, entries);
      }
    }
  } catch (e) {
    console.error("[importStore] Failed to load catalogs from DB:", e);
  }
}

function storeSongCatalog(congregationId: string, rows: Record<string, string | number | undefined>[]): void {
  const entries: SongCatalogEntry[] = rows
    .map((r) => ({
      number: typeof r.sjj_number === "number" ? r.sjj_number : typeof r.number === "number" ? r.number : 0,
      title: String(r.sjj_title ?? r.title ?? ""),
    }))
    .filter((e) => e.number > 0 && e.title);
  songCatalog.set(congregationId, entries);
  persistCatalog(congregationId, "sjj", entries);
}

function storeTalkCatalog(congregationId: string, rows: Record<string, string | number | undefined>[]): void {
  const entries: TalkCatalogEntry[] = rows
    .map((r) => ({
      number: typeof r.s34_number === "number" ? r.s34_number : typeof r.number === "number" ? r.number : 0,
      title: String(r.s34_title ?? r.title ?? ""),
    }))
    .filter((e) => e.title);
  talkCatalog.set(congregationId, entries);
  persistCatalog(congregationId, "s34", entries);
}

// --- Job management ---

export function createJob(congregationId: string, parsed: ParsedPub): ImportJob {
  // sjj and S-34 are catalogs, not weeks — store separately
  if (parsed.kind === "sjj") {
    storeSongCatalog(congregationId, parsed.rows);
  } else if (parsed.kind === "s34") {
    storeTalkCatalog(congregationId, parsed.rows);
  }

  const job: ImportJob = {
    id: randomUUID(),
    congregationId,
    filename: parsed.filename,
    kind: parsed.kind as ImportJob["kind"],
    estado: "preview",
    weeks: buildWeeks(parsed),
    createdAt: new Date().toISOString(),
  };
  jobs.set(job.id, job);
  registerUpload(congregationId, {
    filename: parsed.filename,
    kind: job.kind,
    jobId: job.id,
    uploadedAt: job.createdAt,
  });
  return job;
}

export function getJob(id: string): ImportJob | undefined {
  return jobs.get(id);
}

export function removeJob(id: string): boolean {
  const job = jobs.get(id);
  if (!job) return false;
  removeUpload(job.congregationId, job.kind);
  jobs.delete(id);
  return true;
}

export function saveConfirmedMeetings(list: ConfirmedMeeting[]): void {
  for (const m of list) {
    const arr = confirmed.get(m.congregation_id) ?? [];
    if (!arr.some((x) => x.id === m.id)) arr.push(m);
    confirmed.set(m.congregation_id, arr);
  }
}

export function listConfirmedMeetings(congregationId: string): ConfirmedMeeting[] {
  return (confirmed.get(congregationId) ?? []).slice().sort((a, b) =>
    a.fecha < b.fecha ? -1 : a.fecha > b.fecha ? 1 : 0
  );
}

export function confirmJob(id: string, weeks?: number[]): ImportJob | undefined {
  const job = jobs.get(id);
  if (!job || job.estado !== "preview") return undefined;
  if (weeks && weeks.length > 0) {
    const keep = new Set(weeks);
    job.weeks = job.weeks.filter((w) => keep.has(w.index));
  }
  job.estado = "confirmado";
  job.confirmedAt = new Date().toISOString();
  return job;
}

// --- Merge multiple jobs into complete meetings ---

export function mergeJobs(jobIds: string[]): ImportJob | undefined {
  if (jobIds.length === 0) return undefined;

  const allJobs = jobIds.map((id) => jobs.get(id)).filter(Boolean) as ImportJob[];
  if (allJobs.length === 0) return undefined;

  const congregationId = allJobs[0].congregationId;

  // Separate by kind — sjj and s34 are catalogs, not schedulable
  const mwbJobs = allJobs.filter((j) => j.kind === "mwb");
  const wJobs = allJobs.filter((j) => j.kind === "w");

  const mergedWeeks: WeekPreview[] = [];

  // MWB weeks stay as-is (songs already resolved from sjj catalog via mapMwbToParts)
  for (const mwbJob of mwbJobs) {
    for (const week of mwbJob.weeks) {
      mergedWeeks.push({ ...week });
    }
  }

  // W weeks stay as-is (public talk placeholder is kept)
  for (const wJob of wJobs) {
    for (const week of wJob.weeks) {
      mergedWeeks.push({ ...week });
    }
  }

  // Sort by date
  mergedWeeks.sort((a, b) => (a.fecha < b.fecha ? -1 : a.fecha > b.fecha ? 1 : 0));

  // Reindex
  mergedWeeks.forEach((w, i) => { w.index = i; });

  const merged: ImportJob = {
    id: randomUUID(),
    congregationId,
    filename: allJobs.map((j) => j.filename).join(", "),
    kind: allJobs[0].kind,
    estado: "preview",
    weeks: mergedWeeks,
    createdAt: new Date().toISOString(),
  };
  jobs.set(merged.id, merged);
  return merged;
}

// --- Build weeks from parsed data ---

function toSalaA(p: PartDraft): PartDraft & { sala: "A" } {
  return { ...p, sala: "A" };
}

function buildWeeks(parsed: ParsedPub): WeekPreview[] {
  // sjj and S-34 are catalogs — no weeks to create
  if (parsed.kind === "sjj" || parsed.kind === "s34") {
    return [];
  }

  return parsed.rows.map((row, index) => {
    if (parsed.kind === "w") {
      const fecha = String(row.w_study_date ?? "").replaceAll("/", "-");
      const parts = mapWatchtowerToParts(row).map(toSalaA);
      const horaInicio = parseMeetingStart(row);
      applyStartTimes(horaInicio, parts);
      return {
        index,
        fecha,
        tipo: "fin_semana",
        semanaLabel: String(row.w_study_date_locale ?? fecha),
        tituloAtalaya: String(row.w_study_title ?? ""),
        cancionInicial: numOrUndef(row.w_study_opening_song),
        cancionFinal: numOrUndef(row.w_study_concluding_song),
        horaInicio,
        parts,
      };
    }
    // mwb
    const fecha = String(row.mwb_week_date ?? "").replaceAll("/", "-");
    const parts = mapMwbToParts(row).map(toSalaA);
    const horaInicio = parseMeetingStart(row);
    applyStartTimes(horaInicio, parts);
    return {
      index,
      fecha,
      tipo: "entre_semana",
      semanaLabel: String(row.mwb_week_date_locale ?? fecha),
      lecturaSemanal: String(row.mwb_weekly_bible_reading ?? ""),
      cancionInicial: numOrUndef(row.mwb_song_first),
      cancionIntermedia: numOrUndef(row.mwb_song_middle),
      cancionFinal: numOrUndef(row.mwb_song_conclude),
      horaInicio,
      parts,
    };
  });
}

function numOrUndef(v: unknown): number | undefined {
  return typeof v === "number" ? v : undefined;
}
