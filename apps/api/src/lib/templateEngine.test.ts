import { describe, it, expect } from "vitest";
import { renderTemplate, meetingToVars } from "./templateEngine.js";

describe("renderTemplate", () => {
  it("replaces variables", () => {
    const html = "<h1>!TITLE!</h1><p>!DATE!</p>";
    const vars = { TITLE: "Reunión", DATE: "2026-01-01" };
    expect(renderTemplate(html, vars)).toBe("<h1>Reunión</h1><p>2026-01-01</p>");
  });

  it("handles conditionals true", () => {
    const html = "#IF !SHOW_ME!#visible#ENDIF#";
    const vars = { SHOW_ME: "yes" };
    expect(renderTemplate(html, vars)).toBe("visible");
  });

  it("handles conditionals false", () => {
    const html = "#IF !SHOW_ME!#visible#ENDIF#";
    const vars = { SHOW_ME: "" };
    expect(renderTemplate(html, vars)).toBe("");
  });

  it("handles conditionals with else", () => {
    const html = "#IF !SHOW_ME!#yes#ELSE#no#ENDIF#";
    expect(renderTemplate(html, { SHOW_ME: "1" })).toBe("yes");
    expect(renderTemplate(html, { SHOW_ME: "" })).toBe("no");
  });

  it("handles repeats", () => {
    const html = "#REPEAT_START!ITEMS!#!NAME! #REPEAT_END#";
    const vars = {};
    const repeats = [{ key: "ITEMS", rows: [{ NAME: "A" }, { NAME: "B" }] }];
    expect(renderTemplate(html, vars, repeats)).toBe("A B ");
  });

  it("handles !REPEAT_START! variant", () => {
    const html = "!REPEAT_START!ITEMS!!NAME! !REPEAT_END!";
    const vars = {};
    const repeats = [{ key: "ITEMS", rows: [{ NAME: "A" }, { NAME: "B" }] }];
    expect(renderTemplate(html, vars, repeats)).toBe("A B ");
  });

  it("handles EMPTY conditionals", () => {
    const html = "#IF !PRAYER1_NAME! EMPTY#sin oración#ELSE#!PRAYER1_NAME!#ENDIF#";
    expect(renderTemplate(html, { PRAYER1_NAME: "" })).toBe("sin oración");
    expect(renderTemplate(html, { PRAYER1_NAME: "Juan" })).toBe("Juan");
    expect(renderTemplate(html, {})).toBe("sin oración");
  });
});

describe("meetingToVars", () => {
  it("builds vars from meeting data", () => {
    const meeting = {
      fecha: "2026-01-01",
      semana_label: "1-7 de enero",
      lectura_semanal: "Génesis 1",
      cancion_inicial: 1,
      cancion_intermedia: 44,
      cancion_final: 33,
      parts: [
        { tipo_clave: "mwb_tgw_talk", titulo: "Discurso", duracion_min: 10 },
        { tipo_clave: "w_estudio", titulo: "Estudio Atalaya" },
      ],
    };
    const vars = meetingToVars(meeting);
    expect(vars.DATE).toBe("2026-01-01");
    expect(vars.TITLE).toBe("1-7 de enero");
    expect(vars.GW1_THEME).toBe("Discurso");
    expect(vars.WT_THEME).toBe("Estudio Atalaya");
  });

  it("enriches song titles from catalog", () => {
    const meeting = { cancion_inicial: 1, parts: [] };
    const songs = [{ number: 1, title: "Cualidades de Jehová" }];
    const vars = meetingToVars(meeting, songs);
    expect(vars.SONG1).toBe("Canción 1 — Cualidades de Jehová");
  });

  it("fills speaker names from assignments", () => {
    const meeting = {
      parts: [
        { id: "p1", tipo_clave: "mwb_tgw_talk", titulo: "Tema" },
      ],
    };
    const assigns = [{ part_id: "p1", titular_name: "Carlos Méndez" }];
    const vars = meetingToVars(meeting, undefined, undefined, assigns);
    expect(vars.GW1_SPEAKER).toBe("Carlos Méndez");
  });

  it("tolerates camelCase parts (memoria)", () => {
    const meeting = {
      parts: [
        { id: "p1", tipoClave: "mwb_tgw_talk", titulo: "Tema", duracionMin: 10, horaInicio: "19:04" },
      ],
    };
    const vars = meetingToVars(meeting);
    expect(vars.GW1_THEME).toBe("Tema");
    expect(vars.GW1_STARTTIME).toBe("19:04");
  });
});
