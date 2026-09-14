// Consistência do i18n: toda chave es["..."] usada no código existe
// no es.json, e não há chaves mortas. Teste puro Node (sem expo).
// Roda com: npm test --workspace=@meeting-base/mobile

import { describe, it, expect } from "vitest";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

const ROOT = join(__dirname, "..");

function walk(dir: string, out: string[]): void {
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, e.name);
    if (e.isDirectory()) {
      if (e.name === "node_modules") continue;
      walk(p, out);
    } else if (/\.(tsx?|json)$/.test(e.name)) {
      out.push(p);
    }
  }
}

function loadSources(): string {
  const files: string[] = [];
  for (const sub of ["app", "hooks", "components", "lib"]) walk(join(ROOT, sub), files);
  return files.map((f) => readFileSync(f, "utf8")).join("\n");
}

function usedKeys(src: string): Set<string> {
  const set = new Set<string>();
  const re = /es\["([^"]+)"\]/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(src)) !== null) set.add(m[1]);
  return set;
}

describe("i18n/es.json", () => {
  it("toda chave usada no código existe no es.json", () => {
    const es = JSON.parse(readFileSync(join(ROOT, "i18n", "es.json"), "utf8")) as Record<string, string>;
    const missing = [...usedKeys(loadSources())].filter((k) => !(k in es));
    expect(missing).toEqual([]);
  });

  it("não há chaves mortas no es.json", () => {
    const es = JSON.parse(readFileSync(join(ROOT, "i18n", "es.json"), "utf8")) as Record<string, string>;
    const used = usedKeys(loadSources());
    const dead = Object.keys(es).filter((k) => !used.has(k));
    expect(dead).toEqual([]);
  });
});
