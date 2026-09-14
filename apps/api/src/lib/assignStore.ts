import { randomUUID } from "node:crypto";
import { listConfirmedMeetings } from "./importStore.js";
import { listPublishers } from "./publishersStore.js";
import type { ListedMeeting } from "./repoNeon.js";

// Fase 2B — fallback in-memory para assign/publish/sync.
// Espelha o formato do Neon (snake_case). Usado quando não há
// DATABASE_URL ou o Neon falha. Sala siempre A.

// Publicador de mentira (en prod viene de Neon `publishers`).
export interface MemPublisher {
  id: string;
  sexo: string;
  cargo: string;
  congregationId: string;
  nombre?: string;
}

export interface MemAssignment {
  id: string;
  part_id: string;
  meeting_id: string;
  congregation_id: string;
  titular_id: string;
  ayudante_id: string | null;
  updated_at: string;
}

export interface MemWarningRow {
  id: string;
  meeting_id: string;
  congregation_id: string;
  publisher_id: string;
  part_id: string | null;
  tipo: string;
  mensaje_es: string;
  created_at: string;
}

const publishers = new Map<string, MemPublisher>();
const assignments = new Map<string, MemAssignment>(); // key: part_id (unique)
const warnings: MemWarningRow[] = [];

export function upsertMemPublisher(p: MemPublisher): MemPublisher {
  publishers.set(p.id, p);
  return p;
}

export async function getMemPublisher(id: string, congId?: string): Promise<MemPublisher | undefined> {
  const mem = publishers.get(id);
  if (mem) return mem;
  if (congId) {
    const pubs = await listPublishers(congId);
    const found = pubs.find((p) => p.id === id);
    if (found) {
      const memPub: MemPublisher = {
        id: found.id,
        sexo: found.sexo,
        cargo: found.cargo,
        congregationId: found.congregationId,
        nombre: found.nombre,
      };
      publishers.set(id, memPub);
      return memPub;
    }
  }
  return undefined;
}

export interface MemPartHit {
  meetingId: string;
  congregationId: string;
  meetingFecha: string;
  part: {
    id: string;
    orden: number;
    seccion: string;
    tipoClave: string;
    titulo: string;
    requiereAyudante: boolean;
    needsReview?: boolean;
  };
}

// Busca parte por UUID dentro da congregação (404 se de outra).
export function findMemPart(
  congregationId: string,
  partId: string
): MemPartHit | null {
  for (const m of listConfirmedMeetings(congregationId)) {
    const p = m.parts.find((x) => x.id === partId);
    if (p) {
      return {
        meetingId: m.id,
        congregationId: m.congregation_id,
        meetingFecha: m.fecha,
        part: {
          id: p.id,
          orden: p.orden,
          seccion: p.seccion,
          tipoClave: p.tipoClave,
          titulo: p.titulo,
          requiereAyudante: p.requiereAyudante,
          needsReview: p.needsReview,
        },
      };
    }
  }
  return null;
}

// Titular já designado em outra parte da mesma reunião?
export function titularAssignedMem(
  meetingId: string,
  titularId: string,
  excludePartId?: string
): boolean {
  for (const a of assignments.values()) {
    if (
      a.meeting_id === meetingId &&
      a.titular_id === titularId &&
      a.part_id !== excludePartId
    ) {
      return true;
    }
  }
  return false;
}

// Upsert por part_id (unique): cria ou substitui titular/ajudante.
export function getMemAssignment(partId: string): MemAssignment | undefined {
  return assignments.get(partId);
}
export function upsertMemAssignment(input: {
  partId: string;
  meetingId: string;
  congregationId: string;
  titularId: string;
  ayudanteId: string | null;
}): MemAssignment {
  const prev = assignments.get(input.partId);
  const row: MemAssignment = {
    id: prev?.id ?? randomUUID(),
    part_id: input.partId,
    meeting_id: input.meetingId,
    congregation_id: input.congregationId,
    titular_id: input.titularId,
    ayudante_id: input.ayudanteId,
    updated_at: new Date().toISOString(),
  };
  assignments.set(input.partId, row);
  return row;
}

// Troca warnings de (meeting, publisher, part): apaga os antigos e grava
// 1 row por warning atual. Agora com part_id para warnings por parte.
export function replaceMemWarnings(input: {
  meetingId: string;
  congregationId: string;
  publisherId: string;
  partId: string;
  items: { tipo: string; mensajeEs: string }[];
}): MemWarningRow[] {
  for (let i = warnings.length - 1; i >= 0; i -= 1) {
    if (
      warnings[i].meeting_id === input.meetingId &&
      warnings[i].publisher_id === input.publisherId &&
      warnings[i].part_id === input.partId
    ) {
      warnings.splice(i, 1);
    }
  }
  const now = new Date().toISOString();
  const rows = input.items.map((w) => ({
    id: randomUUID(),
    meeting_id: input.meetingId,
    congregation_id: input.congregationId,
    publisher_id: input.publisherId,
    part_id: input.partId,
    tipo: w.tipo,
    mensaje_es: w.mensajeEs,
    created_at: now,
  }));
  warnings.push(...rows);
  return rows;
}

// Apaga avisos de (meeting, publisher, part) — usado para limpar o titular
// anterior ao trocar de titular (se ele não tem outra parte).
export function deleteMemWarnings(meetingId: string, publisherId: string, partId?: string): void {
  for (let i = warnings.length - 1; i >= 0; i -= 1) {
    if (
      warnings[i].meeting_id === meetingId &&
      warnings[i].publisher_id === publisherId &&
      (partId === undefined || warnings[i].part_id === partId)
    ) {
      warnings.splice(i, 1);
    }
  }
}

export function listMemAssignments(congregationId: string): MemAssignment[] {  return [...assignments.values()].filter(
    (a) => a.congregation_id === congregationId
  );
}

export function listMemWarnings(congregationId: string): Omit<MemWarningRow, "congregation_id">[] {
  return warnings
    .filter((w) => w.congregation_id === congregationId)
    .map(({ congregation_id: _c, ...rest }) => rest);
}

export function publishMemMeeting(
  congregationId: string,
  mid: string
): "ok" | "not_found" | "already" {
  const m = listConfirmedMeetings(congregationId).find((x) => x.id === mid);
  if (!m) return "not_found";
  if (m.estado === "published") return "already";
  m.estado = "published";
  return "ok";
}

// Mesmo formato do GET 2A (contrato preservado, só troca id legível
// `${mid}#${orden}` por UUID real da part).
export function listMemDetailed(congregationId: string): ListedMeeting[] {
  const now = new Date().toISOString();
  return listConfirmedMeetings(congregationId).map((m) => ({
    id: m.id,
    congregation_id: m.congregation_id,
    import_id: m.import_id,
    fecha: m.fecha,
    tipo: m.tipo,
    semana_label: m.semana_label ?? null,
    estado: m.estado,
    sala: "A" as const,
    updated_at: now,
    hora_inicio: m.hora_inicio ?? null,
    lectura_semanal: m.lectura_semanal ?? null,
    titulo_atalaya: m.titulo_atalaya ?? null,
    cancion_inicial: m.cancion_inicial ?? null,
    cancion_intermedia: m.cancion_intermedia ?? null,
    cancion_final: m.cancion_final ?? null,
    parts_count: m.parts.length,
    parts: m.parts.map((x) => ({
      id: x.id,
      orden: x.orden,
      seccion: x.seccion,
      tipo_clave: x.tipoClave,
      titulo: x.titulo,
      sala: "A" as const,
      requiere_ayudante: x.requiereAyudante,
      needs_review: x.needsReview ?? false,
      duracion_min: x.duracionMin ?? null,
      hora_inicio: x.horaInicio ?? null,
    })),
  }));
}
