import { randomUUID } from "node:crypto";
import { and, eq } from "drizzle-orm";
import { getDb, isDbConfigured } from "../../../../packages/db/db.js";
import { publishers as publishersTable } from "../../../../packages/db/schema.js";

// Fase 5 — publishers store. Neon first, in-memory fallback.

export interface PublisherPrivileges {
  cabezaFamilia: boolean;
  presidenteSemana: boolean;
  tesourosDiscurso: boolean;
  tesourosJoias: boolean;
  tesourosLeitura: boolean;
  ministerioIniciar: boolean;
  ministerioCultivar: boolean;
  ministerioDiscipulos: boolean;
  ministerioExplicar: boolean;
  ministerioAjudante: boolean;
  ministerioDiscurso: boolean;
  ministerioOque: boolean;
  vidaDiscurso: boolean;
  vidaCondutor: boolean;
  vidaLeitor: boolean;
  oracao: boolean;
  pubPresidente: boolean;
  pubDiscurso: boolean;
  pubSentinelaCondutor: boolean;
  pubSentinelaLeitor: boolean;
}

export interface Publisher {
  id: string;
  congregationId: string;
  nombre: string;
  sexo: string;
  cargo: string;
  activo: boolean;
  telefono?: string;
  userId?: string;
  familiaId?: string | null;
  privileges: PublisherPrivileges;
  createdAt: string;
}

// In-memory fallback
const memPublishers = new Map<string, Publisher[]>();

const MALE_ONLY_FIELDS: (keyof PublisherPrivileges)[] = [
  'presidenteSemana', 'tesourosDiscurso', 'tesourosJoias', 'tesourosLeitura',
  'ministerioDiscurso', 'ministerioOque', 'vidaDiscurso', 'vidaCondutor', 'vidaLeitor',
  'oracao', 'pubPresidente', 'pubDiscurso', 'pubSentinelaCondutor', 'pubSentinelaLeitor'
];

const ELDER_OR_SERVANT_FIELDS: (keyof PublisherPrivileges)[] = [
  'presidenteSemana', 'tesourosDiscurso', 'tesourosJoias',
  'ministerioOque', 'vidaDiscurso', 'vidaCondutor',
  'pubPresidente', 'pubDiscurso', 'pubSentinelaCondutor'
];

const DEFAULT_PRIVILEGES: PublisherPrivileges = {
  cabezaFamilia: false,
  presidenteSemana: false,
  tesourosDiscurso: false,
  tesourosJoias: false,
  tesourosLeitura: false,
  ministerioIniciar: true,
  ministerioCultivar: true,
  ministerioDiscipulos: true,
  ministerioExplicar: true,
  ministerioAjudante: true,
  ministerioDiscurso: true,
  ministerioOque: false,
  vidaDiscurso: false,
  vidaCondutor: false,
  vidaLeitor: false,
  oracao: false,
  pubPresidente: false,
  pubDiscurso: false,
  pubSentinelaCondutor: false,
  pubSentinelaLeitor: false,
};

export function applyPrivilegeDefaults(
  sexo: string,
  cargo: string,
  privileges: Partial<PublisherPrivileges>
): PublisherPrivileges {
  const result = { ...DEFAULT_PRIVILEGES, ...privileges };

  if (sexo !== 'M') {
    for (const field of MALE_ONLY_FIELDS) {
      result[field] = false;
    }
  }

  if (!['anciano', 'siervo_ministerial'].includes(cargo)) {
    for (const field of ELDER_OR_SERVANT_FIELDS) {
      result[field] = false;
    }
  }

  return result;
}

function rowToPublisher(r: Record<string, unknown>): Publisher {
  return {
    id: String(r.id),
    congregationId: String(r.congregationId),
    nombre: String(r.nombre),
    sexo: String(r.sexo),
    cargo: String(r.cargo),
    activo: Boolean(r.activo),
    telefono: r.telefono ? String(r.telefono) : undefined,
    userId: r.userId ? String(r.userId) : undefined,
    familiaId: r.familiaId ? String(r.familiaId) : null,
    privileges: {
      cabezaFamilia: Boolean(r.cabezaFamilia),
      presidenteSemana: Boolean(r.presidenteSemana),
      tesourosDiscurso: Boolean(r.tesourosDiscurso),
      tesourosJoias: Boolean(r.tesourosJoias),
      tesourosLeitura: Boolean(r.tesourosLeitura),
      ministerioIniciar: Boolean(r.ministerioIniciar),
      ministerioCultivar: Boolean(r.ministerioCultivar),
      ministerioDiscipulos: Boolean(r.ministerioDiscipulos),
      ministerioExplicar: Boolean(r.ministerioExplicar),
      ministerioAjudante: Boolean(r.ministerioAjudante),
      ministerioDiscurso: Boolean(r.ministerioDiscurso),
      ministerioOque: Boolean(r.ministerioOque),
      vidaDiscurso: Boolean(r.vidaDiscurso),
      vidaCondutor: Boolean(r.vidaCondutor),
      vidaLeitor: Boolean(r.vidaLeitor),
      oracao: Boolean(r.oracao),
      pubPresidente: Boolean(r.pubPresidente),
      pubDiscurso: Boolean(r.pubDiscurso),
      pubSentinelaCondutor: Boolean(r.pubSentinelaCondutor),
      pubSentinelaLeitor: Boolean(r.pubSentinelaLeitor),
    },
    createdAt: r.createdAt ? String(r.createdAt) : new Date().toISOString(),
  };
}

export async function listPublishers(congregationId: string): Promise<Publisher[]> {
  if (isDbConfigured()) {
    try {
      const db = getDb();
      if (db) {
        const rows = await db
          .select()
          .from(publishersTable)
          .where(and(
            eq(publishersTable.congregationId, congregationId),
            eq(publishersTable.activo, true),
          ));
        return rows.map(rowToPublisher);
      }
    } catch {
      // fallback to memory
    }
  }
  return (memPublishers.get(congregationId) ?? []).filter((p) => p.activo);
}

export async function getPublisher(congregationId: string, id: string): Promise<Publisher | undefined> {
  if (isDbConfigured()) {
    try {
      const db = getDb();
      if (db) {
        const rows = await db
          .select()
          .from(publishersTable)
          .where(and(
            eq(publishersTable.congregationId, congregationId),
            eq(publishersTable.id, id),
          ));
        return rows[0] ? rowToPublisher(rows[0]) : undefined;
      }
    } catch {
      // fallback to memory
    }
  }
  return (memPublishers.get(congregationId) ?? []).find((p) => p.id === id);
}

export async function createPublisher(
  congregationId: string,
  data: { 
    nombre: string; 
    sexo: string; 
    cargo?: string; 
    telefono?: string;
    privileges?: Partial<PublisherPrivileges>;
  }
): Promise<Publisher> {
  const cargo = data.cargo ?? 'publicador';
  const privileges = applyPrivilegeDefaults(data.sexo, cargo, data.privileges ?? {});

  const pub: Publisher = {
    id: randomUUID(),
    congregationId,
    nombre: data.nombre,
    sexo: data.sexo,
    cargo,
    activo: true,
    telefono: data.telefono,
    privileges,
    createdAt: new Date().toISOString(),
  };

  if (isDbConfigured()) {
    try {
      const db = getDb();
      if (db) {
        await db.insert(publishersTable).values({
          id: pub.id,
          congregationId: pub.congregationId,
          nombre: pub.nombre,
          sexo: pub.sexo,
          cargo: pub.cargo,
          activo: pub.activo,
          telefono: pub.telefono ?? null,
          cabezaFamilia: privileges.cabezaFamilia,
          presidenteSemana: privileges.presidenteSemana,
          tesourosDiscurso: privileges.tesourosDiscurso,
          tesourosJoias: privileges.tesourosJoias,
          tesourosLeitura: privileges.tesourosLeitura,
          ministerioIniciar: privileges.ministerioIniciar,
          ministerioCultivar: privileges.ministerioCultivar,
          ministerioDiscipulos: privileges.ministerioDiscipulos,
          ministerioExplicar: privileges.ministerioExplicar,
          ministerioAjudante: privileges.ministerioAjudante,
          ministerioDiscurso: privileges.ministerioDiscurso,
          ministerioOque: privileges.ministerioOque,
          vidaDiscurso: privileges.vidaDiscurso,
          vidaCondutor: privileges.vidaCondutor,
          vidaLeitor: privileges.vidaLeitor,
          oracao: privileges.oracao,
          pubPresidente: privileges.pubPresidente,
          pubDiscurso: privileges.pubDiscurso,
          pubSentinelaCondutor: privileges.pubSentinelaCondutor,
          pubSentinelaLeitor: privileges.pubSentinelaLeitor,
        });
        return pub;
      }
    } catch {
      // fallback to memory
    }
  }

  const list = memPublishers.get(congregationId) ?? [];
  list.push(pub);
  memPublishers.set(congregationId, list);
  return pub;
}

export async function updatePublisher(
  congregationId: string,
  id: string,
  data: Partial<{
    nombre: string;
    sexo: string;
    cargo: string;
    telefono: string;
    activo: boolean;
    privileges: Partial<PublisherPrivileges>;
  }>
): Promise<Publisher | undefined> {
  if (isDbConfigured()) {
    try {
      const db = getDb();
      if (db) {
        const rows = await db
          .select()
          .from(publishersTable)
          .where(and(
            eq(publishersTable.congregationId, congregationId),
            eq(publishersTable.id, id),
          ));
        if (!rows[0]) return undefined;

        const current = rowToPublisher(rows[0]);
        const newSexo = data.sexo ?? current.sexo;
        const newCargo = data.cargo ?? current.cargo;
        const newPrivileges = data.privileges
          ? applyPrivilegeDefaults(newSexo, newCargo, { ...current.privileges, ...data.privileges })
          : current.privileges;

        const sets: Record<string, unknown> = {};
        if (data.nombre !== undefined) sets.nombre = data.nombre;
        if (data.sexo !== undefined) sets.sexo = data.sexo;
        if (data.cargo !== undefined) sets.cargo = data.cargo;
        if (data.telefono !== undefined) sets.telefono = data.telefono;
        if (data.activo !== undefined) sets.activo = data.activo;
        if (data.privileges !== undefined) {
          sets.cabezaFamilia = newPrivileges.cabezaFamilia;
          sets.presidenteSemana = newPrivileges.presidenteSemana;
          sets.tesourosDiscurso = newPrivileges.tesourosDiscurso;
          sets.tesourosJoias = newPrivileges.tesourosJoias;
          sets.tesourosLeitura = newPrivileges.tesourosLeitura;
          sets.ministerioIniciar = newPrivileges.ministerioIniciar;
          sets.ministerioCultivar = newPrivileges.ministerioCultivar;
          sets.ministerioDiscipulos = newPrivileges.ministerioDiscipulos;
          sets.ministerioExplicar = newPrivileges.ministerioExplicar;
          sets.ministerioAjudante = newPrivileges.ministerioAjudante;
          sets.ministerioDiscurso = newPrivileges.ministerioDiscurso;
          sets.ministerioOque = newPrivileges.ministerioOque;
          sets.vidaDiscurso = newPrivileges.vidaDiscurso;
          sets.vidaCondutor = newPrivileges.vidaCondutor;
          sets.vidaLeitor = newPrivileges.vidaLeitor;
          sets.oracao = newPrivileges.oracao;
          sets.pubPresidente = newPrivileges.pubPresidente;
          sets.pubDiscurso = newPrivileges.pubDiscurso;
          sets.pubSentinelaCondutor = newPrivileges.pubSentinelaCondutor;
          sets.pubSentinelaLeitor = newPrivileges.pubSentinelaLeitor;
        }
        if (Object.keys(sets).length > 0) {
          await db.update(publishersTable).set(sets).where(eq(publishersTable.id, id));
        }
        const updated = await db.select().from(publishersTable).where(eq(publishersTable.id, id));
        return updated[0] ? rowToPublisher(updated[0]) : undefined;
      }
    } catch {
      // fallback to memory
    }
  }

  const list = memPublishers.get(congregationId) ?? [];
  const idx = list.findIndex((p) => p.id === id);
  if (idx < 0) return undefined;
  const pub = list[idx];
  if (data.nombre !== undefined) pub.nombre = data.nombre;
  if (data.sexo !== undefined) pub.sexo = data.sexo;
  if (data.cargo !== undefined) pub.cargo = data.cargo;
  if (data.telefono !== undefined) pub.telefono = data.telefono;
  if (data.activo !== undefined) pub.activo = data.activo;
  if (data.privileges !== undefined) {
    const newSexo = data.sexo ?? pub.sexo;
    const newCargo = data.cargo ?? pub.cargo;
    pub.privileges = applyPrivilegeDefaults(newSexo, newCargo, { ...pub.privileges, ...data.privileges });
  }
  list[idx] = pub;
  return pub;
}

export async function deletePublisher(congregationId: string, id: string): Promise<boolean> {
  if (isDbConfigured()) {
    try {
      const db = getDb();
      if (db) {
        await db.update(publishersTable).set({ activo: false }).where(eq(publishersTable.id, id));
        return true;
      }
    } catch {
      // fallback to memory
    }
  }

  const list = memPublishers.get(congregationId) ?? [];
  const idx = list.findIndex((p) => p.id === id);
  if (idx < 0) return false;
  list[idx].activo = false;
  return true;
}

// Seed dev publishers (só em memória — não insere no Neon)
export function seedPublishers(congregationId: string): void {
  if ((memPublishers.get(congregationId) ?? []).length > 0) return;
  const names = [
    { nombre: "Carlos Méndez", sexo: "M", cargo: "anciano" },
    { nombre: "Luis Rodríguez", sexo: "M", cargo: "siervo_ministerial" },
    { nombre: "María García", sexo: "F", cargo: "publicador" },
    { nombre: "Ana López", sexo: "F", cargo: "publicador" },
    { nombre: "Pedro Sánchez", sexo: "M", cargo: "publicador" },
  ];
  for (const n of names) {
    const pub: Publisher = {
      id: randomUUID(),
      congregationId,
      ...n,
      activo: true,
      privileges: applyPrivilegeDefaults(n.sexo, n.cargo, {}),
      createdAt: new Date().toISOString(),
    };
    const list = memPublishers.get(congregationId) ?? [];
    list.push(pub);
    memPublishers.set(congregationId, list);
  }
}
