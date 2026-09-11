import Fastify from "fastify";
import multipart from "@fastify/multipart";
import { authRoutes } from "./routes/auth.js";
import { publishersRoutes } from "./routes/publishers.js";
import { speakersRoutes } from "./routes/speakers.js";
import { importsRoutes } from "./routes/imports.js";
import { meetingsRoutes } from "./routes/meetings.js";
import { syncRoutes } from "./routes/sync.js";
import { generateRoutes } from "./routes/generate.js";
import { runMigrations } from "./lib/migrate.js";

// Fase 5: app com auth, publishers, speakers, templates + auto-migrate.

export async function buildApp() {
  const app = Fastify({ logger: false });

  // Run SQL migrations on startup (idempotent, skips already applied)
  try {
    const result = await runMigrations();
    if (result.applied.length > 0) {
      console.log(`Migrations applied: ${result.applied.join(", ")}`);
    }
  } catch (e) {
    console.error("Migration error (non-fatal):", e instanceof Error ? e.message : e);
  }

  await app.register(multipart, {
    limits: { fileSize: 25 * 1024 * 1024, files: 1 },
  });

  app.get("/salud", async () => ({ ok: true, fase: "5" }));

  await app.register(authRoutes);
  await app.register(publishersRoutes);
  await app.register(speakersRoutes);
  await app.register(importsRoutes);
  await app.register(meetingsRoutes);
  await app.register(syncRoutes);
  await app.register(generateRoutes);

  return app;
}
