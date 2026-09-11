import { randomUUID } from "node:crypto";
import {
  mapMwbToParts,
  mapWatchtowerToParts,
  type PartDraft,
} from "../../../../packages/db/mapping.js";
import type { ParsedPub } from "./parsePub.js";

// Preview model for Fase 1. Room is always A (fixed, no selector).

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
  kind: "mwb" | "w";
  estado: "preview" | "confirmado";
  weeks: WeekPreview[];
  createdAt: string;
  confirmedAt?: string;
}

const jobs = new Map<string, ImportJob>();

// NOTE Fase 1: in-memory store. Fase 2 persists to Neon (Drizzle imports,
// meetings, parts) with transactional confirm. IDs stay UUID.

export function createJob(congregationId: string, parsed: ParsedPub): ImportJob {
  const job: ImportJob = {
    id: randomUUID(),
    congregationId,
    filename: parsed.filename,
    kind: parsed.kind as "mwb" | "w",
    estado: "preview",
    weeks: buildWeeks(parsed),
    createdAt: new Date().toISOString(),
  };
  jobs.set(job.id, job);
  return job;
}

export function getJob(id: string): ImportJob | undefined {
  return jobs.get(id);
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
