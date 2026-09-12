import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { registerUser, loginUser, seedAdmin, listCongregations, createCongregation, updateUserProfile, resetPassword } from "../lib/auth.js";

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

const createCongregationBody = z.object({
  nombre: z.string().min(1, { message: "Nombre requerido" }),
  numero: z.string().optional(),
  circuito: z.string().optional(),
  timezone: z.string().default("America/Santiago"),
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

  // List congregations (public, for registration)
  app.get("/auth/congregations", async (_req, reply) => {
    try {
      const congregations = await listCongregations();
      return { congregations };
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Error al cargar congregaciones";
      return reply.code(500).send({ error: msg });
    }
  });

  // Update user profile
  app.put("/auth/profile", async (req, reply) => {
    const auth = req.headers.authorization;
    if (!auth?.startsWith("Bearer ")) {
      return reply.code(401).send({ error: "No autenticado" });
    }
    const { verifyToken } = await import("../lib/auth.js");
    const user = verifyToken(auth.slice(7));
    if (!user) {
      return reply.code(401).send({ error: "Token inválido" });
    }
    const body = z.object({
      nombre: z.string().min(1).optional(),
      email: z.string().email().optional(),
      password: z.string().min(4).optional(),
    }).safeParse(req.body);
    if (!body.success) {
      return reply.code(400).send({ error: body.error.issues[0].message });
    }
    try {
      const updated = await updateUserProfile(user.id, user.congregationId, body.data);
      return { user: updated };
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Error al actualizar perfil";
      return reply.code(422).send({ error: msg });
    }
  });

  // Create congregation (public, for registration)
  app.post("/auth/congregations", async (req, reply) => {
    const body = createCongregationBody.safeParse(req.body);
    if (!body.success) {
      return reply.code(400).send({ error: body.error.issues[0].message });
    }
    try {
      const congregation = await createCongregation(
        body.data.nombre,
        body.data.numero,
        body.data.circuito,
        body.data.timezone
      );
      return reply.code(201).send({ congregation });
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Error al crear congregación";
      return reply.code(422).send({ error: msg });
    }
  });

  // Reset password (dev: generates a new random password; prod: would send email)
  app.post("/auth/reset-password", async (req, reply) => {
    const body = z.object({
      email: z.string().email({ message: "Email inválido" }),
    }).safeParse(req.body);
    if (!body.success) {
      return reply.code(400).send({ error: body.error.issues[0].message });
    }
    try {
      const result = await resetPassword(body.data.email);
      return reply.code(200).send(result);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Error al restablecer contraseña";
      return reply.code(422).send({ error: msg });
    }
  });
}
