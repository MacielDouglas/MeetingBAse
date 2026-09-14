import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { congIdParam } from "../lib/validators.js";
import {
  renderTemplate,
  meetingToVars,
  AVAILABLE_TEMPLATES,
  type TemplateVars,
  type TemplateRepeat,
} from "../lib/templateEngine.js";
import { listConfirmedMeetings, getSongCatalog, getTalkCatalog, loadCatalogsFromDb } from "../lib/importStore.js";
import { listSpeakers } from "../lib/speakersStore.js";
import { getAssignmentsWithNames } from "../lib/repoAssign.js";
import { fileURLToPath } from "node:url";

const TEMPLATES_DIR = join(
  fileURLToPath(new URL(".", import.meta.url)),
  "..",
  "lib",
  "templates"
);

const generateBody = z.object({
  template_id: z.string().min(1, { message: "Template requerido" }),
  meeting_id: z.string().uuid().optional(),
});

export async function generateRoutes(app: FastifyInstance) {
  app.get("/c/:id/templates", async (req, reply) => {
    const params = congIdParam.safeParse(req.params);
    if (!params.success) return reply.code(400).send({ error: "Congregación inválida" });
    return { templates: AVAILABLE_TEMPLATES };
  });

  app.post("/c/:id/generate", async (req, reply) => {
    const params = congIdParam.safeParse(req.params);
    if (!params.success) return reply.code(400).send({ error: "Congregación inválida" });

    const body = generateBody.safeParse(req.body);
    if (!body.success) {
      return reply.code(400).send({ error: body.error.issues[0].message });
    }

    const template = AVAILABLE_TEMPLATES.find((t) => t.id === body.data.template_id);
    if (!template) {
      return reply.code(404).send({ error: "Template no encontrado" });
    }

    let html: string;
    try {
      html = readFileSync(join(TEMPLATES_DIR, template.filename), "utf-8");
    } catch {
      return reply.code(500).send({ error: "Error al leer template" });
    }

    // Build vars from meeting or use empty
    let vars: TemplateVars = {
      CONGREGATION_TITLE: "Meeting Base",
      DATE: new Date().toLocaleDateString("es-ES"),
    };

    const repeats: TemplateRepeat[] = [];

    if (body.data.meeting_id) {
      const meetings = listConfirmedMeetings(params.data.id);
      const meeting = meetings.find((m) => m.id === body.data.meeting_id);
      if (meeting) {
        try {
          await loadCatalogsFromDb(params.data.id);
        } catch {
          // best-effort
        }
        const songs = getSongCatalog(params.data.id);
        const talks = getTalkCatalog(params.data.id);
        const assigns = await getAssignmentsWithNames(params.data.id, meeting.id);
        vars = { ...vars, ...meetingToVars(meeting as unknown as Record<string, unknown>, songs, talks, assigns) };
      }
    }

    // Add speakers for speaker templates
    if (template.id === "pt-speakers") {
      const speakers = await listSpeakers(params.data.id);
      repeats.push({
        key: "speakers",
        rows: speakers.map((s) => ({
          SPEAKER_NAME: s.nombre,
          SPEAKER_PHONE: s.telefono ?? "",
          SPEAKER_CELL: s.celular ?? "",
          SPEAKER_TALKS: s.talkNumbers.join(", "),
        })),
      });
    }

    const rendered = renderTemplate(html, vars, repeats);
    return reply
      .header("Content-Type", "text/html; charset=utf-8")
      .send(rendered);
  });

  // iCal export for all meetings in a congregation
  app.get("/c/:id/ical", async (req, reply) => {
    const params = congIdParam.safeParse(req.params);
    if (!params.success) return reply.code(400).send({ error: "Congregación inválida" });

    const meetings = listConfirmedMeetings(params.data.id);
    const published = meetings.filter((m) => m.estado === "published");

    const lines: string[] = [
      "BEGIN:VCALENDAR",
      "VERSION:2.0",
      "PRODID:-//Meeting Base//ES",
      "CALSCALE:GREGORIAN",
      "METHOD:PUBLISH",
      "X-WR-CALNAME:Meeting Base",
      "X-WR-TIMEZONE:America/Santiago",
    ];

    for (const m of published) {
      const dateStr = m.fecha.replace(/-/g, "");
      const parts = m.parts.map((p: { titulo: string }) => p.titulo).join(", ");
      const uid = `${m.id}@meeting-base`;
      lines.push(
        "BEGIN:VEVENT",
        `UID:${uid}`,
        `DTSTART;VALUE=DATE:${dateStr}`,
        `DTEND;VALUE=DATE:${dateStr}`,
        `SUMMARY:Reunión - ${m.tipo}`,
        `DESCRIPTION:${m.semana_label ?? ""}\\n${parts}`,
        "STATUS:CONFIRMED",
        "END:VEVENT"
      );
    }

    lines.push("END:VCALENDAR");

    const ical = lines.join("\r\n");
    return reply
      .header("Content-Type", "text/calendar; charset=utf-8")
      .header("Content-Disposition", 'attachment; filename="meeting-base.ics"')
      .send(ical);
  });
}
