import { randomUUID } from "node:crypto";
import { and, eq } from "drizzle-orm";
import { getDb, isDbConfigured } from "../../../../packages/db/db.js";
import { publishers as publishersTable } from "../../../../packages/db/schema.js";

// Fase 32 — publishers store com todos os campos do form.

export interface Publisher {
  id: string;
  congregationId: string;
  nombre: string;
  apellido?: string;
  sexo: string;
  activo: boolean;
  apuntes?: string;
  celular?: string;
  telefono?: string;
  email?: string;
  userId?: string;
  familiaId?: string | null;
  cabezaFamilia?: boolean;
  ministroCampo?: string;
  siervo?: boolean;
  anciano?: boolean;
  oracion?: boolean;
  presidenteEntreSemana?: boolean;
  discursoEntreSemana?: boolean;
  busquemosPerlas?: boolean;
  lecturaBiblia?: boolean;
  empieceConversaciones?: boolean;
  hagaRevisitas?: boolean;
  hagaDiscipulos?: boolean;
  expliqueCreencias?: boolean;
  discursoEnsenanza?: boolean;
  ayudanteEnsenanza?: boolean;
  analisisAuditorio?: boolean;
  discursoAnalisis?: boolean;
  ebc?: boolean;
  lectorEbc?: boolean;
  sala?: string;
  presidenteFinSemana?: boolean;
  conductorAtalaya?: boolean;
  lectorAtalaya?: boolean;
  hospitalidad?: boolean;
  createdAt: string;
}

// In-memory fallback
const memPublishers = new Map<string, Publisher[]>();

const BOOL_FIELDS = [
  "cabezaFamilia", "siervo", "anciano", "oracion",
  "presidenteEntreSemana", "discursoEntreSemana", "busquemosPerlas", "lecturaBiblia",
  "empieceConversaciones", "hagaRevisitas", "hagaDiscipulos", "expliqueCreencias",
  "discursoEnsenanza", "ayudanteEnsenanza", "analisisAuditorio",
  "discursoAnalisis", "ebc", "lectorEbc",
  "presidenteFinSemana", "conductorAtalaya", "lectorAtalaya", "hospitalidad",
] as const;

function rowToPublisher(r: Record<string, unknown>): Publisher {
  const pub: Publisher = {
    id: String(r.id),
    congregationId: String(r.congregationId),
    nombre: String(r.nombre),
    apellido: r.apellido ? String(r.apellido) : undefined,
    sexo: String(r.sexo),
    activo: Boolean(r.activo),
    apuntes: r.apuntes ? String(r.apuntes) : undefined,
    celular: r.celular ? String(r.celular) : undefined,
    telefono: r.telefono ? String(r.telefono) : undefined,
    email: r.email ? String(r.email) : undefined,
    userId: r.userId ? String(r.userId) : undefined,
    familiaId: r.familiaId ? String(r.familiaId) : null,
    ministroCampo: r.ministroCampo ? String(r.ministroCampo) : undefined,
    sala: r.sala ? String(r.sala) : "todas",
    createdAt: r.createdAt ? String(r.createdAt) : new Date().toISOString(),
  };
  for (const f of BOOL_FIELDS) {
    const col = f.replace(/([A-Z])/g, "_$1").toLowerCase();
    (pub as unknown as Record<string, unknown>)[f] = Boolean(r[col] ?? r[f]);
  }
  return pub;
}

function publisherToRow(pub: Partial<Publisher>): Record<string, unknown> {
  const row: Record<string, unknown> = {};
  if (pub.nombre !== undefined) row.nombre = pub.nombre;
  if (pub.apellido !== undefined) row.apellido = pub.apellido;
  if (pub.sexo !== undefined) row.sexo = pub.sexo;
  if (pub.activo !== undefined) row.activo = pub.activo;
  if (pub.apuntes !== undefined) row.apuntes = pub.apuntes;
  if (pub.celular !== undefined) row.celular = pub.celular;
  if (pub.telefono !== undefined) row.telefono = pub.telefono;
  if (pub.email !== undefined) row.email = pub.email;
  if (pub.familiaId !== undefined) row.familiaId = pub.familiaId;
  if (pub.cabezaFamilia !== undefined) row.cabeza_familia = pub.cabezaFamilia;
  if (pub.ministroCampo !== undefined) row.ministro_campo = pub.ministroCampo;
  if (pub.siervo !== undefined) row.siervo = pub.siervo;
  if (pub.anciano !== undefined) row.anciano = pub.anciano;
  if (pub.oracion !== undefined) row.oracion = pub.oracion;
  if (pub.presidenteEntreSemana !== undefined) row.presidente_entre_semana = pub.presidenteEntreSemana;
  if (pub.discursoEntreSemana !== undefined) row.discurso_entre_semana = pub.discursoEntreSemana;
  if (pub.busquemosPerlas !== undefined) row.busquemos_perlas = pub.busquemosPerlas;
  if (pub.lecturaBiblia !== undefined) row.lectura_biblia = pub.lecturaBiblia;
  if (pub.empieceConversaciones !== undefined) row.empiece_conversaciones = pub.empieceConversaciones;
  if (pub.hagaRevisitas !== undefined) row.haga_revisitas = pub.hagaRevisitas;
  if (pub.hagaDiscipulos !== undefined) row.haga_discipulos = pub.hagaDiscipulos;
  if (pub.expliqueCreencias !== undefined) row.explique_crencas = pub.expliqueCreencias;
  if (pub.discursoEnsenanza !== undefined) row.discurso_ensenanza = pub.discursoEnsenanza;
  if (pub.ayudanteEnsenanza !== undefined) row.ayudante_ensenanza = pub.ayudanteEnsenanza;
  if (pub.analisisAuditorio !== undefined) row.analisis_auditorio = pub.analisisAuditorio;
  if (pub.discursoAnalisis !== undefined) row.discurso_analisis = pub.discursoAnalisis;
  if (pub.ebc !== undefined) row.ebc = pub.ebc;
  if (pub.lectorEbc !== undefined) row.lector_ebc = pub.lectorEbc;
  if (pub.sala !== undefined) row.sala = pub.sala;
  if (pub.presidenteFinSemana !== undefined) row.presidente_fin_semana = pub.presidenteFinSemana;
  if (pub.conductorAtalaya !== undefined) row.conductor_atalaya = pub.conductorAtalaya;
  if (pub.lectorAtalaya !== undefined) row.lector_atalaya = pub.lectorAtalaya;
  if (pub.hospitalidad !== undefined) row.hospitalidad = pub.hospitalidad;
  return row;
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
  data: Partial<Publisher>
): Promise<Publisher> {
  const pub: Publisher = {
    id: randomUUID(),
    congregationId,
    nombre: data.nombre ?? "",
    apellido: data.apellido,
    sexo: data.sexo ?? "M",
    activo: true,
    apuntes: data.apuntes,
    celular: data.celular,
    telefono: data.telefono,
    email: data.email,
    familiaId: data.familiaId ?? null,
    cabezaFamilia: data.cabezaFamilia ?? false,
    ministroCampo: data.ministroCampo,
    siervo: data.siervo ?? false,
    anciano: data.anciano ?? false,
    oracion: data.oracion ?? false,
    presidenteEntreSemana: data.presidenteEntreSemana ?? false,
    discursoEntreSemana: data.discursoEntreSemana ?? false,
    busquemosPerlas: data.busquemosPerlas ?? false,
    lecturaBiblia: data.lecturaBiblia ?? false,
    empieceConversaciones: data.empieceConversaciones ?? false,
    hagaRevisitas: data.hagaRevisitas ?? false,
    hagaDiscipulos: data.hagaDiscipulos ?? false,
    expliqueCreencias: data.expliqueCreencias ?? false,
    discursoEnsenanza: data.discursoEnsenanza ?? false,
    ayudanteEnsenanza: data.ayudanteEnsenanza ?? false,
    analisisAuditorio: data.analisisAuditorio ?? false,
    discursoAnalisis: data.discursoAnalisis ?? false,
    ebc: data.ebc ?? false,
    lectorEbc: data.lectorEbc ?? false,
    sala: data.sala ?? "todas",
    presidenteFinSemana: data.presidenteFinSemana ?? false,
    conductorAtalaya: data.conductorAtalaya ?? false,
    lectorAtalaya: data.lectorAtalaya ?? false,
    hospitalidad: data.hospitalidad ?? false,
    createdAt: new Date().toISOString(),
  };

  if (isDbConfigured()) {
    try {
      const db = getDb();
      if (db) {
        const row = publisherToRow(pub);
        row.id = pub.id;
        row.congregationId = pub.congregationId;
        await db.insert(publishersTable).values(row as any);
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
  data: Partial<Publisher>
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

        const sets = publisherToRow(data);
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
  Object.assign(pub, data);
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

export function seedPublishers(congregationId: string): void {
  if ((memPublishers.get(congregationId) ?? []).length > 0) return;
  const names = [
    { nombre: "Carlos", apellido: "Méndez", sexo: "M", anciano: true },
    { nombre: "Luis", apellido: "Rodríguez", sexo: "M", siervo: true },
    { nombre: "María", apellido: "García", sexo: "F" },
    { nombre: "Ana", apellido: "López", sexo: "F" },
    { nombre: "Pedro", apellido: "Sánchez", sexo: "M" },
  ];
  for (const n of names) {
    const pub: Publisher = {
      id: randomUUID(),
      congregationId,
      nombre: n.nombre,
      apellido: n.apellido,
      sexo: n.sexo,
      activo: true,
      anciano: n.anciano ?? false,
      siervo: n.siervo ?? false,
      sala: "todas",
      createdAt: new Date().toISOString(),
    };
    const list = memPublishers.get(congregationId) ?? [];
    list.push(pub);
    memPublishers.set(congregationId, list);
  }
}
