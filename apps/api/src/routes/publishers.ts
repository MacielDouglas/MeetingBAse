import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { congIdParam } from "../lib/validators.js";
import {
  listPublishers,
  getPublisher,
  createPublisher,
  updatePublisher,
  deletePublisher,
  seedPublishers,
} from "../lib/publishersStore.js";

const publisherBody = z.object({
  nombre: z.string().min(1, { message: "Nombre requerido" }),
  sexo: z.enum(["M", "F"], { message: "Sexo: M o F" }),
  cargo: z.enum(["anciano", "siervo_ministerial", "publicador"]).optional(),
  telefono: z.string().optional(),
});

const updateBody = z.object({
  nombre: z.string().min(1).optional(),
  sexo: z.enum(["M", "F"]).optional(),
  cargo: z.enum(["anciano", "siervo_ministerial", "publicador"]).optional(),
  telefono: z.string().optional(),
  activo: z.boolean().optional(),
});

export async function publishersRoutes(app: FastifyInstance) {
  seedPublishers("00000000-0000-0000-0000-000000000000");

  app.get("/c/:id/publishers", async (req, reply) => {
    const params = congIdParam.safeParse(req.params);
    if (!params.success) return reply.code(400).send({ error: "Congregación inválida" });
    const pubs = await listPublishers(params.data.id);
    return { publishers: pubs };
  });

  app.get("/c/:id/publishers/:pid", async (req, reply) => {
    const params = congIdParam.safeParse(req.params);
    if (!params.success) return reply.code(400).send({ error: "Congregación inválida" });
    const pub = await getPublisher(params.data.id, (req.params as { pid: string }).pid);
    if (!pub) return reply.code(404).send({ error: "Publicador no encontrado" });
    return { publisher: pub };
  });

  app.post("/c/:id/publishers", async (req, reply) => {
    const params = congIdParam.safeParse(req.params);
    if (!params.success) return reply.code(400).send({ error: "Congregación inválida" });
    const body = publisherBody.safeParse(req.body);
    if (!body.success) {
      return reply.code(400).send({ error: body.error.issues[0].message });
    }
    const pub = await createPublisher(params.data.id, body.data);
    return reply.code(201).send({ publisher: pub });
  });

  app.put("/c/:id/publishers/:pid", async (req, reply) => {
    const params = congIdParam.safeParse(req.params);
    if (!params.success) return reply.code(400).send({ error: "Congregación inválida" });
    const body = updateBody.safeParse(req.body);
    if (!body.success) {
      return reply.code(400).send({ error: body.error.issues[0].message });
    }
    const pub = await updatePublisher(params.data.id, (req.params as { pid: string }).pid, body.data);
    if (!pub) return reply.code(404).send({ error: "Publicador no encontrado" });
    return { publisher: pub };
  });

  app.delete("/c/:id/publishers/:pid", async (req, reply) => {
    const params = congIdParam.safeParse(req.params);
    if (!params.success) return reply.code(400).send({ error: "Congregación inválida" });
    const ok = await deletePublisher(params.data.id, (req.params as { pid: string }).pid);
    if (!ok) return reply.code(404).send({ error: "Publicador no encontrado" });
    return { ok: true };
  });
}
