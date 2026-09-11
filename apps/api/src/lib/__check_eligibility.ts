// Check manual del catalogo de elegibilidad (sin DB).
// Run: npm run test:eligibility --workspace=@meeting-base/api
import { checkEligibility } from "./eligibility.js";

const cong = "00000000-0000-0000-0000-000000000000";
const otra = "11111111-1111-1111-1111-111111111111";

function part(tipoClave: string, extra = {}) {
  return {
    id: "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa",
    meetingId: "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb",
    congregationId: cong,
    tipoClave,
    requiereAyudante: false,
    ...extra,
  };
}
function pub(id: string, sexo: string, cargo: string, congregationId = cong) {
  return { id, sexo, cargo, congregationId };
}

const cases: { name: string; input: Parameters<typeof checkEligibility>[0] }[] = [
  {
    name: "lectura_mujer",
    input: {
      titular: pub("c0000000-0000-0000-0000-000000000001", "mujer", "publicador"),
      part: part("mwb_tgw_bread", { requiereAyudante: true, ayudanteId: undefined }),
    },
  },
  {
    name: "ayf1_mujer",
    input: {
      titular: pub("c0000000-0000-0000-0000-000000000002", "mujer", "publicadora"),
      part: part("mwb_ayf_part1"),
    },
  },
  {
    name: "ebc_publicador",
    input: {
      titular: pub("c0000000-0000-0000-0000-000000000003", "hombre", "publicador"),
      part: part("mwb_lc_cbs"),
    },
  },
  {
    name: "ebc_anciano_ok",
    input: {
      titular: pub("c0000000-0000-0000-0000-000000000004", "hombre", "anciano"),
      part: part("mwb_lc_cbs"),
    },
  },
  {
    name: "sin_ayudante",
    input: {
      titular: pub("c0000000-0000-0000-0000-000000000005", "hombre", "publicador"),
      part: part("mwb_ayf_part2", { requiereAyudante: true }),
    },
  },
  {
    name: "titular_igual_ayudante_duro",
    input: {
      titular: pub("c0000000-0000-0000-0000-000000000006", "hombre", "publicador"),
      ayudante: pub("c0000000-0000-0000-0000-000000000006", "hombre", "publicador"),
      part: part("mwb_tgw_talk"),
    },
  },
  {
    name: "otra_congregacion_duro",
    input: {
      titular: pub("c0000000-0000-0000-0000-000000000007", "hombre", "anciano", otra),
      part: part("mwb_lc_cbs"),
    },
  },
  {
    name: "doble_asignacion_suave",
    input: {
      titular: pub("c0000000-0000-0000-0000-000000000008", "hombre", "anciano"),
      part: part("mwb_lc_cbs"),
      titularYaAsignadoEstaSemana: true,
    },
  },
];

let fail = 0;
for (const c of cases) {
  const { warnings } = checkEligibility(c.input);
  console.log(JSON.stringify({ case: c.name, warnings }));
}
const mustWarn = ["lectura_mujer", "ayf1_mujer", "ebc_publicador", "sin_ayudante", "doble_asignacion_suave"];
for (const n of mustWarn) {
  const c = cases.find((x) => x.name === n)!;
  const { warnings } = checkEligibility(c.input);
  if (warnings.some((w) => w.duro) || warnings.length === 0) {
    console.error(`FAIL suave esperado: ${n}`);
    fail += 1;
  }
}
for (const n of ["titular_igual_ayudante_duro", "otra_congregacion_duro"]) {
  const c = cases.find((x) => x.name === n)!;
  const { warnings } = checkEligibility(c.input);
  if (!warnings.some((w) => w.duro)) {
    console.error(`FAIL duro esperado: ${n}`);
    fail += 1;
  }
}
const okCase = checkEligibility(cases.find((x) => x.name === "ebc_anciano_ok")!.input);
if (okCase.warnings.length !== 0) {
  console.error("FAIL ebc_anciano_ok debia no avisar");
  fail += 1;
}
if (fail > 0) process.exit(1);
console.log("Elegibilidad OK");
