import type { FastifyInstance } from "fastify";
import { congIdParam } from "../lib/validators.js";
import { syncCongregation } from "../lib/assignFlow.js";

// Fase 2B: sync real para leitura offline (SQLite).
// Best-effort: meetings/parts sem coluna de data vêm completos
// com `filtrado: false`; assignments/warnings filtram por data
// quando `since` é válido. Nunca 500 por `since` inválido.

export async function syncRoutes(app: FastifyInstance) {
  app.get("/c/:id/sync", async (req, reply) => {
    const p = congIdParam.safeParse(req.params);
    if (!p.success) return reply.code(400).send({ error: "Congregación inválida" });
    try {
      const since = (req.query as { since?: unknown })?.since;
      const payload = await syncCongregation(
        p.data.id,
        typeof since === "string" ? since : null
      );
      return payload;
    } catch {
      // Nunca 500: snapshot vazio documentado.
      return {
        since: null,
        meetings: [],
        parts: [],
        assignments: [],
        warnings: [],
        prayers: [],
        unavailability: [],
        filtrado: false,
        persistencia: "memoria" as const,
      };
    }
  });
}
