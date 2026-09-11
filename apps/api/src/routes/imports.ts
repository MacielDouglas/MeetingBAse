import type { FastifyInstance } from "fastify";
import { createWriteStream, mkdirSync } from "node:fs";
import { join } from "node:path";
import { pipeline } from "node:stream/promises";
import { unlink } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import { congIdParam, confirmBody, jobParam, isJwpubFilename, MAX_JWPUB_BYTES } from "../lib/validators.js";
import { parsePubFile } from "../lib/parsePub.js";
import { createJob, getJob, confirmJob } from "../lib/importStore.js";

// Fase 1: upload .jwpub -> loadPub -> preview -> confirm -> meetings draft.
// Room always A. Neon persistence comes in Fase 2 (TODO).
// Temporarios siempre en D:\temp (nunca os.tmpdir / C:).

const MB_TMP_DIR = "D:\\temp";

function ensureTmpDir() {
  mkdirSync(MB_TMP_DIR, { recursive: true });
}

export async function importsRoutes(app: FastifyInstance) {
  app.post("/c/:id/imports", async (req, reply) => {
    const params = congIdParam.safeParse(req.params);
    if (!params.success) return reply.code(400).send({ error: "Congregación inválida" });

    const file = await req.file();
    if (!file) return reply.code(400).send({ error: "Seleccione un archivo .jwpub" });
    if (!isJwpubFilename(file.filename)) {
      return reply.code(400).send({ error: "Solo se aceptan archivos .jwpub" });
    }

    const tmpPath = join(MB_TMP_DIR, `mb-${randomUUID()}.jwpub`);
    ensureTmpDir();
    let bytes = 0;
    file.file.on("data", (c: Buffer) => {
      bytes += c.length;
    });
    await pipeline(file.file, createWriteStream(tmpPath));
    try {
      if (bytes > MAX_JWPUB_BYTES) {
        return reply.code(413).send({ error: "Archivo muy grande (máx. 25 MB)" });
      }
      const parsed = await parsePubFile(tmpPath, file.filename);
      const job = createJob(params.data.id, parsed);
      return reply.code(201).send({
        job_id: job.id,
        kind: job.kind,
        filename: job.filename,
        weeks: job.weeks.map((w) => ({
          index: w.index,
          fecha: w.fecha,
          tipo: w.tipo,
          semana: w.semanaLabel,
          lectura: w.lecturaSemanal ?? w.tituloAtalaya ?? "",
          parts_count: w.parts.length,
          needs_review: w.parts.filter((p) => p.needsReview).length,
        })),
      });
    } catch (e) {
      const msg = e instanceof Error ? e.message : "No se pudo procesar el archivo";
      return reply.code(422).send({ error: msg });
    } finally {
      await unlink(tmpPath).catch(() => {});
    }
  });

  app.get("/imports/:job", async (req, reply) => {
    const p = jobParam.safeParse(req.params);
    if (!p.success) return reply.code(400).send({ error: "Importación inválida" });
    const job = getJob(p.data.job);
    if (!job) return reply.code(404).send({ error: "Importación no encontrada" });
    return { job_id: job.id, estado: job.estado, kind: job.kind, weeks: job.weeks };
  });

  app.post("/imports/:job/confirm", async (req, reply) => {
    const p = jobParam.safeParse(req.params);
    if (!p.success) return reply.code(400).send({ error: "Importación inválida" });
    const body = confirmBody.safeParse(req.body ?? {});
    if (!body.success) return reply.code(400).send({ error: "Datos inválidos" });

    const job = confirmJob(p.data.job, body.data.weeks);
    if (!job) return reply.code(404).send({ error: "Importación no encontrada o ya confirmada" });

    // Draft meetings shaped like Neon rows (persist in Fase 2).
    const meetings = job.weeks.map((w) => ({
      id: randomUUID(),
      congregation_id: job.congregationId,
      import_id: job.id,
      fecha: w.fecha,
      tipo: w.tipo,
      lectura_semanal: w.lecturaSemanal ?? null,
      titulo_atalaya: w.tituloAtalaya ?? null,
      cancion_inicial: w.cancionInicial ?? null,
      cancion_intermedia: w.cancionIntermedia ?? null,
      cancion_final: w.cancionFinal ?? null,
      semana_label: w.semanaLabel,
      estado: "draft",
      sala: "A",
      parts: w.parts,
    }));
    return reply.code(201).send({ job_id: job.id, estado: job.estado, meetings });
  });
}
