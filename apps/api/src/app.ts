import Fastify from "fastify";
import multipart from "@fastify/multipart";
import { importsRoutes } from "./routes/imports.js";
import { meetingsRoutes } from "./routes/meetings.js";
import { syncRoutes } from "./routes/sync.js";

// Fase 2B: app construído via função para permitir teste HTTP
// com inject (sem subir porta). Index só escuta.

export async function buildApp() {
  const app = Fastify({ logger: false });

  await app.register(multipart, {
    limits: { fileSize: 25 * 1024 * 1024, files: 1 },
  });

  app.get("/salud", async () => ({ ok: true, fase: "2B" }));

  await app.register(importsRoutes);
  await app.register(meetingsRoutes);
  await app.register(syncRoutes);

  return app;
}
