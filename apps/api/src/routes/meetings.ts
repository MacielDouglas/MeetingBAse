import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { assignBody, congIdParam } from "../lib/validators.js";
import { listConfirmedMeetings } from "../lib/importStore.js";
import { listMeetings } from "../lib/repoNeon.js";

// Fase 2A: GET real (Neon primero, memoria despues). Assign sigue
// online-only y queda para la 2B (transaccion + warnings activos).

export async function meetingsRoutes(app: FastifyInstance) {
  app.get("/c/:id/meetings", async (req, reply) => {
    const p = congIdParam.safeParse(req.params);
    if (!p.success) return reply.code(400).send({ error: "Congregación inválida" });

    try {
      const res = await listMeetings(p.data.id);
      if (res.ok) {
        reply.header("x-persistencia", "neon");
        return { meetings: res.meetings, persistencia: "neon" };
      }
    } catch {
      // cae a memoria abajo
    }
    const mem = listConfirmedMeetings(p.data.id).map((m) => ({
      id: m.id,
      congregation_id: m.congregation_id,
      import_id: m.import_id,
      fecha: m.fecha,
      tipo: m.tipo,
      semana_label: m.semana_label ?? null,
      estado: m.estado,
      sala: "A" as const,
      parts_count: m.parts.length,
      parts: m.parts.map((x, i) => ({
        id: `${m.id}#${i + 1}`,
        orden: x.orden,
        seccion: x.seccion,
        tipo_clave: x.tipoClave,
        titulo: x.titulo,
        sala: "A" as const,
        requiere_ayudante: x.requiereAyudante,
        needs_review: x.needsReview ?? false,
      })),
    }));
    reply.header("x-persistencia", "memoria");
    return { meetings: mem, persistencia: "memoria" };
  });

  app.post("/c/:id/meetings/:mid/publish", async (req, reply) => {
    const p = z
      .object({ id: z.string().uuid(), mid: z.string().uuid() })
      .safeParse(req.params);
    if (!p.success) return reply.code(400).send({ error: "Datos inválidos" });
    // Fase 2B: flip estado draft -> published en Neon.
    return { published: false, pendiente_fase2b: true };
  });

  app.post("/c/:id/parts/:partId/assign", async (req, reply) => {
    const body = assignBody.safeParse(req.body);
    if (!body.success) return reply.code(400).send({ error: "Datos inválidos" });
    if (body.data.titular_id === body.data.ayudante_id && body.data.ayudante_id) {
      return reply.code(422).send({ error: "El titular y el ayudante deben ser distintos" });
    }
    // Fase 2B: transacción Neon + warnings suaves. Sala siempre A.
    return { assignment: null, warnings: [], pendiente_fase2b: true };
  });
}
