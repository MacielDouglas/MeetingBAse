// Fase 1 check: loadPub + preview (read-only refs, output to D:\temp).
// Run: npm run test:imports --workspace=@meeting-base/api
import { writeFileSync } from "node:fs";
import { parsePubFile } from "./parsePub.js";
import { createJob } from "./importStore.js";
import { detectPubKind } from "../../../../packages/db/mapping.js";

const refs = [
  "D:\\TheocBase\\jwpub\\mwb_S_202611.jwpub",
  "D:\\TheocBase\\jwpub\\w_S_202606.jwpub",
  "D:\\TheocBase\\jwpub\\sjj_S.jwpub",
  "D:\\TheocBase\\jwpub\\S-34_S (1).jwpub",
];

const report: Record<string, unknown>[] = [];
for (const f of refs) {
  const name = f.split("\\").pop() ?? f;
  const entry: Record<string, unknown> = { file: name, kind: detectPubKind(name) };
  try {
    const parsed = await parsePubFile(f, name);
    const job = createJob("00000000-0000-0000-0000-000000000000", parsed);
    const first = job.weeks[0];
    entry.ok = true;
    entry.weeks = job.weeks.length;
    entry.first_fecha = first.fecha;
    entry.first_parts = first.parts.length;
    entry.all_sala_a = job.weeks.every((w) => w.parts.every((p) => (p as { sala: string }).sala === "A"));
    entry.mwb_13 = parsed.kind === "mwb" ? job.weeks.every((w) => w.parts.length === 13) : "n/a";
    entry.orden_ok = job.weeks.every((w) => w.parts.every((p, i) => p.orden === i + 1));
  } catch (e) {
    entry.ok = false;
    entry.error = e instanceof Error ? e.message : String(e);
  }
  report.push(entry);
  console.log(JSON.stringify(entry));
}

writeFileSync("D:\\temp\\mb-fase1-check.json", JSON.stringify(report, null, 2));
console.log("Reporte: D:\\temp\\mb-fase1-check.json");
const fail = report.some((r) => r.file !== "sjj_S.jwpub" && r.file !== "S-34_S (1).jwpub" && !r.ok);
if (fail) process.exit(1);
