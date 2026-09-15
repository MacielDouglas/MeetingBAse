import { pgTable, uuid, text, integer, boolean, timestamp, date, uniqueIndex, index, check, jsonb } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

// Fase 0 — schema Neon Postgres. Sala A fixa. Alertas suaves via assignment_warnings.

export const congregations = pgTable("congregations", {
  id: uuid("id").defaultRandom().primaryKey(),
  nombre: text("nombre").notNull(),
  numero: text("numero"),
  circuito: text("circuito"),
  timezone: text("timezone").default("America/Santiago").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
});

export const users = pgTable("users", {
  id: uuid("id").defaultRandom().primaryKey(),
  congregationId: uuid("congregation_id").notNull(),
  email: text("email").notNull(),
  nombre: text("nombre").notNull(),
  rol: text("rol").notNull().default("publicador"),
  passwordHash: text("password_hash").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
});

export const publishers = pgTable("publishers", {
  id: uuid("id").defaultRandom().primaryKey(),
  congregationId: uuid("congregation_id").notNull(),
  userId: uuid("user_id"),
  nombre: text("nombre").notNull(),
  sexo: text("sexo").notNull(),
  cargo: text("cargo").notNull().default("publicador"),
  activo: boolean("activo").default(true).notNull(),
  telefono: text("telefono"),
  email: text("email"),
  familiaId: uuid("familia_id"),
}, (t) => ({ idx_pub_cong: index("idx_pub_cong").on(t.congregationId, t.activo) }));

export const meetings = pgTable("meetings", {
  id: uuid("id").defaultRandom().primaryKey(),
  congregationId: uuid("congregation_id").notNull(),
  importId: uuid("import_id"),
  fecha: date("fecha").notNull(),
  tipo: text("tipo").notNull(),
  lecturaSemanal: text("lectura_semanal"),
  cancionInicial: integer("cancion_inicial"),
  cancionIntermedia: integer("cancion_intermedia"),
  cancionFinal: integer("cancion_final"),
  tituloAtalaya: text("titulo_atalaya"),
  semanaLabel: text("semana_label"),
  estado: text("estado").default("draft").notNull(),
  version: integer("version").default(1).notNull(),
  horaInicio: text("hora_inicio"),
  excepcion: text("excepcion"), // null=normal, "convencao", "sin_reunion", "convencao_virtual"
  visitaCO: boolean("visita_co").default(false),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
}, (t) => ({ uq_meeting: uniqueIndex("uq_meeting").on(t.congregationId, t.fecha, t.tipo) }));

export const parts = pgTable("parts", {
  id: uuid("id").defaultRandom().primaryKey(),
  meetingId: uuid("meeting_id").notNull(),
  congregationId: uuid("congregation_id").notNull(),
  orden: integer("orden").notNull(),
  seccion: text("seccion").notNull(),
  tipoClave: text("tipo_clave").notNull(),
  titulo: text("titulo").notNull(),
  detalle: text("detalle"),
  duracionMin: integer("duracion_min"),
  sala: text("sala").default("A").notNull(),
  requiereAyudante: boolean("requiere_ayudante").default(false).notNull(),
  needsReview: boolean("needs_review").default(false).notNull(),
  horaInicio: text("hora_inicio"),
  horaFin: text("hora_fin"),
}, (t) => ({ uq_part_orden: uniqueIndex("uq_part_orden").on(t.meetingId, t.orden) }));

export const assignments = pgTable("assignments", {
  id: uuid("id").defaultRandom().primaryKey(),
  partId: uuid("part_id").notNull().unique(),
  meetingId: uuid("meeting_id").notNull(),
  congregationId: uuid("congregation_id").notNull(),
  titularId: uuid("titular_id").notNull(),
  ayudanteId: uuid("ayudante_id"),
  createdBy: uuid("created_by"),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
}, (t) => ({ ck_titular_ayudante: check("ck_titular_ayudante", sql`${t.titularId} != ${t.ayudanteId}`) }));

export const warnings = pgTable("assignment_warnings", {
  id: uuid("id").defaultRandom().primaryKey(),
  meetingId: uuid("meeting_id").notNull(),
  publisherId: uuid("publisher_id").notNull(),
  partId: uuid("part_id"),
  tipo: text("tipo").notNull(),
  mensajeEs: text("mensaje_es").notNull(),
  reconocidoPor: uuid("reconocido_por"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
}, (t) => ({ idx_warn_meeting: index("idx_warn_meeting").on(t.meetingId) }));

// Fase 10 — orações (inicial/final) por reunião.
export const prayers = pgTable("prayers", {
  id: uuid("id").defaultRandom().primaryKey(),
  meetingId: uuid("meeting_id").notNull(),
  congregationId: uuid("congregation_id").notNull(),
  tipo: text("tipo").notNull(),
  publisherId: uuid("publisher_id"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
}, (t) => ({ uq_prayer: uniqueIndex("uq_prayer").on(t.meetingId, t.tipo) }));

// Fase 11 — indisponibilidade de publicadores (períodos sem servir).
export const unavailability = pgTable("unavailability", {
  id: uuid("id").defaultRandom().primaryKey(),
  congregationId: uuid("congregation_id").notNull(),
  publisherId: uuid("publisher_id").notNull(),
  fechaInicio: date("fecha_inicio").notNull(),
  fechaFin: date("fecha_fin").notNull(),
  motivo: text("motivo"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
}, (t) => ({ idx_unav_pub: index("idx_unav_pub").on(t.congregationId, t.publisherId) }));

// Fase 1 — import jobs (.jwpub upload -> preview -> confirm).
export const imports = pgTable("imports", {
  id: uuid("id").defaultRandom().primaryKey(),
  congregationId: uuid("congregation_id").notNull(),
  filename: text("filename").notNull(),
  kind: text("kind").notNull(),
  estado: text("estado").default("preview").notNull(),
  weeksCount: integer("weeks_count").default(0).notNull(),
  createdBy: uuid("created_by"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
}, (t) => ({ idx_imports_cong: index("idx_imports_cong").on(t.congregationId) }));

// Fase 5 — oradores públicos + visitas.
export const speakers = pgTable("speakers", {
  id: uuid("id").defaultRandom().primaryKey(),
  congregationId: uuid("congregation_id").notNull(),
  nombre: text("nombre").notNull(),
  telefono: text("telefono"),
  celular: text("celular"),
  email: text("email"),
  talkNumbers: integer("talk_numbers").array().default([]).notNull(),
  activo: boolean("activo").default(true).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
}, (t) => ({ idx_speakers_cong: index("idx_speakers_cong").on(t.congregationId, t.activo) }));

export const visits = pgTable("visits", {
  id: uuid("id").defaultRandom().primaryKey(),
  congregationId: uuid("congregation_id").notNull(),
  speakerId: uuid("speaker_id").notNull(),
  fecha: date("fecha").notNull(),
  talkNumber: integer("talk_number"),
  notas: text("notas"),
  estado: text("estado").default("pendiente").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
}, (t) => ({ idx_visits_cong: index("idx_visits_cong").on(t.congregationId, t.fecha) }));

// Fase 5 — catalogs (sjj songs + S-34 public talks, persistent cache)
export const catalogs = pgTable("catalogs", {
  id: uuid("id").defaultRandom().primaryKey(),
  congregationId: uuid("congregation_id").notNull().references(() => congregations.id),
  kind: text("kind").notNull(),
  data: jsonb("data").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
}, (t) => ({ catalogsCongKind: uniqueIndex("catalogs_cong_kind_idx").on(t.congregationId, t.kind) }));
