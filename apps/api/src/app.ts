import Fastify from "fastify";
import multipart from "@fastify/multipart";
import { authRoutes } from "./routes/auth.js";
import { publishersRoutes } from "./routes/publishers.js";
import { speakersRoutes } from "./routes/speakers.js";
import { importsRoutes } from "./routes/imports.js";
import { meetingsRoutes } from "./routes/meetings.js";
import { syncRoutes } from "./routes/sync.js";
import { generateRoutes } from "./routes/generate.js";

// Fase 4: app com auth, publishers, speakers, templates.

export async function buildApp() {
  const app = Fastify({ logger: false });

  await app.register(multipart, {
    limits: { fileSize: 25 * 1024 * 1024, files: 1 },
  });

  app.get("/salud", async () => ({ ok: true, fase: "4A" }));

  await app.register(authRoutes);
  await app.register(publishersRoutes);
  await app.register(speakersRoutes);
  await app.register(importsRoutes);
  await app.register(meetingsRoutes);
  await app.register(syncRoutes);
  await app.register(generateRoutes);

  return app;
}
