import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { registerUser, loginUser, seedAdmin } from "../lib/auth.js";

const loginBody = z.object({
  email: z.string().email({ message: "Email inválido" }),
  password: z.string().min(4, { message: "Contraseña mínima 4 caracteres" }),
});

const registerBody = z.object({
  email: z.string().email({ message: "Email inválido" }),
  password: z.string().min(4, { message: "Contraseña mínima 4 caracteres" }),
  nombre: z.string().min(1, { message: "Nombre requerido" }),
  congregation_id: z.string().uuid({ message: "Congregación inválida" }),
});

export async function authRoutes(app: FastifyInstance) {
  // Seed admin on startup (dev only)
  await seedAdmin();

  app.post("/auth/login", async (req, reply) => {
    const body = loginBody.safeParse(req.body);
    if (!body.success) {
      return reply.code(400).send({ error: body.error.issues[0].message });
    }
    try {
      const result = await loginUser(body.data.email, body.data.password);
      return reply.code(200).send(result);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Error al iniciar sesión";
      return reply.code(401).send({ error: msg });
    }
  });

  app.post("/auth/register", async (req, reply) => {
    const body = registerBody.safeParse(req.body);
    if (!body.success) {
      return reply.code(400).send({ error: body.error.issues[0].message });
    }
    try {
      const user = await registerUser(
        body.data.email,
        body.data.password,
        body.data.nombre,
        body.data.congregation_id
      );
      return reply.code(201).send({ user });
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Error al registrar";
      return reply.code(422).send({ error: msg });
    }
  });

  app.get("/auth/me", async (req, reply) => {
    const auth = req.headers.authorization;
    if (!auth?.startsWith("Bearer ")) {
      return reply.code(401).send({ error: "No autenticado" });
    }
    const { verifyToken } = await import("../lib/auth.js");
    const user = verifyToken(auth.slice(7));
    if (!user) {
      return reply.code(401).send({ error: "Token inválido" });
    }
    return { user };
  });
}
