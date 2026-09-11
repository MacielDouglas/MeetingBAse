import { randomUUID } from "node:crypto";
import {
  mapMwbToParts,
  mapWatchtowerToParts,
  mapS34ToParts,
  mapSjjToParts,
  type PartDraft,
} from "../../../../packages/db/mapping.js";
import type { ParsedPub } from "./parsePub.js";

// Multi-file import model. Each .jwpub upload creates a job.
// Jobs can be merged into complete meetings (midweek + weekend).

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
  parts: (PartDraft & { sala: "A"; id: string })[];
}

export interface UploadedFile {
  filename: string;
  kind: "mwb" | "w" | "s34" | "sjj";
  jobId: string;
  uploadedAt: string;
}

const jobs = new Map<string, ImportJob>();
const confirmed = new Map<string, ConfirmedMeeting[]>();
const uploaded = new Map<string, UploadedFile[]>(); // congregationId -> files

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

// --- Job management ---

export function createJob(congregationId: string, parsed: ParsedPub): ImportJob {
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

  // Separate by kind
  const mwbJobs = allJobs.filter((j) => j.kind === "mwb");
  const wJobs = allJobs.filter((j) => j.kind === "w");
  const s34Jobs = allJobs.filter((j) => j.kind === "s34");
  const sjjJobs = allJobs.filter((j) => j.kind === "sjj");

  const mergedWeeks: WeekPreview[] = [];

  // Build midweek meetings (mwb + sjj)
  for (const mwbJob of mwbJobs) {
    for (const week of mwbJob.weeks) {
      const sjjParts = sjjJobs.flatMap((j) =>
        j.weeks.flatMap((w) => w.parts)
      );
      mergedWeeks.push({
        ...week,
        parts: [...week.parts, ...sjjParts],
      });
    }
  }

  // Build weekend meetings (w + s34 + sjj)
  for (const wJob of wJobs) {
    for (const week of wJob.weeks) {
      const s34Parts = s34Jobs.flatMap((j) =>
        j.weeks.flatMap((w) => w.parts)
      );
      const sjjParts = sjjJobs.flatMap((j) =>
        j.weeks.flatMap((w) => w.parts)
      );
      mergedWeeks.push({
        ...week,
        parts: [...week.parts, ...s34Parts, ...sjjParts],
      });
    }
  }

  // If only sjj uploaded alone, create placeholder weeks
  if (mwbJobs.length === 0 && wJobs.length === 0 && sjjJobs.length > 0) {
    for (const sjjJob of sjjJobs) {
      for (const week of sjjJob.weeks) {
        mergedWeeks.push(week);
      }
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
  return parsed.rows.map((row, index) => {
    if (parsed.kind === "w") {
      const fecha = String(row.w_study_date ?? "").replaceAll("/", "-");
      return {
        index,
        fecha,
        tipo: "fin_semana",
        semanaLabel: String(row.w_study_date_locale ?? fecha),
        tituloAtalaya: String(row.w_study_title ?? ""),
        cancionInicial: numOrUndef(row.w_study_opening_song),
        cancionFinal: numOrUndef(row.w_study_concluding_song),
        parts: mapWatchtowerToParts(row).map(toSalaA),
      };
    }
    if (parsed.kind === "s34") {
      const fecha = String(row.s34_date ?? row.date ?? "").replaceAll("/", "-");
      return {
        index,
        fecha,
        tipo: "fin_semana",
        semanaLabel: String(row.s34_date_locale ?? fecha ?? `S-34 ${index + 1}`),
        parts: mapS34ToParts(row).map(toSalaA),
      };
    }
    if (parsed.kind === "sjj") {
      const fecha = String(row.sjj_date ?? row.date ?? "").replaceAll("/", "-");
      return {
        index,
        fecha,
        tipo: "entre_semana",
        semanaLabel: String(row.sjj_date_locale ?? fecha ?? `Cánticos ${index + 1}`),
        parts: mapSjjToParts(row).map(toSalaA),
      };
    }
    // mwb
    const fecha = String(row.mwb_week_date ?? "").replaceAll("/", "-");
    return {
      index,
      fecha,
      tipo: "entre_semana",
      semanaLabel: String(row.mwb_week_date_locale ?? fecha),
      lecturaSemanal: String(row.mwb_weekly_bible_reading ?? ""),
      cancionInicial: numOrUndef(row.mwb_song_first),
      cancionIntermedia: numOrUndef(row.mwb_song_middle),
      cancionFinal: numOrUndef(row.mwb_song_conclude),
      parts: mapMwbToParts(row).map(toSalaA),
    };
  });
}

function numOrUndef(v: unknown): number | undefined {
  return typeof v === "number" ? v : undefined;
}
