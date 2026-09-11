import Fastify from "fastify";
import multipart from "@fastify/multipart";
import { importsRoutes } from "./routes/imports.js";
import { meetingsRoutes } from "./routes/meetings.js";
import { syncRoutes } from "./routes/sync.js";

const app = Fastify({ logger: true });

await app.register(multipart, {
  limits: { fileSize: 25 * 1024 * 1024, files: 1 },
});

app.get("/salud", async () => ({ ok: true, fase: 1 }));

await app.register(importsRoutes);
await app.register(meetingsRoutes);
await app.register(syncRoutes);

const port = Number(process.env.PORT ?? 3001);
await app.listen({ port, host: "0.0.0.0" });
