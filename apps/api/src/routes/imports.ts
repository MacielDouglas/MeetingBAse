import type { FastifyInstance } from "fastify";
import { createWriteStream, mkdirSync } from "node:fs";
import { join } from "node:path";
import { pipeline } from "node:stream/promises";
import { rm } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import { congIdParam, confirmBody, jobParam, isJwpubFilename, MAX_JWPUB_BYTES } from "../lib/validators.js";
import { parsePubFile } from "../lib/parsePub.js";
import {
  createJob, getJob, confirmJob, saveConfirmedMeetings,
  removeJob, listUploaded, findDuplicate, mergeJobs,
} from "../lib/importStore.js";
import { saveConfirm } from "../lib/repoNeon.js";

// Fase 1: upload .jwpub -> loadPub -> preview -> confirm -> meetings draft.
// Multi-file: mwb, w, s34, sjj. Duplicate detection per kind.
// Temporarios siempre en D:\temp (nunca os.tmpdir / C:).

const MB_TMP_DIR = "D:\\temp";

function ensureTmpDir(dir: string) {
  mkdirSync(dir, { recursive: true });
}

function safeFilename(name: string): string {
  const base = name.split(/[\\/]/).pop() ?? "upload.jwpub";
  return base.replace(/[^A-Za-z0-9._()-]/g, "_");
}

export async function importsRoutes(app: FastifyInstance) {
  // Upload a .jwpub file. Returns preview with duplicate check.
  app.post("/c/:id/imports", async (req, reply) => {
    const params = congIdParam.safeParse(req.params);
    if (!params.success) return reply.code(400).send({ error: "Congregación inválida" });

    const file = await req.file();
    if (!file) return reply.code(400).send({ error: "Seleccione un archivo .jwpub" });
    if (!isJwpubFilename(file.filename)) {
      return reply.code(400).send({ error: "Solo se aceptan archivos .jwpub" });
    }

    const tmpDir = join(MB_TMP_DIR, `mb-${randomUUID()}`);
    const tmpPath = join(tmpDir, safeFilename(file.filename));
    ensureTmpDir(tmpDir);
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

      // Duplicate check
      const dup = findDuplicate(params.data.id, parsed.kind);
      if (dup) {
        // Remove old job and replace
        removeJob(dup.jobId);
      }

      const job = createJob(params.data.id, parsed);
      const uploaded = listUploaded(params.data.id);
      return reply.code(201).send({
        job_id: job.id,
        kind: job.kind,
        filename: job.filename,
        replaced: !!dup,
        uploaded_files: uploaded.map((f) => ({
          filename: f.filename,
          kind: f.kind,
          uploaded_at: f.uploadedAt,
        })),
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
      await rm(tmpDir, { recursive: true, force: true }).catch(() => {});
    }
  });

  // List uploaded files for a congregation
  app.get("/c/:id/imports/files", async (req, reply) => {
    const params = congIdParam.safeParse(req.params);
    if (!params.success) return reply.code(400).send({ error: "Congregación inválida" });
    const files = listUploaded(params.data.id);
    return {
      files: files.map((f) => ({
        filename: f.filename,
        kind: f.kind,
        job_id: f.jobId,
        uploaded_at: f.uploadedAt,
      })),
    };
  });

  // Merge multiple jobs into complete meetings
  app.post("/c/:id/imports/merge", async (req, reply) => {
    const params = congIdParam.safeParse(req.params);
    if (!params.success) return reply.code(400).send({ error: "Congregación inválida" });

    const body = (req.body ?? {}) as { job_ids?: string[] };
    if (!Array.isArray(body.job_ids) || body.job_ids.length === 0) {
      return reply.code(400).send({ error: "Proporcione job_ids para fusionar" });
    }

    const merged = mergeJobs(body.job_ids);
    if (!merged) {
      return reply.code(404).send({ error: "No se encontraron importaciones para fusionar" });
    }

    return reply.code(201).send({
      job_id: merged.id,
      kind: merged.kind,
      filename: merged.filename,
      weeks: merged.weeks.map((w) => ({
        index: w.index,
        fecha: w.fecha,
        tipo: w.tipo,
        semana: w.semanaLabel,
        lectura: w.lecturaSemanal ?? w.tituloAtalaya ?? "",
        parts_count: w.parts.length,
        needs_review: w.parts.filter((p) => p.needsReview).length,
      })),
    });
  });

  // Delete a single uploaded file/job
  app.delete("/c/:id/imports/:job", async (req, reply) => {
    const params = congIdParam.safeParse(req.params);
    if (!params.success) return reply.code(400).send({ error: "Congregación inválida" });
    const p = jobParam.safeParse(req.params);
    if (!p.success) return reply.code(400).send({ error: "Importación inválida" });

    const removed = removeJob(p.data.job);
    if (!removed) return reply.code(404).send({ error: "Importación no encontrada" });
    const files = listUploaded(params.data.id);
    return { ok: true, uploaded_files: files.map((f) => ({ filename: f.filename, kind: f.kind })) };
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
      sala: "A" as const,
      hora_inicio: w.horaInicio ?? null,
      parts: w.parts.map((p) => ({ ...p, id: randomUUID() })),
    }));
    saveConfirmedMeetings(meetings);

    let persistencia: "neon" | "memoria" = "memoria";
    try {
      const saved = await saveConfirm(job, meetings);
      if (saved.ok) persistencia = "neon";
    } catch {
      persistencia = "memoria";
    }
    reply.header("x-persistencia", persistencia);
    return reply.code(201).send({ job_id: job.id, estado: job.estado, persistencia, meetings });
  });
}
