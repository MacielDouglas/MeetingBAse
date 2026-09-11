// db:migrate — aplica packages/db/drizzle/*.sql no Neon (idempotente).
// Run: npm run db:migrate --workspace=@meeting-base/api
// Lê DATABASE_URL de apps/api/.env (dotenv). Nunca imprime o valor.
import dotenv from "dotenv";
import { fileURLToPath } from "node:url";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { Pool } from "@neondatabase/serverless";

dotenv.config({ path: fileURLToPath(new URL("../../.env", import.meta.url)) });

const url = process.env.DATABASE_URL;
if (!url) {
  console.error(
    "Falta DATABASE_URL en apps/api/.env — migraciones no aplicadas."
  );
  process.exit(1);
}

// Redact: nunca mostrar credenciais no log.
function safe(msg: string): string {
  return msg.replace(/:[^:@/\s]+@/g, ":***@").replace(/password=[^\s;]+/gi, "password=***");
}

const dir = fileURLToPath(
  new URL("../../../../packages/db/drizzle", import.meta.url)
);
const files = readdirSync(dir)
  .filter((f) => f.endsWith(".sql"))
  .sort();

// Divide em statements respeitando blocos DO $$ ... $$ e comentários --.
function splitStatements(src: string): string[] {
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

const pool = new Pool({ connectionString: url });
try {
  for (const f of files) {
    const stmts = splitStatements(readFileSync(join(dir, f), "utf8"));
    for (const s of stmts) {
      await pool.query(s);
    }
    console.log(JSON.stringify({ migration: f, statements: stmts.length, ok: true }));
  }
  const { rows } = await pool.query(
    "SELECT tablename FROM pg_tables WHERE schemaname = 'public' ORDER BY tablename"
  );
  console.log(JSON.stringify({ tablas: rows.map((r) => r.tablename) }));
} catch (e) {
  console.error("MIGRATE_ERROR: " + safe(e instanceof Error ? e.message : String(e)));
  process.exit(1);
} finally {
  await pool.end().catch(() => {});
}
