import { readdirSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { join } from "node:path";
import { isDbConfigured } from "../../../../packages/db/db.js";

// Fase 5 — Migration runner: reads SQL files from packages/db/drizzle/
// and executes them idempotently. Runs on API startup when DATABASE_URL is set.

const MIGRATIONS_DIR = fileURLToPath(
  new URL("../../../../packages/db/drizzle", import.meta.url)
);

// Track which migrations have been applied (in-memory, per process)
const applied = new Set<string>();

function splitStatements(src: string): string[] {
  // Remove single-line comments
  const noComments = src
    .split("\n")
    .filter((line) => !line.trimStart().startsWith("--"))
    .join("\n");
  const out: string[] = [];
  let cur = "";
  let inDollar = false;
  for (let i = 0; i < noComments.length; i += 1) {
    if (noComments.startsWith("$$", i)) {
      inDollar = !inDollar;
      cur += "$$";
      i += 1;
      continue;
    }
    if (noComments[i] === ";" && !inDollar) {
      if (cur.trim()) out.push(cur.trim());
      cur = "";
      continue;
    }
    cur += noComments[i];
  }
  if (cur.trim()) out.push(cur.trim());
  return out;
}

export async function runMigrations(): Promise<{ applied: string[]; skipped: string[] }> {
  if (!isDbConfigured()) {
    return { applied: [], skipped: [] };
  }

  // Dynamic import to avoid errors when DATABASE_URL is not set
  const { Pool } = await import("@neondatabase/serverless");
  const url = process.env.DATABASE_URL;
  if (!url) return { applied: [], skipped: [] };

  const files = readdirSync(MIGRATIONS_DIR)
    .filter((f) => f.endsWith(".sql"))
    .sort();

  const appliedList: string[] = [];
  const skippedList: string[] = [];
  const pool = new Pool({ connectionString: url });

  try {
    for (const f of files) {
      if (applied.has(f)) {
        skippedList.push(f);
        continue;
      }
      const stmts = splitStatements(readFileSync(join(MIGRATIONS_DIR, f), "utf8"));
      for (const s of stmts) {
        try {
          await pool.query(s);
        } catch (e) {
          // Skip non-idempotent statements (e.g. column already exists)
          console.warn(`[migrate] skipping statement in ${f}:`, e instanceof Error ? e.message : e);
        }
      }
      applied.add(f);
      appliedList.push(f);
    }
  } finally {
    await pool.end().catch(() => {});
  }

  return { applied: appliedList, skipped: skippedList };
}
