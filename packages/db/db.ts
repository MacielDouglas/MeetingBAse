import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import * as schema from "./schema.js";

// Fase 2A — cliente Drizzle + Neon Postgres (API).
// Lee DATABASE_URL del entorno solo aqui. Nunca hace log del valor.
// Sin DATABASE_URL (o fallo de conexion) devuelve null y la API
// sigue en memoria con `persistencia: "memoria"` (sin romper nada).

export type NeonDb = ReturnType<typeof drizzle<typeof schema>>;

let cached: NeonDb | null = null;
let tried = false;

export function isDbConfigured(): boolean {
  const v = process.env.DATABASE_URL;
  return typeof v === "string" && v.length > 0;
}

export function getDb(): NeonDb | null {
  if (tried) return cached;
  tried = true;
  if (!isDbConfigured()) return null;
  try {
    const url = process.env.DATABASE_URL as string;
    const client = neon(url);
    cached = drizzle(client, { schema });
    return cached;
  } catch {
    cached = null;
    return null;
  }
}
