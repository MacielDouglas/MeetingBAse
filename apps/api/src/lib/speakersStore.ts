import { randomUUID } from "node:crypto";

// In-memory speakers + visits store.
// TODO Fase 5: migrar para Neon.

export interface Speaker {
  id: string;
  congregationId: string;
  nombre: string;
  telefono?: string;
  celular?: string;
  email?: string;
  talkNumbers: number[];
  activo: boolean;
  createdAt: string;
}

export interface Visit {
  id: string;
  congregationId: string;
  speakerId: string;
  fecha: string;
  talkNumber?: number;
  notas?: string;
  estado: string; // pendiente | confirmada | realizada
  createdAt: string;
}

const speakers = new Map<string, Speaker[]>();
const visits = new Map<string, Visit[]>(); // congregationId -> visits

// --- Speakers ---

export function listSpeakers(congregationId: string): Speaker[] {
  return (speakers.get(congregationId) ?? []).filter((s) => s.activo);
}

export function getSpeaker(congregationId: string, id: string): Speaker | undefined {
  return (speakers.get(congregationId) ?? []).find((s) => s.id === id);
}

export function createSpeaker(
  congregationId: string,
  data: { nombre: string; telefono?: string; celular?: string; email?: string; talkNumbers?: number[] }
): Speaker {
  const speaker: Speaker = {
    id: randomUUID(),
    congregationId,
    nombre: data.nombre,
    telefono: data.telefono,
    celular: data.celular,
    email: data.email,
    talkNumbers: data.talkNumbers ?? [],
    activo: true,
    createdAt: new Date().toISOString(),
  };
  const list = speakers.get(congregationId) ?? [];
  list.push(speaker);
  speakers.set(congregationId, list);
  return speaker;
}

export function updateSpeaker(
  congregationId: string,
  id: string,
  data: Partial<{ nombre: string; telefono: string; celular: string; email: string; talkNumbers: number[]; activo: boolean }>
): Speaker | undefined {
  const list = speakers.get(congregationId) ?? [];
  const idx = list.findIndex((s) => s.id === id);
  if (idx < 0) return undefined;
  const s = list[idx];
  if (data.nombre !== undefined) s.nombre = data.nombre;
  if (data.telefono !== undefined) s.telefono = data.telefono;
  if (data.celular !== undefined) s.celular = data.celular;
  if (data.email !== undefined) s.email = data.email;
  if (data.talkNumbers !== undefined) s.talkNumbers = data.talkNumbers;
  if (data.activo !== undefined) s.activo = data.activo;
  list[idx] = s;
  return s;
}

export function deleteSpeaker(congregationId: string, id: string): boolean {
  const list = speakers.get(congregationId) ?? [];
  const idx = list.findIndex((s) => s.id === id);
  if (idx < 0) return false;
  list[idx].activo = false;
  return true;
}

// --- Visits ---

export function listVisits(congregationId: string): Visit[] {
  return (visits.get(congregationId) ?? []).slice().sort((a, b) =>
    a.fecha < b.fecha ? -1 : a.fecha > b.fecha ? 1 : 0
  );
}

export function createVisit(
  congregationId: string,
  data: { speakerId: string; fecha: string; talkNumber?: number; notas?: string }
): Visit {
  const visit: Visit = {
    id: randomUUID(),
    congregationId,
    speakerId: data.speakerId,
    fecha: data.fecha,
    talkNumber: data.talkNumber,
    notas: data.notas,
    estado: "pendiente",
    createdAt: new Date().toISOString(),
  };
  const list = visits.get(congregationId) ?? [];
  list.push(visit);
  visits.set(congregationId, list);
  return visit;
}

export function deleteVisit(congregationId: string, id: string): boolean {
  const list = visits.get(congregationId) ?? [];
  const idx = list.findIndex((v) => v.id === id);
  if (idx < 0) return false;
  list.splice(idx, 1);
  return true;
}

export function updateVisit(
  congregationId: string,
  id: string,
  data: Partial<{ estado: string; notas: string }>
): Visit | undefined {
  const list = visits.get(congregationId) ?? [];
  const idx = list.findIndex((v) => v.id === id);
  if (idx < 0) return undefined;
  const v = list[idx];
  if (data.estado !== undefined) v.estado = data.estado;
  if (data.notas !== undefined) v.notas = data.notas;
  list[idx] = v;
  return v;
}

// Seed dev speakers
export function seedSpeakers(congregationId: string): void {
  if ((speakers.get(congregationId) ?? []).length > 0) return;
  const names = [
    { nombre: "Roberto Díaz", telefono: "+56912345678", talkNumbers: [1, 5, 12, 30] },
    { nombre: "Fernando Vargas", telefono: "+56987654321", talkNumbers: [3, 8, 15] },
    { nombre: "Jorge Campos", celular: "+56911223344", talkNumbers: [2, 10, 25] },
  ];
  for (const n of names) {
    createSpeaker(congregationId, n);
  }
}
