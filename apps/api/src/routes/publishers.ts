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

const boolField = z.boolean().optional();

const publisherBody = z.object({
  nombre: z.string().min(1, { message: "Nombre requerido" }),
  apellido: z.string().optional(),
  sexo: z.enum(["M", "F"], { message: "Sexo: M o F" }),
  apuntes: z.string().optional(),
  celular: z.string().optional(),
  telefono: z.string().optional(),
  email: z.string().email().optional(),
  familiaId: z.string().uuid().nullable().optional(),
  cabezaFamilia: boolField,
  ministroCampo: z.string().optional(),
  siervo: boolField,
  anciano: boolField,
  oracion: boolField,
  presidenteEntreSemana: boolField,
  discursoEntreSemana: boolField,
  busquemosPerlas: boolField,
  lecturaBiblia: boolField,
  empieceConversaciones: boolField,
  hagaRevisitas: boolField,
  hagaDiscipulos: boolField,
  expliqueCreencias: boolField,
  discursoEnsenanza: boolField,
  ayudanteEnsenanza: boolField,
  analisisAuditorio: boolField,
  discursoAnalisis: boolField,
  ebc: boolField,
  lectorEbc: boolField,
  sala: z.string().optional(),
  presidenteFinSemana: boolField,
  conductorAtalaya: boolField,
  lectorAtalaya: boolField,
  hospitalidad: boolField,
});

const updateBody = publisherBody.partial().extend({
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
