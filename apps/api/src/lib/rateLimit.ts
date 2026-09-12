import type { FastifyRequest, FastifyReply } from "fastify";

// Simple in-memory rate limiter for API routes.
// Limits: 60 requests per minute per IP for auth routes, 120 for others.

interface RateLimitEntry {
  count: number;
  resetAt: number;
}

const limits = new Map<string, RateLimitEntry>();

const AUTH_LIMIT = 60;
const GENERAL_LIMIT = 120;
const WINDOW_MS = 60_000;

function getLimit(url: string): number {
  if (url.startsWith("/auth/")) return AUTH_LIMIT;
  return GENERAL_LIMIT;
}

export async function rateLimit(req: FastifyRequest, reply: FastifyReply): Promise<void> {
  const ip = req.ip ?? "unknown";
  const url = req.url.split("?")[0];
  const key = `${ip}:${url.startsWith("/auth/") ? "auth" : "general"}`;
  const limit = getLimit(url);
  const now = Date.now();

  let entry = limits.get(key);
  if (!entry || now > entry.resetAt) {
    entry = { count: 0, resetAt: now + WINDOW_MS };
    limits.set(key, entry);
  }

  entry.count += 1;

  if (entry.count > limit) {
    return reply.code(429).send({
      error: "Demasiadas solicitudes. Intente de nuevo en un momento.",
      retryAfter: Math.ceil((entry.resetAt - now) / 1000),
    });
  }

  reply.header("X-RateLimit-Limit", limit);
  reply.header("X-RateLimit-Remaining", Math.max(0, limit - entry.count));
  reply.header("X-RateLimit-Reset", Math.ceil(entry.resetAt / 1000));
}

// Cleanup old entries periodically
setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of limits.entries()) {
    if (now > entry.resetAt) limits.delete(key);
  }
}, 60_000);
