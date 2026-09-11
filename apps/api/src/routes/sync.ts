import type { FastifyInstance } from "fastify";
import { congIdParam } from "../lib/validators.js";
import { isDbConfigured } from "../../../../packages/db/db.js";

// Offline-first read sync. Designar exige online (Fase 2B).

export async function syncRoutes(app: FastifyInstance) {
  app.get("/c/:id/sync", async (req, reply) => {
    const p = congIdParam.safeParse(req.params);
    if (!p.success) return reply.code(400).send({ error: "Congregación inválida" });
    const since = (req.query as { since?: string })?.since ?? null;
    const persistencia = isDbConfigured() ? "neon" : "memoria";
    return { since, meetings: [], parts: [], assignments: [], warnings: [], persistencia, pendiente_fase2: true };
  });
}
