import { describe, it, expect } from "vitest";
import {
  parseMeetingStart,
  applyStartTimes,
  type MwbRow,
  type PartDraft,
} from "../../../../packages/db/mapping.js";

function draft(duracionMin?: number): PartDraft {
  return {
    orden: 1,
    seccion: "TESOROS",
    tipoClave: "mwb_tgw_talk",
    titulo: "Discurso",
    requiereAyudante: false,
    ...(duracionMin !== undefined ? { duracionMin } : {}),
  };
}

describe("parseMeetingStart", () => {
  it("encuentra hora_inicio con formato HH:MM", () => {
    expect(parseMeetingStart({ hora_inicio: "19:30" } as MwbRow)).toBe("19:30");
  });
  it("acepta chaves alternativas (start_time, hora, time)", () => {
    expect(parseMeetingStart({ start_time: "18:45" } as MwbRow)).toBe("18:45");
    expect(parseMeetingStart({ hora: "20:00" } as MwbRow)).toBe("20:00");
    expect(parseMeetingStart({ time: "9:05" } as MwbRow)).toBe("09:05");
  });
  it("normaliza hora com um dígito e ignora segundos", () => {
    expect(parseMeetingStart({ starttime: "9:05" } as MwbRow)).toBe("09:05");
    expect(parseMeetingStart({ starttime: "19:30:00" } as MwbRow)).toBe("19:30");
  });
  it("ignora espaços e retorna null sem horário válido", () => {
    expect(parseMeetingStart({ hora_inicio: "  19:30  " } as MwbRow)).toBe("19:30");
    expect(parseMeetingStart({} as MwbRow)).toBeNull();
    expect(parseMeetingStart({ hora: "noite" } as MwbRow)).toBeNull();
    expect(parseMeetingStart({ hora: "19h30" } as MwbRow)).toBeNull();
  });
});

describe("applyStartTimes", () => {
  it("calcula início cumulativo das partes", () => {
    const parts = [draft(10), draft(5), draft(30)];
    applyStartTimes("19:00", parts);
    expect(parts.map((p) => p.horaInicio)).toEqual(["19:00", "19:10", "19:15"]);
  });
  it("parte sem duração não avança o relógio", () => {
    const parts = [draft(), draft(15)];
    applyStartTimes("18:00", parts);
    expect(parts.map((p) => p.horaInicio)).toEqual(["18:00", "18:00"]);
  });
  it("sem horário base mantém horaInicio indefinida", () => {
    const parts = [draft(10)];
    applyStartTimes(null, parts);
    expect(parts[0].horaInicio).toBeUndefined();
  });
  it("lista vazia não quebra", () => {
    expect(() => applyStartTimes("19:00", [])).not.toThrow();
  });
});
