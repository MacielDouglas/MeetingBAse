import type { FastifyRequest, FastifyReply } from "fastify";
import { verifyToken, type AuthUser } from "./auth.js";
import { setCongregationContext } from "../../../../packages/db/db.js";

// Auth middleware: verifies Bearer token, attaches user to request,
// and sets RLS congregation context for defense-in-depth.

const PUBLIC_PATHS = new Set(["/salud", "/auth/login", "/auth/register"]);

export async function authGuard(req: FastifyRequest, reply: FastifyReply): Promise<void> {
  const url = req.url.split("?")[0];

  // Skip public paths
  if (PUBLIC_PATHS.has(url)) return;

  // Skip if starts with /auth/ (login, register, me)
  if (url.startsWith("/auth/")) return;

  const auth = req.headers.authorization;
  if (!auth || !auth.startsWith("Bearer ")) {
    return reply.code(401).send({ error: "Token de autenticación requerido" });
  }

  const token = auth.slice(7);
  const user = verifyToken(token);
  if (!user) {
    return reply.code(401).send({ error: "Token inválido o expirado" });
  }

  // Attach user to request for downstream use
  (req as FastifyRequest & { user?: AuthUser }).user = user;

  // Set RLS congregation context (best-effort, defense-in-depth)
  if (user.congregationId) {
    await setCongregationContext(user.congregationId);
  }
}

// Helper: get authenticated user from request
export function getRequestUser(req: FastifyRequest): AuthUser | undefined {
  return (req as FastifyRequest & { user?: AuthUser }).user;
}
