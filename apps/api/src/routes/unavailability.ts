import type { FastifyInstance } from "fastify";
import { congIdParam, unavailabilityBody } from "../lib/validators.js";
import {
  createUnavailability,
  deleteUnavailability,
  listUnavailability,
} from "../lib/unavailabilityStore.js";

// Fase 11: indisponibilidad de publicadores (periodos sin servir).
// GET acepta ?publisher_id= y ?fecha=AAAA-MM-DD (filtra solapamiento).

export async function unavailabilityRoutes(app: FastifyInstance) {
  app.get("/c/:id/unavailability", async (req, reply) => {
    const params = congIdParam.safeParse(req.params);
    if (!params.success) return reply.code(400).send({ error: "Congregación inválida" });
    const q = (req.query ?? {}) as { publisher_id?: unknown; fecha?: unknown };
    const rows = await listUnavailability(params.data.id, {
      publisherId: typeof q.publisher_id === "string" ? q.publisher_id : undefined,
      fecha: typeof q.fecha === "string" ? q.fecha : undefined,
    });
    return { unavailability: rows };
  });

  app.post("/c/:id/unavailability", async (req, reply) => {
    const params = congIdParam.safeParse(req.params);
    if (!params.success) return reply.code(400).send({ error: "Congregación inválida" });
    const body = unavailabilityBody.safeParse(req.body ?? {});
    if (!body.success) return reply.code(400).send({ error: body.error.issues[0].message });
    if (body.data.fecha_inicio > body.data.fecha_fin) {
      return reply.code(400).send({ error: "La fecha de inicio debe ser anterior al fin" });
    }
    const row = await createUnavailability({
      congregationId: params.data.id,
      publisherId: body.data.publisher_id,
      fechaInicio: body.data.fecha_inicio,
      fechaFin: body.data.fecha_fin,
      motivo: body.data.motivo ?? null,
    });
    return reply.code(201).send({ unavailability: row });
  });

  app.delete("/c/:id/unavailability/:uid", async (req, reply) => {
    const params = congIdParam.safeParse(req.params);
    if (!params.success) return reply.code(400).send({ error: "Congregación inválida" });
    const uid = (req.params as { uid?: string }).uid ?? "";
    const ok = await deleteUnavailability(params.data.id, uid);
    if (!ok) return reply.code(404).send({ error: "No encontrada" });
    return { ok: true };
  });
}
