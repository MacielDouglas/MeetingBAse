import Fastify from "fastify";
import multipart from "@fastify/multipart";
import { authRoutes } from "./routes/auth.js";
import { publishersRoutes } from "./routes/publishers.js";
import { speakersRoutes } from "./routes/speakers.js";
import { importsRoutes } from "./routes/imports.js";
import { meetingsRoutes } from "./routes/meetings.js";
import { syncRoutes } from "./routes/sync.js";
import { generateRoutes } from "./routes/generate.js";
import { unavailabilityRoutes } from "./routes/unavailability.js";
import { configRoutes } from "./routes/config.js";
import { runMigrations } from "./lib/migrate.js";
import { authGuard } from "./lib/middleware.js";
import { rateLimit } from "./lib/rateLimit.js";
import { logger, logRequest, logError, logMigration } from "./lib/logger.js";

// Fase 5: app com auth middleware, auto-migrate, todos os endpoints protegidos.
// Fase 9: rate limiting, logging.

export async function buildApp() {
  const app = Fastify({ logger: false });

  // Request logging
  app.addHook("onResponse", (req, reply, done) => {
    const start = (req as unknown as { startTime?: number }).startTime;
    const ms = start ? Date.now() - start : 0;
    logRequest(req.method, req.url, reply.statusCode, ms);
    done();
  });

  app.addHook("onRequest", (req, _reply, done) => {
    (req as unknown as { startTime: number }).startTime = Date.now();
    done();
  });

  // Run SQL migrations on startup (idempotent, skips already applied)
  try {
    const result = await runMigrations();
    for (const f of result.applied) {
      logMigration(f, "applied");
    }
    for (const f of result.skipped) {
      logMigration(f, "skipped");
    }
  } catch (e) {
    logError("Migration error (non-fatal)", e);
  }

  await app.register(multipart, {
    limits: { fileSize: 25 * 1024 * 1024, files: 1 },
  });

  // Auth middleware on all requests (skips /salud, /auth/*)
  app.addHook("preHandler", authGuard);

  // Rate limiting (after auth to skip rate limiting for health checks)
  app.addHook("preHandler", rateLimit);

  app.get("/salud", async () => ({ ok: true, fase: "9" }));

  await app.register(authRoutes);
  await app.register(publishersRoutes);
  await app.register(speakersRoutes);
  await app.register(importsRoutes);
  await app.register(meetingsRoutes);
  await app.register(syncRoutes);
  await app.register(generateRoutes);
  await app.register(unavailabilityRoutes);
  await app.register(configRoutes);

  return app;
}
