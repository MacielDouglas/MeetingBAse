// Fase 2B check: assign + publish + sync em modo memoria (sem banco).
// Run: npm run test:assign --workspace=@meeting-base/api
delete process.env.DATABASE_URL;

import { buildApp } from "../app.js";
import { isDbConfigured } from "../../../../packages/db/db.js";
import { saveConfirmedMeetings } from "./importStore.js";
import { upsertMemPublisher } from "./assignStore.js";

if (isDbConfigured()) {
  console.error("FAIL: DATABASE_URL definido; o teste exige modo memoria");
  process.exit(1);
}

const CONG = "22222222-2222-4222-8222-222222222222";
const OTRA = "33333333-3333-4333-8333-333333333333";
const MID = "44444444-4444-4444-8444-444444444444";
const P_LECTURA = "55555555-5555-4555-8555-555555555501";
const P_AYF1 = "55555555-5555-4555-8555-555555555502";
const P_EBC = "55555555-5555-4555-8555-555555555503";
const P_TALK = "55555555-5555-4555-8555-555555555504";
const T_HOMBRE = "66666666-6666-4666-8666-666666666601";
const T_MUJER = "66666666-6666-4666-8666-666666666602";
const T_OTRA = "66666666-6666-4666-8666-666666666603";
const T_SEG = "66666666-6666-4666-8666-666666666604";
const AYU = "66666666-6666-4666-8666-666666666605";
const NOBODY = "77777777-7777-4777-8777-777777777777";

upsertMemPublisher({ id: T_HOMBRE, sexo: "hombre", ebc: true, congregationId: CONG });
upsertMemPublisher({ id: T_MUJER, sexo: "mujer", ebc: false, congregationId: CONG });
upsertMemPublisher({ id: T_OTRA, sexo: "hombre", ebc: true, congregationId: OTRA });
upsertMemPublisher({ id: T_SEG, sexo: "hombre", ebc: false, congregationId: CONG });
upsertMemPublisher({ id: AYU, sexo: "mujer", ebc: false, congregationId: CONG });

saveConfirmedMeetings([
  {
    id: MID,
    congregation_id: CONG,
    import_id: "88888888-8888-4888-8888-888888888888",
    fecha: "2026-11-02",
    tipo: "entre_semana",
    semana_label: "2 de noviembre",
    estado: "draft",
    sala: "A",
    parts: [
      { id: P_LECTURA, orden: 4, seccion: "TESOROS", tipoClave: "mwb_tgw_bread", titulo: "Lectura", requiereAyudante: true, needsReview: true, sala: "A" },
      { id: P_AYF1, orden: 5, seccion: "MAESTROS", tipoClave: "mwb_ayf_part1", titulo: "AYF 1", requiereAyudante: true, sala: "A" },
      { id: P_EBC, orden: 12, seccion: "EBC", tipoClave: "mwb_lc_cbs", titulo: "EBC", requiereAyudante: false, sala: "A" },
      { id: P_TALK, orden: 2, seccion: "TESOROS", tipoClave: "mwb_tgw_talk", titulo: "Discurso", requiereAyudante: false, sala: "A" },
    ],
  },
]);

const app = await buildApp();
let fail = 0;
function expect(cond: boolean, name: string, extra?: unknown) {
  console.log(JSON.stringify({ check: name, ok: cond, extra: extra ?? null }));
  if (!cond) fail += 1;
}
const tipos = (b: { warnings: { tipo: string }[] }) => b.warnings.map((w) => w.tipo).sort();

// 1. ok limpo: EBC para ancião (sem warnings).
let r = await app.inject({
  method: "POST",
  url: `/c/${CONG}/parts/${P_EBC}/assign`,
  payload: { titular_id: T_HOMBRE },
});
let b = r.json();
expect(r.statusCode === 200 && b.warnings.length === 0 && b.persistencia === "memoria", "assign_ebc_ok", b);

// 2. ok com 3 suaves: leitura para mulher sem ajudante.
r = await app.inject({
  method: "POST",
  url: `/c/${CONG}/parts/${P_LECTURA}/assign`,
  payload: { titular_id: T_MUJER },
});
b = r.json();
expect(
  r.statusCode === 200 &&
    JSON.stringify(tipos(b)) === JSON.stringify(["needs_review", "requiere_ayudante", "solo_varon"]),
  "assign_lectura_suaves",
  b
);

// 3. sync espelha warnings persistidos.
r = await app.inject({ method: "GET", url: `/c/${CONG}/sync` });
b = r.json();
expect(
  r.statusCode === 200 &&
    b.persistencia === "memoria" &&
    b.filtrado === false &&
    b.assignments.length === 2 &&
    b.warnings.length === 3 &&
    b.meetings.length === 1 &&
    b.parts.length === 4,
  "sync_formato",
  { a: b.assignments.length, w: b.warnings.length }
);

// 4. upsert substitui + troca warnings (só needs_review restante).
// Titular fresco (T_SEG ainda não tem parte na semana → sem doble).
r = await app.inject({
  method: "POST",
  url: `/c/${CONG}/parts/${P_LECTURA}/assign`,
  payload: { titular_id: T_SEG, ayudante_id: AYU },
});
b = r.json();
expect(r.statusCode === 200 && JSON.stringify(tipos(b)) === JSON.stringify(["needs_review"]), "assign_upsert", b);
r = await app.inject({ method: "GET", url: `/c/${CONG}/sync` });
b = r.json();
expect(b.warnings.length === 1 && b.assignments.length === 2, "warnings_trocados", { w: b.warnings.length });

// 5. doble_asignacion: mesmo titular em 2ª parte da semana.
r = await app.inject({
  method: "POST",
  url: `/c/${CONG}/parts/${P_AYF1}/assign`,
  payload: { titular_id: T_HOMBRE },
});
b = r.json();
expect(r.statusCode === 200 && tipos(b).includes("doble_asignacion"), "doble_suave", b);

// 6. duros → 422.
r = await app.inject({
  method: "POST",
  url: `/c/${CONG}/parts/${P_TALK}/assign`,
  payload: { titular_id: T_HOMBRE, ayudante_id: T_HOMBRE },
});
expect(r.statusCode === 422, "duro_igual", r.json());
r = await app.inject({
  method: "POST",
  url: `/c/${CONG}/parts/${P_TALK}/assign`,
  payload: { titular_id: T_OTRA },
});
expect(r.statusCode === 422, "duro_outra_cong", r.json());

// 7. 404/400.
r = await app.inject({ method: "POST", url: `/c/${CONG}/parts/${NOBODY}/assign`, payload: { titular_id: T_HOMBRE } });
expect(r.statusCode === 404, "parte_404", r.json());
r = await app.inject({ method: "POST", url: `/c/${CONG}/parts/${P_TALK}/assign`, payload: { titular_id: NOBODY } });
expect(r.statusCode === 404, "titular_404", r.json());
r = await app.inject({ method: "POST", url: `/c/${CONG}/parts/${P_TALK}/assign`, payload: { titular_id: "x" } });
expect(r.statusCode === 400, "body_400", r.json());
r = await app.inject({ method: "GET", url: `/c/no-uuid/sync` });
expect(r.statusCode === 400, "cong_400", r.json());

// 8. publish draft → published; de novo → 409; inexistente → 404.
r = await app.inject({ method: "POST", url: `/c/${CONG}/meetings/${MID}/publish` });
expect(r.statusCode === 200 && r.json().estado === "published", "publish_ok", r.json());
r = await app.inject({ method: "POST", url: `/c/${CONG}/meetings/${MID}/publish` });
expect(r.statusCode === 409, "publish_409", r.json());
r = await app.inject({ method: "POST", url: `/c/${CONG}/meetings/${NOBODY}/publish` });
expect(r.statusCode === 404, "publish_404", r.json());

// 9. meetings mostra published.
r = await app.inject({ method: "GET", url: `/c/${CONG}/meetings` });
b = r.json();
expect(b.meetings[0]?.estado === "published" && b.persistencia === "memoria", "meetings_published", { estado: b.meetings[0]?.estado });

// 10. sync com since futuro filtra datados; since inválido nunca 500.
r = await app.inject({ method: "GET", url: `/c/${CONG}/sync?since=2099-01-01T00:00:00.000Z` });
b = r.json();
expect(
  r.statusCode === 200 && b.assignments.length === 0 && b.warnings.length === 0 && b.meetings.length === 1 && b.filtrado === false,
  "sync_since_futuro",
  { a: b.assignments.length, m: b.meetings.length }
);
r = await app.inject({ method: "GET", url: `/c/${CONG}/sync?since=lixo` });
expect(r.statusCode === 200, "sync_since_invalido", { since: r.json().since });

await app.close();
if (fail > 0) process.exit(1);
console.log("Assign OK");
