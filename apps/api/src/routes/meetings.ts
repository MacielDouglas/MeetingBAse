import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { assignBody, congIdParam, meetingParam, prayerBody } from "../lib/validators.js";
import { listMeetings } from "../lib/repoNeon.js";
import { listMemDetailed } from "../lib/assignStore.js";
import { listPrayers, upsertPrayer } from "../lib/prayersStore.js";
import { publisherHistory, suggestCandidates, suggestHelpers } from "../lib/suggest.js";
import { assignPart, publishMeetingFlow } from "../lib/assignFlow.js";

// Fase 2B: GET real (contrato 2A preservado) + assign transacional
// + publish draft -> published. Sala siempre A. Designar exige
// online (validação no servidor; mobile trata erro de rede).

const uuidMsg = "Datos inválidos";

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
      // cai a memoria abaixo
    }
    reply.header("x-persistencia", "memoria");
    return { meetings: listMemDetailed(p.data.id), persistencia: "memoria" };
  });

  // 409 se já published (escolha documentada em docs/FASE2B.md).
  app.post("/c/:id/meetings/:mid/publish", async (req, reply) => {
    const p = z
      .object({
        id: z.string().uuid({ message: uuidMsg }),
        mid: z.string().uuid({ message: uuidMsg }),
      })
      .safeParse(req.params);
    if (!p.success) return reply.code(400).send({ error: uuidMsg });
    const out = await publishMeetingFlow(p.data.id, p.data.mid);
    return reply.code(out.status).send(out.body);
  });

  app.post("/c/:id/parts/:partId/assign", async (req, reply) => {    const p = z
      .object({
        id: z.string().uuid({ message: uuidMsg }),
        partId: z.string().uuid({ message: uuidMsg }),
      })
      .safeParse(req.params);
    if (!p.success) return reply.code(400).send({ error: uuidMsg });
    const body = assignBody.safeParse(req.body);
    if (!body.success) return reply.code(400).send({ error: uuidMsg });
    const ayudante = body.data.ayudante_id ?? null;
    if (ayudante && body.data.titular_id === ayudante) {
      return reply
        .code(422)
        .send({ error: "El titular y el ayudante deben ser distintos" });
    }
    const out = await assignPart(
      p.data.id,
      p.data.partId,
      body.data.titular_id,
      ayudante
    );
    return reply.code(out.status).send(out.body);
  });

  // Fase 10: oraciones (inicial/final) por reunión.
  app.get("/c/:id/meetings/:mid/prayers", async (req, reply) => {
    const p = meetingParam.safeParse(req.params);
    if (!p.success) return reply.code(400).send({ error: "Datos inválidos" });
    const prayers = await listPrayers(p.data.id, p.data.mid);
    return { prayers };
  });

  app.post("/c/:id/meetings/:mid/prayers", async (req, reply) => {
    const p = meetingParam.safeParse(req.params);
    if (!p.success) return reply.code(400).send({ error: "Datos inválidos" });
    const body = prayerBody.safeParse(req.body ?? {});
    if (!body.success) return reply.code(400).send({ error: body.error.issues[0].message });
    const prayer = await upsertPrayer(p.data.id, p.data.mid, body.data.tipo, body.data.publisher_id);
    return reply.code(201).send({ prayer });
  });

  // Fase 13: historial de designações de um publicador.
  app.get("/c/:id/publishers/:pid/history", async (req, reply) => {
    const p = z
      .object({
        id: z.string().uuid({ message: uuidMsg }),
        pid: z.string().uuid({ message: uuidMsg }),
      })
      .safeParse(req.params);
    if (!p.success) return reply.code(400).send({ error: uuidMsg });
    const history = await publisherHistory(p.data.id, p.data.pid);
    return { history };
  });

  // Fase 13: candidatos sugeridos para uma parte (ordenados).
  app.post("/c/:id/parts/:partId/suggest", async (req, reply) => {
    const p = z
      .object({
        id: z.string().uuid({ message: uuidMsg }),
        partId: z.string().uuid({ message: uuidMsg }),
      })
      .safeParse(req.params);
    if (!p.success) return reply.code(400).send({ error: uuidMsg });
    const candidates = await suggestCandidates(p.data.id, p.data.partId);
    return { candidates };
  });

  // Sugerir ajudantes para uma parte que requer helper (mesmo sexo/família).
  app.post("/c/:id/parts/:partId/suggest-helpers", async (req, reply) => {
    const p = z
      .object({
        id: z.string().uuid({ message: uuidMsg }),
        partId: z.string().uuid({ message: uuidMsg }),
      })
      .safeParse(req.params);
    if (!p.success) return reply.code(400).send({ error: uuidMsg });
    const body = z
      .object({ titular_id: z.string().uuid({ message: uuidMsg }) })
      .safeParse(req.body ?? {});
    if (!body.success) return reply.code(400).send({ error: uuidMsg });
    const candidates = await suggestHelpers(p.data.id, p.data.partId, body.data.titular_id);
    return { candidates };
  });
}
