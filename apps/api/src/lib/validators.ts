import { z } from "zod";

// Simple validators for Fase 1. All messages in Spanish (UI language).

export const congIdParam = z.object({
  id: z.string().uuid({ message: "Congregación inválida" }),
});

export const jobParam = z.object({
  job: z.string().uuid({ message: "Importación inválida" }),
});

export const confirmBody = z.object({
  // Week indexes (0-based) selected from preview. Empty = all.
  weeks: z.array(z.number().int().min(0)).optional(),
});

export const assignBody = z.object({
  titular_id: z.string().uuid({ message: "Titular inválido" }),
  ayudante_id: z.string().uuid({ message: "Ayudante inválido" }).nullable().optional(),
});

export const MAX_JWPUB_BYTES = 25 * 1024 * 1024;

export function isJwpubFilename(name: string): boolean {
  return name.toLowerCase().endsWith(".jwpub");
}
