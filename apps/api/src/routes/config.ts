import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { congIdParam } from "../lib/validators.js";

// Fase 12 — configuração de reuniões: horários, eventos especiais, exceções.
// Armazenamento em memória (fallback Neon na Fase 13).

const uuidMsg = "Datos inválidos";

// ── Tipos ──

export interface MeetingConfigRow {
  id: string;
  congregationId: string;
  midweekDay: number;
  midweekTime: string;
  weekendDay: number;
  weekendTime: string;
}

export interface SpecialEventRow {
  id: string;
  congregationId: string;
  tipo: string;
  titulo: string;
  fechaInicio: string;
  fechaFin?: string | null;
  horaInicio?: string | null;
  notas?: string | null;
}

export interface ScheduleExceptionRow {
  id: string;
  congregationId: string;
  fecha: string;
  tipo: string;
  horaInicio?: string | null;
  notas?: string | null;
}

// ── Armazenamento em memória ──

const configs = new Map<string, MeetingConfigRow>();
const events = new Map<string, SpecialEventRow[]>();
const exceptions = new Map<string, ScheduleExceptionRow[]>();

function genId(): string {
  return crypto.randomUUID();
}

// ── Config ──

export function getMeetingConfig(congId: string): MeetingConfigRow | null {
  return configs.get(congId) ?? null;
}

export function upsertMeetingConfig(
  congId: string,
  data: { midweekDay: number; midweekTime: string; weekendDay: number; weekendTime: string }
): MeetingConfigRow {
  const existing = configs.get(congId);
  const row: MeetingConfigRow = {
    id: existing?.id ?? genId(),
    congregationId: congId,
    midweekDay: data.midweekDay,
    midweekTime: data.midweekTime,
    weekendDay: data.weekendDay,
    weekendTime: data.weekendTime,
  };
  configs.set(congId, row);
  return row;
}

// ── Eventos especiais ──

export function listSpecialEvents(congId: string): SpecialEventRow[] {
  return (events.get(congId) ?? []).slice().sort((a, b) =>
    a.fechaInicio < b.fechaInicio ? -1 : a.fechaInicio > b.fechaInicio ? 1 : 0
  );
}

export function createSpecialEvent(
  congId: string,
  data: Omit<SpecialEventRow, "id" | "congregationId">
): SpecialEventRow {
  const row: SpecialEventRow = { id: genId(), congregationId: congId, ...data };
  const list = events.get(congId) ?? [];
  list.push(row);
  events.set(congId, list);
  return row;
}

export function deleteSpecialEvent(congId: string, eventId: string): boolean {
  const list = events.get(congId) ?? [];
  const idx = list.findIndex((e) => e.id === eventId);
  if (idx < 0) return false;
  list.splice(idx, 1);
  events.set(congId, list);
  return true;
}

// ── Exceções de agenda ──

export function listScheduleExceptions(congId: string): ScheduleExceptionRow[] {
  return (exceptions.get(congId) ?? []).slice().sort((a, b) =>
    a.fecha < b.fecha ? -1 : a.fecha > b.fecha ? 1 : 0
  );
}

export function createScheduleException(
  congId: string,
  data: Omit<ScheduleExceptionRow, "id" | "congregationId">
): ScheduleExceptionRow {
  const row: ScheduleExceptionRow = { id: genId(), congregationId: congId, ...data };
  const list = exceptions.get(congId) ?? [];
  list.push(row);
  exceptions.set(congId, list);
  return row;
}

export function deleteScheduleException(congId: string, exceptionId: string): boolean {
  const list = exceptions.get(congId) ?? [];
  const idx = list.findIndex((e) => e.id === exceptionId);
  if (idx < 0) return false;
  list.splice(idx, 1);
  exceptions.set(congId, list);
  return true;
}

// ── Rotas ──

const DAY_NAMES = ["", "Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sab"];

export async function configRoutes(app: FastifyInstance) {
  // GET /c/:id/config — retorna configuração + eventos + exceções
  app.get("/c/:id/config", async (req, reply) => {
    const p = congIdParam.safeParse(req.params);
    if (!p.success) return reply.code(400).send({ error: "Congregación inválida" });
    const config = getMeetingConfig(p.data.id);
    return {
      config: config ?? {
        midweekDay: 3,
        midweekTime: "19:00",
        weekendDay: 1,
        weekendTime: "10:00",
      },
      events: listSpecialEvents(p.data.id),
      exceptions: listScheduleExceptions(p.data.id),
    };
  });

  // PUT /c/:id/config — atualiza horários das reuniões
  app.put("/c/:id/config", async (req, reply) => {
    const p = congIdParam.safeParse(req.params);
    if (!p.success) return reply.code(400).send({ error: "Congregación inválida" });
    const body = z
      .object({
        midweekDay: z.number().min(1).max(7),
        midweekTime: z.string().regex(/^\d{1,2}:\d{2}$/),
        weekendDay: z.number().min(1).max(7),
        weekendTime: z.string().regex(/^\d{1,2}:\d{2}$/),
      })
      .safeParse(req.body);
    if (!body.success) return reply.code(400).send({ error: "Datos inválidos" });
    const config = upsertMeetingConfig(p.data.id, body.data);
    return { config };
  });

  // POST /c/:id/config/events — criar evento especial
  app.post("/c/:id/config/events", async (req, reply) => {
    const p = congIdParam.safeParse(req.params);
    if (!p.success) return reply.code(400).send({ error: "Congregación inválida" });
    const body = z
      .object({
        tipo: z.string().min(1),
        titulo: z.string().min(1),
        fechaInicio: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
        fechaFin: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
        horaInicio: z.string().regex(/^\d{1,2}:\d{2}$/).optional(),
        notas: z.string().optional(),
      })
      .safeParse(req.body);
    if (!body.success) return reply.code(400).send({ error: "Datos inválidos" });
    const event = createSpecialEvent(p.data.id, body.data);
    return reply.code(201).send({ event });
  });

  // DELETE /c/:id/config/events/:eventId — remover evento especial
  app.delete("/c/:id/config/events/:eventId", async (req, reply) => {
    const p = z
      .object({
        id: z.string().uuid({ message: uuidMsg }),
        eventId: z.string().uuid({ message: uuidMsg }),
      })
      .safeParse(req.params);
    if (!p.success) return reply.code(400).send({ error: uuidMsg });
    const ok = deleteSpecialEvent(p.data.id, p.data.eventId);
    if (!ok) return reply.code(404).send({ error: "Evento no encontrado" });
    return { ok: true };
  });

  // POST /c/:id/config/exceptions — criar exceção de agenda
  app.post("/c/:id/config/exceptions", async (req, reply) => {
    const p = congIdParam.safeParse(req.params);
    if (!p.success) return reply.code(400).send({ error: "Congregación inválida" });
    const body = z
      .object({
        fecha: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
        tipo: z.enum(["sin_reunion", "horario_modificado", "reunion_especial"]),
        horaInicio: z.string().regex(/^\d{1,2}:\d{2}$/).optional(),
        notas: z.string().optional(),
      })
      .safeParse(req.body);
    if (!body.success) return reply.code(400).send({ error: "Datos inválidos" });
    const exc = createScheduleException(p.data.id, body.data);
    return reply.code(201).send({ exception: exc });
  });

  // DELETE /c/:id/config/exceptions/:exceptionId — remover exceção
  app.delete("/c/:id/config/exceptions/:exceptionId", async (req, reply) => {
    const p = z
      .object({
        id: z.string().uuid({ message: uuidMsg }),
        exceptionId: z.string().uuid({ message: uuidMsg }),
      })
      .safeParse(req.params);
    if (!p.success) return reply.code(400).send({ error: uuidMsg });
    const ok = deleteScheduleException(p.data.id, p.data.exceptionId);
    if (!ok) return reply.code(404).send({ error: "Excepción no encontrada" });
    return { ok: true };
  });
}
