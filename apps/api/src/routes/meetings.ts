import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { assignBody, congIdParam } from "../lib/validators.js";

// Fase 1: stubs shaped like final contracts. Assign stays online-only.

export async function meetingsRoutes(app: FastifyInstance) {
  app.get("/c/:id/meetings", async (req, reply) => {
    const p = congIdParam.safeParse(req.params);
    if (!p.success) return reply.code(400).send({ error: "Congregación inválida" });
    // TODO Fase 2: list from Neon (meetings draft + published).
    return { meetings: [], pendiente_fase2: true };
  });

  app.post("/c/:id/meetings/:mid/publish", async (req, reply) => {
    const p = z
      .object({ id: z.string().uuid(), mid: z.string().uuid() })
      .safeParse(req.params);
    if (!p.success) return reply.code(400).send({ error: "Datos inválidos" });
    // TODO Fase 2: flip estado draft -> published in Neon.
    return { published: false, pendiente_fase2: true };
  });

  app.post("/c/:id/parts/:partId/assign", async (req, reply) => {
    const body = assignBody.safeParse(req.body);
    if (!body.success) return reply.code(400).send({ error: "Datos inválidos" });
    if (body.data.titular_id === body.data.ayudante_id && body.data.ayudante_id) {
      return reply.code(422).send({ error: "El titular y el ayudante deben ser distintos" });
    }
    // TODO Fase 2: transacción Neon + warnings suaves. Sala siempre A.
    return { assignment: null, warnings: [], pendiente_fase2: true };
  });
}
