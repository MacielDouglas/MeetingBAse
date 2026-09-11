// Template engine for TheocBase-style .htm templates.
// Variables: !VAR! | Conditionals: #IF !VAR!#...#ELSE#...#ENDIF#
// Loops: #REPEAT_START!VAR!#...#REPEAT_END# | #TERRITORY_START#...#TERRITORY_END#
// #SPEAKER_START#...#SPEAKER_END#

export interface TemplateVars {
  [key: string]: string | number | undefined;
}

export interface TemplateRepeat {
  key: string;
  rows: TemplateVars[];
}

export function renderTemplate(
  html: string,
  vars: TemplateVars,
  repeats: TemplateRepeat[] = []
): string {
  let result = html;

  // Process conditionals: #IF !VAR!#...#ELSE#...#ENDIF# or #IF !VAR!#...#ENDIF#
  result = result.replace(
    /#IF\s+!(\w+)!\s*#([\s\S]*?)(?:#ELSE#([\s\S]*?))?#ENDIF#/g,
    (_, key: string, ifBlock: string, elseBlock: string) => {
      const val = vars[key];
      if (val && val !== "" && val !== "0" && val !== "false") {
        return processBlock(ifBlock, vars, repeats);
      }
      return elseBlock ? processBlock(elseBlock, vars, repeats) : "";
    }
  );

  // Process repeats: #REPEAT_START!key!#...#REPEAT_END#
  result = result.replace(
    /#REPEAT_START!(\w+)!#([\s\S]*?)#REPEAT_END#/g,
    (_, key: string, block: string) => {
      const repeat = repeats.find((r) => r.key === key);
      if (!repeat) return "";
      return repeat.rows.map((row) => processBlock(block, { ...vars, ...row }, repeats)).join("");
    }
  );

  // Process territory/speaker loops (legacy TheocBase format)
  result = result.replace(
    /#TERRITORY_START#([\s\S]*?)#TERRITORY_END#/g,
    (_, block: string) => {
      const repeat = repeats.find((r) => r.key === "territories");
      if (!repeat) return "";
      return repeat.rows.map((row) => processBlock(block, { ...vars, ...row }, repeats)).join("");
    }
  );

  result = result.replace(
    /#SPEAKER_START#([\s\S]*?)#SPEAKER_END#/g,
    (_, block: string) => {
      const repeat = repeats.find((r) => r.key === "speakers");
      if (!repeat) return "";
      return repeat.rows.map((row) => processBlock(block, { ...vars, ...row }, repeats)).join("");
    }
  );

  // Replace remaining variables: !VAR!
  result = result.replace(/!(\w+)!/g, (_, key: string) => {
    const val = vars[key];
    return val !== undefined ? String(val) : "";
  });

  return result;
}

function processBlock(
  block: string,
  vars: TemplateVars,
  repeats: TemplateRepeat[]
): string {
  let result = block;

  // Nested conditionals
  result = result.replace(
    /#IF\s+!(\w+)!\s*#([\s\S]*?)(?:#ELSE#([\s\S]*?))?#ENDIF#/g,
    (_, key: string, ifBlock: string, elseBlock: string) => {
      const val = vars[key];
      if (val && val !== "" && val !== "0" && val !== "false") {
        return processBlock(ifBlock, vars, repeats);
      }
      return elseBlock ? processBlock(elseBlock, vars, repeats) : "";
    }
  );

  // Variables in block
  result = result.replace(/!(\w+)!/g, (_, key: string) => {
    const val = vars[key];
    return val !== undefined ? String(val) : "";
  });

  return result;
}

// Build meeting vars from a confirmed meeting.
// Optionally enriches with song/talk catalog data and assignment names.
export function meetingToVars(
  m: Record<string, unknown>,
  songCatalog?: { number: number; title: string }[],
  talkCatalog?: { number: number; title: string }[],
  assignments?: { part_id: string; titular_name: string; ayudante_name?: string }[],
): TemplateVars {
  const parts = (m.parts ?? []) as Record<string, unknown>[];
  const find = (tipo: string) => parts.find((p) => p.tipo_clave === tipo);
  const str = (v: unknown): string => (v !== undefined && v !== null ? String(v) : "");
  const num = (v: unknown): string => (v !== undefined && v !== null ? String(v) : "0");

  // Helper: look up song title by number from catalog
  const songTitle = (songNum: unknown): string => {
    const n = typeof songNum === "number" ? songNum : typeof songNum === "string" ? parseInt(songNum, 10) : 0;
    if (n <= 0 || !songCatalog) return `Canción ${n}`;
    const entry = songCatalog.find((s) => s.number === n);
    return entry ? `Canción ${n} — ${entry.title}` : `Canción ${n}`;
  };

  // Helper: look up publisher name by part_id from assignments
  const titularName = (tipoClave: string): string => {
    if (!assignments) return "";
    const part = parts.find((p) => p.tipo_clave === tipoClave);
    if (!part) return "";
    const a = assignments.find((x) => x.part_id === part.id);
    return a?.titular_name ?? "";
  };

  // Find the WT conductor (titular of w_estudio part)
  const wtConductor = titularName("w_estudio");

  return {
    DATE: str(m.fecha),
    TITLE: str(m.semana_label),
    CONGREGATION_TITLE: "Meeting Base",
    MWB_COLOR: "#1a5276",
    WT_COLOR: "#7d3c98",
    LECTURA_SEMANAL: str(m.lectura_semanal),
    // Midweek sections
    GW1_THEME: str(find("mwb_tgw_talk")?.titulo),
    GW1_SPEAKER: titularName("mwb_tgw_talk"),
    GW1_TIME: num(find("mwb_tgw_talk")?.duracion_min ?? 10),
    GW2_THEME: str(find("mwb_tgw_gems")?.titulo),
    GW2_TIME: num(find("mwb_tgw_gems")?.duracion_min ?? 10),
    GW3_THEME: str(find("mwb_tgw_bread")?.titulo),
    GW3_TIME: num(find("mwb_tgw_bread")?.duracion_min ?? 4),
    FM1_THEME: str(find("mwb_ayf_part1")?.titulo),
    FM1_SPEAKER_A: titularName("mwb_ayf_part1"),
    FM2_THEME: str(find("mwb_ayf_part2")?.titulo),
    FM2_SPEAKER_A: titularName("mwb_ayf_part2"),
    FM3_THEME: str(find("mwb_ayf_part3")?.titulo),
    FM3_SPEAKER_A: titularName("mwb_ayf_part3"),
    FM4_THEME: str(find("mwb_ayf_part4")?.titulo),
    FM4_SPEAKER_A: titularName("mwb_ayf_part4"),
    CL1_THEME: str(find("mwb_lc_part1")?.titulo),
    CL1_SPEAKER_A: titularName("mwb_lc_part1"),
    CL2_THEME: str(find("mwb_lc_part2")?.titulo),
    CL2_SPEAKER_A: titularName("mwb_lc_part2"),
    CBS_THEME: str(find("mwb_lc_cbs")?.titulo),
    CBS_SPEAKER_A: titularName("mwb_lc_cbs"),
    // Weekend sections
    PT_THEME: str(find("discurso_publico")?.titulo),
    PT_SPEAKER: titularName("discurso_publico"),
    PT_NO: "",
    WT_THEME: str(find("w_estudio")?.titulo),
    WT_CONDUCTOR: wtConductor,
    // Songs — enriched with catalog titles when available
    SONG1: songTitle(m.cancion_inicial),
    SONG2: songTitle(m.cancion_intermedia),
    SONG3: songTitle(m.cancion_final),
  };
}

// List of available templates
export interface TemplateInfo {
  id: string;
  name: string;
  description: string;
  filename: string;
}

export const AVAILABLE_TEMPLATES: TemplateInfo[] = [
  { id: "mw-handout", name: "Folha de mão MW", description: "Folha de mão reunião meio da semana", filename: "MW-Handout.htm" },
  { id: "we-handout", name: "Folha de mão WE", description: "Folha de mão reunião fim de semana", filename: "WE-Handout.htm" },
  { id: "combo-1", name: "Horário combinado", description: "Horário combinado (meio + fim semana)", filename: "COMBO_1.htm" },
  { id: "mw-schedule", name: "Escala MW", description: "Escala reunião meio da semana", filename: "MW-Schedule_1.htm" },
  { id: "we-schedule", name: "Escala WE", description: "Escala reunião fim de semana", filename: "WE-Schedule_1.htm" },
  { id: "pt-speakers", name: "Lista de falantes", description: "Lista de falantes públicos", filename: "PT-TalksOfSpeakers_Simple.htm" },
  { id: "we-calllist", name: "Lista de llamadas", description: "Lista de llamadas palestras públicas", filename: "WE-CallList.htm" },
];
