// Catalogo de elegibilidad (Fase 2A: solo codigo + docs, sin ruta).
// La Fase 2B usa checkEligibility en POST /parts/:id/assign.
// Duro = 422 (titular != ayudante, misma congregacion).
// Suave = warning en espanol (assignment_warnings), nunca bloquea.

export interface PublisherRef {
  id: string;
  sexo: string; // "hombre" | "mujer" (acepta varon/m/femenino)
  cargo: string; // "anciano" | "siervo ministerial" | "publicador" | ...
  congregationId: string;
}

export interface PartRef {
  id: string;
  meetingId: string;
  congregationId: string;
  tipoClave: string; // mwb_tgw_bread, mwb_ayf_part1..4, mwb_lc_cbs, ...
  requiereAyudante: boolean;
  needsReview?: boolean;
}

export interface EligibilityInput {
  titular: PublisherRef;
  ayudante?: PublisherRef | null;
  ayudanteId?: string | null;
  part: PartRef;
  titularYaAsignadoEstaSemana?: boolean;
}

export interface EligibilityWarning {
  tipo: string;
  mensajeEs: string;
  duro: boolean; // true = bloquea con 422 en la 2B
}

const MALE = new Set(["hombre", "varon", "varón", "m", "masculino"]);
const EBC_OK = new Set([
  "anciano",
  "siervo ministerial",
  "siervo_ministerial",
  "siervo",
]);

const norm = (v: string) => v.trim().toLowerCase();
const isMale = (sexo: string) => MALE.has(norm(sexo));
const canLeadEbc = (cargo: string) => EBC_OK.has(norm(cargo));

function isAyf(tipoClave: string): boolean {
  return /^mwb_ayf_part[1-4]$/.test(tipoClave);
}

export function checkEligibility(input: EligibilityInput): {
  warnings: EligibilityWarning[];
} {
  const { titular, ayudante, ayudanteId, part } = input;
  const warnings: EligibilityWarning[] = [];
  const ayudaId = ayudante?.id ?? ayudanteId ?? null;

  // Duro: titular y ayudante distintos.
  if (ayudaId && ayudaId === titular.id) {
    warnings.push({
      tipo: "titular_ayudante_iguales",
      mensajeEs: "El titular y el ayudante deben ser distintos",
      duro: true,
    });
  }

  // Duro: misma congregacion (titular y ayudante vs. parte).
  if (titular.congregationId !== part.congregationId) {
    warnings.push({
      tipo: "otra_congregacion",
      mensajeEs: "Debe ser de la misma congregación",
      duro: true,
    });
  } else if (ayudante && ayudante.congregationId !== part.congregationId) {
    warnings.push({
      tipo: "otra_congregacion",
      mensajeEs: "Debe ser de la misma congregación",
      duro: true,
    });
  }

  // Suave: Lectura del estudiante y AYF 1..4 solo varones.
  if (part.tipoClave === "mwb_tgw_bread" || isAyf(part.tipoClave)) {
    if (!isMale(titular.sexo)) {
      warnings.push({
        tipo: "solo_varon",
        mensajeEs: "Solo un varón puede tomar esta parte",
        duro: false,
      });
    }
  }

  // Suave: EBC solo ancianos o siervos ministeriales.
  if (part.tipoClave === "mwb_lc_cbs") {
    if (!canLeadEbc(titular.cargo)) {
      warnings.push({
        tipo: "ebc_solo_nombrados",
        mensajeEs: "El EBC lo dirige un anciano o siervo ministerial",
        duro: false,
      });
    }
  }

  // Suave: parte con ayudante requiere ayudante presente.
  if (part.requiereAyudante && !ayudaId) {
    warnings.push({
      tipo: "requiere_ayudante",
      mensajeEs: "Esta parte requiere ayudante",
      duro: false,
    });
  }

  // Suave: doble asignacion en la misma semana.
  if (input.titularYaAsignadoEstaSemana) {
    warnings.push({
      tipo: "doble_asignacion",
      mensajeEs: "Atención: ya tiene otra parte esta semana",
      duro: false,
    });
  }

  // Suave: parte marcada para revision (placeholder del parser).
  if (part.needsReview) {
    warnings.push({
      tipo: "needs_review",
      mensajeEs: "Esta parte requiere revisión",
      duro: false,
    });
  }

  return { warnings };
}
