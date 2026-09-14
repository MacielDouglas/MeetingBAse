import { describe, it, expect } from "vitest";
import { checkEligibility, type EligibilityInput, type EligibilityWarning, type PartRef, type PublisherRef } from "./eligibility.js";

function makePart(overrides: Partial<PartRef> = {}): PartRef {
  return {
    id: "part-1",
    meetingId: "meeting-1",
    congregationId: "cong-1",
    tipoClave: "mwb_tgw_talk",
    requiereAyudante: false,
    ...overrides,
  };
}

function makePub(overrides: Partial<PublisherRef> = {}): PublisherRef {
  return {
    id: "pub-1",
    sexo: "hombre",
    cargo: "publicador",
    congregationId: "cong-1",
    privileges: {},
    ...overrides,
  };
}

function check(input: EligibilityInput) {
  return checkEligibility(input);
}

function findWarning(warnings: EligibilityWarning[], tipo: string) {
  return warnings.find((w) => w.tipo === tipo);
}

describe("checkEligibility", () => {
  describe("duro: titular != ayudante", () => {
    it("retorna warning quando titular e ayudante son iguales", () => {
      const pub = makePub({ id: "same-id" });
      const { warnings } = check({ titular: pub, ayudante: pub, part: makePart() });
      expect(findWarning(warnings, "titular_ayudante_iguales")).toBeDefined();
      expect(findWarning(warnings, "titular_ayudante_iguales")!.duro).toBe(true);
    });

    it("no retorna warning quando son distintos", () => {
      const { warnings } = check({
        titular: makePub({ id: "tit-1" }),
        ayudante: makePub({ id: "ayu-1" }),
        part: makePart(),
      });
      expect(findWarning(warnings, "titular_ayudante_iguales")).toBeUndefined();
    });
  });

  describe("duro: misma congregación", () => {
    it("retorna warning cuando titular es de otra congregación", () => {
      const { warnings } = check({
        titular: makePub({ congregationId: "cong-2" }),
        part: makePart({ congregationId: "cong-1" }),
      });
      expect(findWarning(warnings, "otra_congregacion")?.duro).toBe(true);
    });

    it("retorna warning cuando ayudante es de otra congregación", () => {
      const { warnings } = check({
        titular: makePub({ congregationId: "cong-1" }),
        ayudante: makePub({ id: "ayu-1", congregationId: "cong-3" }),
        part: makePart({ congregationId: "cong-1" }),
      });
      expect(findWarning(warnings, "otra_congregacion_ayudante")?.duro).toBe(true);
    });
  });

  describe("mwb_tgw_talk: sem restrições", () => {
    aceitaQualquerUm("mwb_tgw_talk");
  });

  describe("mwb_tgw_gems: sem restrições", () => {
    aceitaQualquerUm("mwb_tgw_gems");
  });

  describe("mwb_tgw_bread: solo varón", () => {
    it("bloqueia mulher", () => {
      const { warnings } = check({
        titular: makePub({ sexo: "mujer" }),
        part: makePart({ tipoClave: "mwb_tgw_bread" }),
      });
      expect(findWarning(warnings, "solo_varon")?.duro).toBe(true);
    });

    it("aceita homem (publicador)", () => {
      const { warnings } = check({
        titular: makePub({ sexo: "hombre", cargo: "publicador" }),
        part: makePart({ tipoClave: "mwb_tgw_bread" }),
      });
      expect(findWarning(warnings, "solo_varon")).toBeUndefined();
    });
  });

  describe("mwb_ayf_iniciar: sem restrições", () => {
    aceitaQualquerUm("mwb_ayf_iniciar");
  });

  describe("mwb_ayf_cultivar: sem restrições", () => {
    aceitaQualquerUm("mwb_ayf_cultivar");
  });

  describe("mwb_ayf_explicar_discurso: sem restrições", () => {
    aceitaQualquerUm("mwb_ayf_explicar_discurso");
  });

  describe("mwb_ayf_explicar_demo: requer ayudante same-sex/family", () => {
    it("bloqueia sem ajudante", () => {
      const { warnings } = check({
        titular: makePub(),
        part: makePart({ tipoClave: "mwb_ayf_explicar_demo" }),
      });
      expect(findWarning(warnings, "requiere_ayudante")?.duro).toBe(true);
    });

    it("bloqueia ajudante de sexo diferente sem família", () => {
      const { warnings } = check({
        titular: makePub({ id: "tit-1", sexo: "hombre" }),
        ayudante: makePub({ id: "ayu-1", sexo: "mujer" }),
        part: makePart({ tipoClave: "mwb_ayf_explicar_demo" }),
      });
      expect(findWarning(warnings, "ayudante_mismo_sexo")?.duro).toBe(true);
    });

    it("aceita ajudante do mesmo sexo", () => {
      const { warnings } = check({
        titular: makePub({ id: "tit-1", sexo: "hombre" }),
        ayudante: makePub({ id: "ayu-1", sexo: "hombre" }),
        part: makePart({ tipoClave: "mwb_ayf_explicar_demo" }),
      });
      expect(findWarning(warnings, "ayudante_mismo_sexo")).toBeUndefined();
    });

    it("aceita ajudante de sexo diferente com família", () => {
      const { warnings } = check({
        titular: makePub({ id: "tit-1", sexo: "hombre", familiaId: "fam-1" }),
        ayudante: makePub({ id: "ayu-1", sexo: "mujer", familiaId: "fam-1" }),
        part: makePart({ tipoClave: "mwb_ayf_explicar_demo" }),
      });
      expect(findWarning(warnings, "ayudante_mismo_sexo")).toBeUndefined();
    });
  });

  describe("mwb_lc_cbs: EBC only", () => {
    it("bloqueia publicador", () => {
      const { warnings } = check({
        titular: makePub({ cargo: "publicador" }),
        part: makePart({ tipoClave: "mwb_lc_cbs" }),
      });
      expect(findWarning(warnings, "ebc_solo_nombrados")?.duro).toBe(true);
    });

    it("aceita anciano", () => {
      const { warnings } = check({
        titular: makePub({ cargo: "anciano" }),
        part: makePart({ tipoClave: "mwb_lc_cbs" }),
      });
      expect(findWarning(warnings, "ebc_solo_nombrados")).toBeUndefined();
    });
  });

  describe("wk_presidente: EBC only", () => {
    it("bloqueia publicador", () => {
      const { warnings } = check({
        titular: makePub({ cargo: "publicador" }),
        part: makePart({ tipoClave: "wk_presidente" }),
      });
      expect(findWarning(warnings, "ebc_solo_nombrados")?.duro).toBe(true);
    });

    it("aceita siervo ministerial", () => {
      const { warnings } = check({
        titular: makePub({ cargo: "siervo_ministerial" }),
        part: makePart({ tipoClave: "wk_presidente" }),
      });
      expect(findWarning(warnings, "ebc_solo_nombrados")).toBeUndefined();
    });
  });

  describe("wk_sentinela_dirigente: EBC only", () => {
    it("bloqueia publicador", () => {
      const { warnings } = check({
        titular: makePub({ cargo: "publicador" }),
        part: makePart({ tipoClave: "wk_sentinela_dirigente" }),
      });
      expect(findWarning(warnings, "ebc_solo_nombrados")?.duro).toBe(true);
    });
  });

  describe("w_estudio: EBC only", () => {
    it("bloqueia publicador", () => {
      const { warnings } = check({
        titular: makePub({ cargo: "publicador" }),
        part: makePart({ tipoClave: "w_estudio" }),
      });
      expect(findWarning(warnings, "ebc_solo_nombrados")?.duro).toBe(true);
    });
  });

  describe("wk_oracion / wk_discurso / wk_sentinela_leitor / mwb_lc_part1 / mwb_lc_part2: sem restrições", () => {
    aceitaQualquerUm("wk_oracion");
    aceitaQualquerUm("wk_discurso_publico");
    aceitaQualquerUm("wk_sentinela_leitor");
    aceitaQualquerUm("mwb_lc_part1");
    aceitaQualquerUm("mwb_lc_part2");
  });

  describe("avisos suaves (nunca bloqueiam)", () => {
    it("doble_asignacion é suave", () => {
      const { warnings } = check({
        titular: makePub(),
        part: makePart(),
        titularYaAsignadoEstaSemana: true,
      });
      expect(findWarning(warnings, "doble_asignacion")?.duro).toBe(false);
    });

    it("needs_review é suave", () => {
      const { warnings } = check({
        titular: makePub(),
        part: makePart({ needsReview: true }),
      });
      expect(findWarning(warnings, "needs_review")?.duro).toBe(false);
    });

    it("titular_indisponible é suave", () => {
      const { warnings } = check({
        titular: makePub(),
        part: makePart(),
        titularIndisponible: true,
      });
      expect(findWarning(warnings, "titular_indisponible")?.duro).toBe(false);
    });

    it("repeticion_parte é suave", () => {
      const { warnings } = check({
        titular: makePub(),
        part: makePart(),
        titularRepitioSemanaPasada: true,
      });
      expect(findWarning(warnings, "repeticion_parte")?.duro).toBe(false);
    });
  });

  describe("caso limpio: sin warnings", () => {
    it("retorna array vacío para mwb_tgw_talk", () => {
      const { warnings } = check({
        titular: makePub(),
        part: makePart({ tipoClave: "mwb_tgw_talk" }),
      });
      expect(warnings).toHaveLength(0);
    });
  });
});

// Helper: testa que uma parte sem restrições aceita qualquer publicador ativo
function aceitaQualquerUm(tipoClave: string) {
  it(`aceita homem publicador para ${tipoClave}`, () => {
    const { warnings } = check({
      titular: makePub({ sexo: "hombre", cargo: "publicador" }),
      part: makePart({ tipoClave }),
    });
    expect(findWarning(warnings, "solo_varon")).toBeUndefined();
    expect(findWarning(warnings, "ebc_solo_nombrados")).toBeUndefined();
    expect(findWarning(warnings, "privilegio_requerido")).toBeUndefined();
  });

  it(`aceita mulher publicadora para ${tipoClave}`, () => {
    const { warnings } = check({
      titular: makePub({ sexo: "mujer", cargo: "publicador" }),
      part: makePart({ tipoClave }),
    });
    expect(findWarning(warnings, "solo_varon")).toBeUndefined();
    expect(findWarning(warnings, "ebc_solo_nombrados")).toBeUndefined();
  });
}
