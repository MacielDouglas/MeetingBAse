import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import { sql } from "drizzle-orm";
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

// Set RLS session variable for the current request.
// Best-effort: Neon HTTP doesn't maintain sessions, so this may not persist.
// App-level filtering (WHERE congregation_id = :id) is the primary protection.
// RLS provides defense-in-depth when the variable is set.
export async function setCongregationContext(congregationId: string): Promise<void> {
  const db = getDb();
  if (!db) return;
  try {
    await db.execute(sql`SET app.congregation_id = ${congregationId}`);
  } catch {
    // Best-effort: app-level filtering still provides protection.
  }
}
