import { randomUUID } from "node:crypto";

// In-memory publishers store. Fallback when no DATABASE_URL.
// TODO Fase 5: migrar para Neon (publishers table já existe no schema).

export interface Publisher {
  id: string;
  congregationId: string;
  nombre: string;
  sexo: string;
  cargo: string;
  activo: boolean;
  telefono?: string;
  userId?: string;
  createdAt: string;
}

const publishers = new Map<string, Publisher[]>(); // congregationId -> publishers

export function listPublishers(congregationId: string): Publisher[] {
  return (publishers.get(congregationId) ?? []).filter((p) => p.activo);
}

export function getPublisher(congregationId: string, id: string): Publisher | undefined {
  return (publishers.get(congregationId) ?? []).find((p) => p.id === id);
}

export function createPublisher(
  congregationId: string,
  data: { nombre: string; sexo: string; cargo?: string; telefono?: string }
): Publisher {
  const pub: Publisher = {
    id: randomUUID(),
    congregationId,
    nombre: data.nombre,
    sexo: data.sexo,
    cargo: data.cargo ?? "publicador",
    activo: true,
    telefono: data.telefono,
    createdAt: new Date().toISOString(),
  };
  const list = publishers.get(congregationId) ?? [];
  list.push(pub);
  publishers.set(congregationId, list);
  return pub;
}

export function updatePublisher(
  congregationId: string,
  id: string,
  data: Partial<{ nombre: string; sexo: string; cargo: string; telefono: string; activo: boolean }>
): Publisher | undefined {
  const list = publishers.get(congregationId) ?? [];
  const idx = list.findIndex((p) => p.id === id);
  if (idx < 0) return undefined;
  const pub = list[idx];
  if (data.nombre !== undefined) pub.nombre = data.nombre;
  if (data.sexo !== undefined) pub.sexo = data.sexo;
  if (data.cargo !== undefined) pub.cargo = data.cargo;
  if (data.telefono !== undefined) pub.telefono = data.telefono;
  if (data.activo !== undefined) pub.activo = data.activo;
  list[idx] = pub;
  return pub;
}

export function deletePublisher(congregationId: string, id: string): boolean {
  const list = publishers.get(congregationId) ?? [];
  const idx = list.findIndex((p) => p.id === id);
  if (idx < 0) return false;
  list[idx].activo = false;
  return true;
}

// Seed dev publishers
export function seedPublishers(congregationId: string): void {
  if ((publishers.get(congregationId) ?? []).length > 0) return;
  const names = [
    { nombre: "Carlos Méndez", sexo: "M", cargo: "anciano" },
    { nombre: "Luis Rodríguez", sexo: "M", cargo: "siervo_ministerial" },
    { nombre: "María García", sexo: "F", cargo: "publicador" },
    { nombre: "Ana López", sexo: "F", cargo: "publicador" },
    { nombre: "Pedro Sánchez", sexo: "M", cargo: "publicador" },
  ];
  for (const n of names) {
    createPublisher(congregationId, n);
  }
}
