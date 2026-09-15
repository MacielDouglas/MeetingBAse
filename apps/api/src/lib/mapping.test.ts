import { describe, it, expect } from "vitest";
import {
  detectPubKind,
  mapMwbToParts,
  mapWatchtowerToParts,
  mapS34ToParts,
  mapSjjToParts,
  type MwbRow,
} from "../../../../packages/db/mapping.js";

describe("detectPubKind", () => {
  it("detecta MWB", () => {
    expect(detectPubKind("mwb_S_E_202601.jwpub")).toBe("mwb");
  });

  it("detecta W", () => {
    expect(detectPubKind("w_S_202601.jwpub")).toBe("w");
  });

  it("detecta S-34", () => {
    expect(detectPubKind("S-34_S.jwpub")).toBe("s34");
  });

  it("detecta sjj", () => {
    expect(detectPubKind("sjj_S.jwpub")).toBe("sjj");
  });

  it("retorna mwb por defecto para nombre desconocido", () => {
    expect(detectPubKind("otro.jwpub")).toBe("mwb");
  });

  it("maneja rutas con slashes", () => {
    expect(detectPubKind("C:\\Users\\test\\mwb_S_E.jwpub")).toBe("mwb");
  });
});

describe("mapMwbToParts", () => {
  it("genera 14 partes con presidente incluido", () => {
    const row: MwbRow = {
      mwb_song_first: 1,
      mwb_tgw_talk_title: "Discurso introductorio",
      mwb_tgw_gems_title: "Perlas espirituales",
      mwb_tgw_bread_title: "Lectura de la Biblia",
      mwb_tgw_bread: "Juan 3:16",
      mwb_ayf_count: 4,
      mwb_ayf_part1_title: "Hoja de vida",
      mwb_ayf_part1: "Efesios 4:25",
      mwb_ayf_part1_time: 10,
      mwb_ayf_part2_title: "Aplicar la Biblia",
      mwb_ayf_part2: "Filipenses 4:13",
      mwb_ayf_part2_time: 10,
      mwb_ayf_part3_title: "Lectura de la Biblia",
      mwb_ayf_part3: "Romanos 12:2",
      mwb_ayf_part3_time: 10,
      mwb_ayf_part4_title: "Discurso",
      mwb_ayf_part4: "1 Corintios 10:13",
      mwb_ayf_part4_time: 10,
      mwb_song_middle: 44,
      mwb_lc_count: 2,
      mwb_lc_part1_title: "Vida 1",
      mwb_lc_part1_content: "contenido",
      mwb_lc_part2_title: "Vida 2",
      mwb_lc_cbs_title: "Estudio la Biblia",
    };
    const parts = mapMwbToParts(row);
    expect(parts).toHaveLength(14);
    // 0: cancion inicial
    expect(parts[0].tipoClave).toBe("cancion_inicial");
    expect(parts[0].titulo).toBe("Canción 1");
    // 1: presidente
    expect(parts[1].tipoClave).toBe("wk_presidente");
    // 2-4: tesoros
    expect(parts[2].tipoClave).toBe("mwb_tgw_talk");
    expect(parts[3].tipoClave).toBe("mwb_tgw_gems");
    expect(parts[4].tipoClave).toBe("mwb_tgw_bread");
    expect(parts[4].requiereAyudante).toBe(false);
    // 5-8: AYF
    expect(parts[5].tipoClave).toBe("mwb_ayf_iniciar");
    expect(parts[6].tipoClave).toBe("mwb_ayf_cultivar");
    expect(parts[7].tipoClave).toBe("mwb_ayf_explicar_discurso");
    expect(parts[8].tipoClave).toBe("mwb_ayf_explicar_demo");
    // 9: cancion intermedia
    expect(parts[9].tipoClave).toBe("cancion_intermedia");
    // 10-11: vida
    expect(parts[10].tipoClave).toBe("mwb_lc_part1");
    expect(parts[11].tipoClave).toBe("mwb_lc_part2");
    // 12: EBC
    expect(parts[12].tipoClave).toBe("mwb_lc_cbs");
    // 13: cancion final
    expect(parts[13].tipoClave).toBe("cancion_final");
  });

  it("genera placeholders para AYF faltantes", () => {
    const row: MwbRow = {
      mwb_ayf_count: 2,
      mwb_song_first: 1,
    };
    const parts = mapMwbToParts(row);
    const ayfParts = parts.filter((p) =>
      p.tipoClave === "mwb_ayf_iniciar" ||
      p.tipoClave === "mwb_ayf_cultivar" ||
      p.tipoClave === "mwb_ayf_explicar_discurso" ||
      p.tipoClave === "mwb_ayf_explicar_demo"
    );
    expect(ayfParts).toHaveLength(4);
    expect(ayfParts[0].needsReview).toBeFalsy(); // tiene dato
    expect(ayfParts[1].needsReview).toBeFalsy(); // tiene dato
    expect(ayfParts[2].needsReview).toBe(true);  // placeholder
    expect(ayfParts[3].needsReview).toBe(true);  // placeholder
  });

  it("genera placeholders para partes Vida faltantes", () => {
    const row: MwbRow = {
      mwb_lc_count: 0,
      mwb_song_first: 1,
    };
    const parts = mapMwbToParts(row);
    const vidaParts = parts.filter((p) => p.tipoClave.startsWith("mwb_lc_part"));
    expect(vidaParts).toHaveLength(2);
    expect(vidaParts[0].needsReview).toBe(true);
    expect(vidaParts[1].needsReview).toBe(true);
  });

  it("marca needsReview en canciones sin número", () => {
    const row: MwbRow = {};
    const parts = mapMwbToParts(row);
    expect(parts[0].needsReview).toBe(true);   // cancion inicial
    expect(parts[9].needsReview).toBe(true);   // cancion intermedia
    expect(parts[13].needsReview).toBe(true);  // cancion final
  });
});

describe("mapWatchtowerToParts", () => {
  it("genera 8 partes con presidente y sentinela", () => {
    const row: MwbRow = {
      w_study_opening_song: 50,
      w_study_title: "Estudio: La Biblia",
      w_study_concluding_song: 33,
    };
    const parts = mapWatchtowerToParts(row);
    expect(parts).toHaveLength(8);
    expect(parts[0].tipoClave).toBe("wk_oracion");
    expect(parts[1].tipoClave).toBe("cancion_inicial");
    expect(parts[1].titulo).toBe("Canción 50");
    expect(parts[2].tipoClave).toBe("wk_presidente");
    expect(parts[3].tipoClave).toBe("wk_discurso_publico");
    expect(parts[4].tipoClave).toBe("wk_sentinela_dirigente");
    expect(parts[5].tipoClave).toBe("wk_sentinela_leitor");
    expect(parts[6].tipoClave).toBe("w_estudio");
    expect(parts[6].titulo).toBe("Estudio: La Biblia");
    expect(parts[7].tipoClave).toBe("cancion_final");
  });

  it("marca needsReview en canciones sin número", () => {
    const row: MwbRow = {};
    const parts = mapWatchtowerToParts(row);
    expect(parts[1].needsReview).toBe(true);   // cancion inicial
    expect(parts[7].needsReview).toBe(true);   // cancion final
  });
});

describe("mapS34ToParts", () => {
  it("genera 1 parte de discurso", () => {
    const row: MwbRow = {
      s34_title: "La oración",
      s34_speaker: "Juan Pérez",
    };
    const parts = mapS34ToParts(row);
    expect(parts).toHaveLength(1);
    expect(parts[0].tipoClave).toBe("s34_discurso");
    expect(parts[0].titulo).toBe("La oración");
    expect(parts[0].detalle).toBe("Orador: Juan Pérez");
  });

  it("usa titulo por defecto si no hay dato", () => {
    const row: MwbRow = {};
    const parts = mapS34ToParts(row);
    expect(parts[0].titulo).toBe("Discurso público");
  });
});

describe("mapSjjToParts", () => {
  it("genera 1 parte de cantico", () => {
    const row: MwbRow = {
      sjj_number: 1,
      sjj_title: "Cualidades de Jehová",
    };
    const parts = mapSjjToParts(row);
    expect(parts).toHaveLength(1);
    expect(parts[0].tipoClave).toBe("sjj_cancion");
    expect(parts[0].titulo).toBe("Canción 1 — Cualidades de Jehová");
  });

  it("usa titulo por defecto si no hay número", () => {
    const row: MwbRow = {};
    const parts = mapSjjToParts(row);
    expect(parts[0].titulo).toBe("Cántico");
  });
});
