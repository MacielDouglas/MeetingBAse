import { describe, it, expect } from "vitest";
import { checkEligibility, type EligibilityInput, type PartRef, type PublisherRef } from "./eligibility.js";

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
    ...overrides,
  };
}

function check(input: EligibilityInput) {
  return checkEligibility(input);
}

describe("checkEligibility", () => {
  describe("duro: titular != ayudante", () => {
    it("retorna warning cuando titular e ayudante son iguales", () => {
      const pub = makePub({ id: "same-id" });
      const { warnings } = check({
        titular: pub,
        ayudante: pub,
        part: makePart(),
      });
      expect(warnings).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ tipo: "titular_ayudante_iguales", duro: true }),
        ])
      );
    });

    it("no retorna warning cuando son distintos", () => {
      const { warnings } = check({
        titular: makePub({ id: "tit-1" }),
        ayudante: makePub({ id: "ayu-1" }),
        part: makePart(),
      });
      expect(warnings.find((w) => w.tipo === "titular_ayudante_iguales")).toBeUndefined();
    });

    it("no retorna warning cuando no hay ayudante", () => {
      const { warnings } = check({
        titular: makePub(),
        part: makePart(),
      });
      expect(warnings.find((w) => w.tipo === "titular_ayudante_iguales")).toBeUndefined();
    });
  });

  describe("duro: misma congregación", () => {
    it("retorna warning cuando titular es de otra congregación", () => {
      const { warnings } = check({
        titular: makePub({ congregationId: "cong-2" }),
        part: makePart({ congregationId: "cong-1" }),
      });
      expect(warnings).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ tipo: "otra_congregacion", duro: true }),
        ])
      );
    });

    it("retorna warning cuando ayudante es de otra congregación", () => {
      const { warnings } = check({
        titular: makePub({ congregationId: "cong-1" }),
        ayudante: makePub({ congregationId: "cong-3" }),
        part: makePart({ congregationId: "cong-1" }),
      });
      expect(warnings).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ tipo: "otra_congregacion", duro: true }),
        ])
      );
    });

    it("no retorna warning cuando todos son de la misma congregación", () => {
      const { warnings } = check({
        titular: makePub({ congregationId: "cong-1" }),
        ayudante: makePub({ congregationId: "cong-1" }),
        part: makePart({ congregationId: "cong-1" }),
      });
      expect(warnings.find((w) => w.tipo === "otra_congregacion")).toBeUndefined();
    });
  });

  describe("suave: solo varón para lectura/AYF", () => {
    it("retorna warning para mwb_tgw_bread con mujer", () => {
      const { warnings } = check({
        titular: makePub({ sexo: "mujer" }),
        part: makePart({ tipoClave: "mwb_tgw_bread" }),
      });
      expect(warnings).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ tipo: "solo_varon", duro: false }),
        ])
      );
    });

    it.each(["mwb_ayf_part1", "mwb_ayf_part2", "mwb_ayf_part3", "mwb_ayf_part4"])(
      "retorna warning para %s con mujer",
      (tipoClave) => {
        const { warnings } = check({
          titular: makePub({ sexo: "mujer" }),
          part: makePart({ tipoClave }),
        });
        expect(warnings).toEqual(
          expect.arrayContaining([
            expect.objectContaining({ tipo: "solo_varon", duro: false }),
          ])
        );
      }
    );

    it("no retorna warning para parte normal con mujer", () => {
      const { warnings } = check({
        titular: makePub({ sexo: "mujer" }),
        part: makePart({ tipoClave: "mwb_tgw_talk" }),
      });
      expect(warnings.find((w) => w.tipo === "solo_varon")).toBeUndefined();
    });

    it("no retorna warning para hombre en lectura/AYF", () => {
      const { warnings } = check({
        titular: makePub({ sexo: "hombre" }),
        part: makePart({ tipoClave: "mwb_tgw_bread" }),
      });
      expect(warnings.find((w) => w.tipo === "solo_varon")).toBeUndefined();
    });
  });

  describe("suave: EBC solo nombrados", () => {
    it("retorna warning para publicador en EBC", () => {
      const { warnings } = check({
        titular: makePub({ cargo: "publicador" }),
        part: makePart({ tipoClave: "mwb_lc_cbs" }),
      });
      expect(warnings).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ tipo: "ebc_solo_nombrados", duro: false }),
        ])
      );
    });

    it.each(["anciano", "siervo ministerial"])(
      "no retorna warning para %s en EBC",
      (cargo) => {
        const { warnings } = check({
          titular: makePub({ cargo }),
          part: makePart({ tipoClave: "mwb_lc_cbs" }),
        });
        expect(warnings.find((w) => w.tipo === "ebc_solo_nombrados")).toBeUndefined();
      }
    );
  });

  describe("suave: requiere ayudante", () => {
    it("retorna warning cuando parte requiere ayudante y no hay", () => {
      const { warnings } = check({
        titular: makePub(),
        part: makePart({ requiereAyudante: true }),
      });
      expect(warnings).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ tipo: "requiere_ayudante", duro: false }),
        ])
      );
    });

    it("no retorna warning cuando hay ayudante", () => {
      const { warnings } = check({
        titular: makePub(),
        ayudante: makePub({ id: "ayu-1" }),
        part: makePart({ requiereAyudante: true }),
      });
      expect(warnings.find((w) => w.tipo === "requiere_ayudante")).toBeUndefined();
    });
  });

  describe("suave: doble asignación", () => {
    it("retorna warning cuando ya tiene parte esta semana", () => {
      const { warnings } = check({
        titular: makePub(),
        part: makePart(),
        titularYaAsignadoEstaSemana: true,
      });
      expect(warnings).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ tipo: "doble_asignacion", duro: false }),
        ])
      );
    });

    it("no retorna warning cuando no tiene parte esta semana", () => {
      const { warnings } = check({
        titular: makePub(),
        part: makePart(),
        titularYaAsignadoEstaSemana: false,
      });
      expect(warnings.find((w) => w.tipo === "doble_asignacion")).toBeUndefined();
    });
  });

  describe("suave: needs_review", () => {
    it("retorna warning cuando parte necesita revisión", () => {
      const { warnings } = check({
        titular: makePub(),
        part: makePart({ needsReview: true }),
      });
      expect(warnings).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ tipo: "needs_review", duro: false }),
        ])
      );
    });

    it("no retorna warning cuando parte no necesita revisión", () => {
      const { warnings } = check({
        titular: makePub(),
        part: makePart({ needsReview: false }),
      });
      expect(warnings.find((w) => w.tipo === "needs_review")).toBeUndefined();
    });
  });

  describe("caso limpio: sin warnings", () => {
    it("retorna array vacío cuando todo es válido", () => {
      const { warnings } = check({
        titular: makePub(),
        part: makePart(),
      });
      expect(warnings).toHaveLength(0);
    });
  });
});
