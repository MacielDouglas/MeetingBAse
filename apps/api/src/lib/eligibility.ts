// Fase 2A — catálogo de elegibilidad.
// Fase 2B — checkEligibility em POST /parts/:id/assign.
// Duro = 422 (bloqueia). Suave = aviso (warning), nunca bloqueia.

export interface PublisherRef {
  id: string;
  sexo: string;
  cargo: string;
  congregationId: string;
  familiaId?: string | null;
}

export interface PartRef {
  id: string;
  meetingId: string;
  congregationId: string;
  tipoClave: string;
  requiereAyudante: boolean;
  needsReview?: boolean;
}

export interface EligibilityInput {
  titular: PublisherRef;
  ayudante?: PublisherRef | null;
  ayudanteId?: string | null;
  part: PartRef;
  titularYaAsignadoEstaSemana?: boolean;
  ayudanteYaAsignadoEstaSemana?: boolean;
  titularIndisponible?: boolean;
  ayudanteIndisponible?: boolean;
  titularRepitioSemanaPasada?: boolean;
}

export interface EligibilityWarning {
  tipo: string;
  mensajeEs: string;
  duro: boolean;
}

// ── helpers ──

const norm = (v: string) => v.trim().toLowerCase();

const MALE = new Set(["hombre", "varon", "varón", "m", "masculino"]);
const EBC_OK = new Set(["anciano", "siervo ministerial", "siervo_ministerial", "siervo"]);

const isMale = (sexo: string) => MALE.has(norm(sexo));
const canLeadEbc = (cargo: string) => EBC_OK.has(norm(cargo));

function sameFamily(a: PublisherRef, b: PublisherRef): boolean {
  return !!(a.familiaId && b.familiaId && a.familiaId === b.familiaId);
}

function sameSex(a: PublisherRef, b: PublisherRef): boolean {
  return norm(a.sexo) === norm(b.sexo);
}

// ── regras por tipoClave (TODAS Duro) ──

interface PartRule {
  titularMale?: boolean;
  titularEbc?: boolean;
  helperRequired?: boolean;
  helperSameSex?: boolean;
  helperFamilyAllowed?: boolean;
}

const PART_RULES: Record<string, PartRule> = {
  // Tesoros
  mwb_tgw_talk:             {},
  mwb_tgw_gems:             {},
  mwb_tgw_bread:            { titularMale: true },
  // AYF
  mwb_ayf_iniciar:          {},
  mwb_ayf_cultivar:         {},
  mwb_ayf_explicar_discurso:{},
  mwb_ayf_explicar_demo:    { helperRequired: true, helperSameSex: true, helperFamilyAllowed: true },
  // Vida
  mwb_lc_part1:             {},
  mwb_lc_part2:             {},
  mwb_lc_cbs:               { titularEbc: true },
  // Fim de semana
  wk_oracion:               {},
  wk_presidente:            { titularEbc: true },
  wk_discurso_publico:      {},
  wk_sentinela_dirigente:   { titularEbc: true },
  wk_sentinela_leitor:      {},
  w_estudio:                { titularEbc: true },
};

// ── check principal ──

export function checkEligibility(input: EligibilityInput): {
  warnings: EligibilityWarning[];
} {
  const { titular, ayudante, ayudanteId, part } = input;
  const warnings: EligibilityWarning[] = [];
  const ayudaId = ayudante?.id ?? ayudanteId ?? null;

  // Duro: titular != ayudante
  if (ayudaId && ayudaId === titular.id) {
    warnings.push({
      tipo: "titular_ayudante_iguales",
      mensajeEs: "El titular y el ayudante deben ser distintos",
      duro: true,
    });
  }

  // Duro: misma congregación
  if (titular.congregationId !== part.congregationId) {
    warnings.push({
      tipo: "otra_congregacion",
      mensajeEs: "El titular debe ser de la misma congregación",
      duro: true,
    });
  }
  if (ayudante && ayudante.congregationId !== part.congregationId) {
    warnings.push({
      tipo: "otra_congregacion_ayudante",
      mensajeEs: "El ayudante debe ser de la misma congregación",
      duro: true,
    });
  }

  // Regras específicas por tipoClave
  const rule = PART_RULES[part.tipoClave];
  if (rule) {
    // Solo varón
    if (rule.titularMale && !isMale(titular.sexo)) {
      warnings.push({
        tipo: "solo_varon",
        mensajeEs: "Solo un varón puede tomar esta parte",
        duro: true,
      });
    }

    // Solo anciano / siervo ministerial
    if (rule.titularEbc && !canLeadEbc(titular.cargo)) {
      warnings.push({
        tipo: "ebc_solo_nombrados",
        mensajeEs: "Solo un anciano o siervo ministerial puede tomar esta parte",
        duro: true,
      });
    }

    // Ayudante requerido
    if (rule.helperRequired && !ayudaId) {
      warnings.push({
        tipo: "requiere_ayudante",
        mensajeEs: "Esta parte requiere ayudante",
        duro: true,
      });
    }

    // Ayudante mesma sexo (ou família se permitido)
    if (rule.helperRequired && ayudante) {
      if (rule.helperSameSex) {
        const familyOk = rule.helperFamilyAllowed && sameFamily(titular, ayudante);
        if (!sameSex(titular, ayudante) && !familyOk) {
          warnings.push({
            tipo: "ayudante_mismo_sexo",
            mensajeEs: "El ayudante debe ser del mismo sexo (o familiar en esta parte)",
            duro: true,
          });
        }
      }
    }
  }

  // Avios suaves (nunca bloqueiam)
  if (input.titularYaAsignadoEstaSemana) {
    warnings.push({
      tipo: "doble_asignacion",
      mensajeEs: "Atención: ya tiene otra parte esta semana",
      duro: false,
    });
  }
  if (input.ayudanteYaAsignadoEstaSemana) {
    warnings.push({
      tipo: "doble_asignacion_ayudante",
      mensajeEs: "Atención: el ayudante ya tiene otra parte esta semana",
      duro: false,
    });
  }
  if (part.needsReview) {
    warnings.push({
      tipo: "needs_review",
      mensajeEs: "Esta parte requiere revisión",
      duro: false,
    });
  }
  if (input.titularIndisponible) {
    warnings.push({
      tipo: "titular_indisponible",
      mensajeEs: "El titular marcó indisponibilidad para esta fecha",
      duro: false,
    });
  }
  if (input.ayudanteIndisponible) {
    warnings.push({
      tipo: "ayudante_indisponible",
      mensajeEs: "El ayudante marcó indisponibilidad para esta fecha",
      duro: false,
    });
  }
  if (input.titularRepitioSemanaPasada) {
    warnings.push({
      tipo: "repeticion_parte",
      mensajeEs: "Ya tuvo esta misma parte la semana pasada",
      duro: false,
    });
  }

  return { warnings };
}
