import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { congIdParam } from "../lib/validators.js";
import {
  listSpeakers, getSpeaker, createSpeaker, updateSpeaker, deleteSpeaker,
  listVisits, createVisit, deleteVisit, updateVisit,
  seedSpeakers,
} from "../lib/speakersStore.js";

const speakerBody = z.object({
  nombre: z.string().min(1, { message: "Nombre requerido" }),
  telefono: z.string().optional(),
  celular: z.string().optional(),
  email: z.string().email().optional(),
  talk_numbers: z.array(z.number().int().min(1)).optional(),
});

const updateSpeakerBody = z.object({
  nombre: z.string().min(1).optional(),
  telefono: z.string().optional(),
  celular: z.string().optional(),
  email: z.string().email().optional(),
  talk_numbers: z.array(z.number().int().min(1)).optional(),
  activo: z.boolean().optional(),
});

const visitBody = z.object({
  speaker_id: z.string().uuid({ message: "Falante inválido" }),
  fecha: z.string().min(1, { message: "Fecha requerida" }),
  talk_number: z.number().int().min(1).optional(),
  notas: z.string().optional(),
});

const updateVisitBody = z.object({
  estado: z.enum(["pendiente", "confirmada", "realizada"]).optional(),
  notas: z.string().optional(),
});

export async function speakersRoutes(app: FastifyInstance) {
  seedSpeakers("00000000-0000-0000-0000-000000000000");

  // --- Speakers CRUD ---

  app.get("/c/:id/speakers", async (req, reply) => {
    const params = congIdParam.safeParse(req.params);
    if (!params.success) return reply.code(400).send({ error: "Congregación inválida" });
    return { speakers: await listSpeakers(params.data.id) };
  });

  app.get("/c/:id/speakers/:sid", async (req, reply) => {
    const params = congIdParam.safeParse(req.params);
    if (!params.success) return reply.code(400).send({ error: "Congregación inválida" });
    const s = await getSpeaker(params.data.id, (req.params as { sid: string }).sid);
    if (!s) return reply.code(404).send({ error: "Falante no encontrado" });
    return { speaker: s };
  });

  app.post("/c/:id/speakers", async (req, reply) => {
    const params = congIdParam.safeParse(req.params);
    if (!params.success) return reply.code(400).send({ error: "Congregación inválida" });
    const body = speakerBody.safeParse(req.body);
    if (!body.success) {
      return reply.code(400).send({ error: body.error.issues[0].message });
    }
    const s = await createSpeaker(params.data.id, {
      nombre: body.data.nombre,
      telefono: body.data.telefono,
      celular: body.data.celular,
      email: body.data.email,
      talkNumbers: body.data.talk_numbers,
    });
    return reply.code(201).send({ speaker: s });
  });

  app.put("/c/:id/speakers/:sid", async (req, reply) => {
    const params = congIdParam.safeParse(req.params);
    if (!params.success) return reply.code(400).send({ error: "Congregación inválida" });
    const body = updateSpeakerBody.safeParse(req.body);
    if (!body.success) {
      return reply.code(400).send({ error: body.error.issues[0].message });
    }
    const data: Record<string, unknown> = { ...body.data };
    if (data.talk_numbers !== undefined) {
      data.talkNumbers = data.talk_numbers;
      delete data.talk_numbers;
    }
    const s = await updateSpeaker(params.data.id, (req.params as { sid: string }).sid, data as Parameters<typeof updateSpeaker>[2]);
    if (!s) return reply.code(404).send({ error: "Falante no encontrado" });
    return { speaker: s };
  });

  app.delete("/c/:id/speakers/:sid", async (req, reply) => {
    const params = congIdParam.safeParse(req.params);
    if (!params.success) return reply.code(400).send({ error: "Congregación inválida" });
    const ok = await deleteSpeaker(params.data.id, (req.params as { sid: string }).sid);
    if (!ok) return reply.code(404).send({ error: "Falante no encontrado" });
    return { ok: true };
  });

  // --- Visits ---

  app.get("/c/:id/visits", async (req, reply) => {
    const params = congIdParam.safeParse(req.params);
    if (!params.success) return reply.code(400).send({ error: "Congregación inválida" });
    return { visits: await listVisits(params.data.id) };
  });

  app.post("/c/:id/visits", async (req, reply) => {
    const params = congIdParam.safeParse(req.params);
    if (!params.success) return reply.code(400).send({ error: "Congregación inválida" });
    const body = visitBody.safeParse(req.body);
    if (!body.success) {
      return reply.code(400).send({ error: body.error.issues[0].message });
    }
    const s = await getSpeaker(params.data.id, body.data.speaker_id);
    if (!s) return reply.code(404).send({ error: "Falante no encontrado" });
    const v = await createVisit(params.data.id, {
      speakerId: body.data.speaker_id,
      fecha: body.data.fecha,
      talkNumber: body.data.talk_number,
      notas: body.data.notas,
    });
    return reply.code(201).send({ visit: v });
  });

  app.put("/c/:id/visits/:vid", async (req, reply) => {
    const params = congIdParam.safeParse(req.params);
    if (!params.success) return reply.code(400).send({ error: "Congregación inválida" });
    const body = updateVisitBody.safeParse(req.body);
    if (!body.success) {
      return reply.code(400).send({ error: body.error.issues[0].message });
    }
    const v = await updateVisit(params.data.id, (req.params as { vid: string }).vid, body.data);
    if (!v) return reply.code(404).send({ error: "Visita no encontrada" });
    return { visit: v };
  });

  app.delete("/c/:id/visits/:vid", async (req, reply) => {
    const params = congIdParam.safeParse(req.params);
    if (!params.success) return reply.code(400).send({ error: "Congregación inválida" });
    const ok = await deleteVisit(params.data.id, (req.params as { vid: string }).vid);
    if (!ok) return reply.code(404).send({ error: "Visita no encontrada" });
    return { ok: true };
  });
}
