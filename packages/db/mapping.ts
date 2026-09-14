// MWB rows (meeting-schedules-parser) -> parts. Fixed order 1..13. Room A.
// Orden fija: 1 cancion inicial, 2 Tesoros discurso, 3 Perlas,
// 4 Lectura estudiante (ayudante), 5..8 AYF 1..4 (Iniciar, Cultivar,
// Explicar Discurso, Explicar Demo), 9 cancion intermedia,
// 10..11 Vida 1..2, 12 EBC 30min, 13 cancion final.
// Weekend: Oración, Canción, Presidente, Discurso público,
// Dirigente Sentinela, Leitor Sentinela, Estudio Atalaya, Canción final.

export type MwbRow = Record<string, string | number | undefined>;

export interface PartDraft {
  orden: number;
  seccion: string;
  tipoClave: string;
  titulo: string;
  detalle?: string;
  duracionMin?: number;
  requiereAyudante: boolean;
  needsReview?: boolean;
  horaInicio?: string;
}

export type PubKind = "mwb" | "w" | "s34" | "sjj";

// Detect kind by file name.
// mwb_S_*.jwpub → midweek (Estudio en la Biblia)
// w_S_*.jwpub   → weekend (Atalaya/Estudio)
// S-34_S.jwpub  → weekend (Discursos públicos)
// sjj_S.jwpub   → both meetings (Cánticos)
export function detectPubKind(filename: string): PubKind {
  const base = filename.split(/[\\/]/).pop() ?? filename;
  const low = base.toLowerCase();
  if (low.startsWith("mwb_")) return "mwb";
  if (low.startsWith("w_")) return "w";
  if (low.startsWith("s-34")) return "s34";
  if (low.startsWith("sjj_")) return "sjj";
  return "mwb";
}

const str = (v: unknown) => (v === undefined || v === null ? "" : String(v));
const num = (v: unknown) => (typeof v === "number" ? v : undefined);

function songTitle(n: unknown): { titulo: string; needsReview: boolean } {
  const v = num(n);
  if (v === undefined) return { titulo: "Canción — por confirmar", needsReview: true };
  return { titulo: `Canción ${v}`, needsReview: false };
}

function emptySlot(orden: number, seccion: string, tipoClave: string): PartDraft {
  return {
    orden,
    seccion,
    tipoClave,
    titulo: "Sin asignar — completar manualmente",
    detalle: "",
    requiereAyudante: seccion === "MAESTROS",
    needsReview: true,
  };
}

export function mapMwbToParts(row: MwbRow): PartDraft[] {
  const parts: PartDraft[] = [];
  const ayfCount = Number(row.mwb_ayf_count ?? 0);
  const lcCount = Number(row.mwb_lc_count ?? 0);

  const s1 = songTitle(row.mwb_song_first);
  parts.push({
    orden: 1, seccion: "CANCION", tipoClave: "cancion_inicial",
    titulo: s1.titulo, duracionMin: 4, requiereAyudante: false, needsReview: s1.needsReview,
  });

  parts.push({
    orden: 2, seccion: "PRESIDENTE", tipoClave: "wk_presidente",
    titulo: "Presidente de la reunión", duracionMin: 1, requiereAyudante: false,
  });

  parts.push({
    orden: 3, seccion: "TESOROS", tipoClave: "mwb_tgw_talk",
    titulo: str(row.mwb_tgw_talk_title || row.mwb_tgw_talk),
    duracionMin: 10, requiereAyudante: false,
  });

  parts.push({
    orden: 4, seccion: "TESOROS", tipoClave: "mwb_tgw_gems",
    titulo: str(row.mwb_tgw_gems_title),
    duracionMin: 10, requiereAyudante: false,
  });

  parts.push({
    orden: 5, seccion: "TESOROS", tipoClave: "mwb_tgw_bread",
    titulo: str(row.mwb_tgw_bread_title || row.mwb_tgw_bread),
    detalle: str(row.mwb_tgw_bread),
    duracionMin: 4, requiereAyudante: false,
  });

  // AYF slots 6..9 (orden 6..9). Missing -> placeholder with needsReview.
  const AYF_TIPO_KEYS = [
    "mwb_ayf_iniciar",
    "mwb_ayf_cultivar",
    "mwb_ayf_explicar_discurso",
    "mwb_ayf_explicar_demo",
  ];
  for (let i = 1; i <= 4; i += 1) {
    const orden = 5 + i;
    const tipoClave = AYF_TIPO_KEYS[i - 1];
    if (i <= ayfCount) {
      parts.push({
        orden,
        seccion: "MAESTROS",
        tipoClave,
        titulo: str(row[`mwb_ayf_part${i}_title`] || row[`mwb_ayf_part${i}`]),
        detalle: str(row[`mwb_ayf_part${i}`]),
        duracionMin: num(row[`mwb_ayf_part${i}_time`]),
        requiereAyudante: tipoClave === "mwb_ayf_explicar_demo",
      });
    } else {
      parts.push(emptySlot(orden, "MAESTROS", tipoClave));
    }
  }

  const sm = songTitle(row.mwb_song_middle);
  parts.push({
    orden: 10, seccion: "CANCION", tipoClave: "cancion_intermedia",
    titulo: sm.titulo, duracionMin: 4, requiereAyudante: false, needsReview: sm.needsReview,
  });

  // Vida slots 11..12. Missing -> placeholder.
  for (let i = 1; i <= 2; i += 1) {
    const orden = 10 + i;
    if (i <= lcCount) {
      parts.push({
        orden,
        seccion: "VIDA",
        tipoClave: `mwb_lc_part${i}`,
        titulo: str(row[`mwb_lc_part${i}_title`] || row[`mwb_lc_part${i}`]),
        detalle: str(row[`mwb_lc_part${i}_content`]),
        duracionMin: num(row[`mwb_lc_part${i}_time`]),
        requiereAyudante: false,
      });
    } else {
      parts.push(emptySlot(orden, "VIDA", `mwb_lc_part${i}`));
    }
  }

  parts.push({
    orden: 13, seccion: "EBC", tipoClave: "mwb_lc_cbs",
    titulo: str(row.mwb_lc_cbs_title || row.mwb_lc_cbs),
    detalle: str(row.mwb_lc_cbs),
    duracionMin: 30, requiereAyudante: false,
  });

  const s3 = songTitle(row.mwb_song_conclude);
  parts.push({
    orden: 14, seccion: "CANCION", tipoClave: "cancion_final",
    titulo: s3.titulo, duracionMin: 4, requiereAyudante: false, needsReview: s3.needsReview,
  });

  return parts;
}

export function mapWatchtowerToParts(row: MwbRow): PartDraft[] {
  const s1 = songTitle(row.w_study_opening_song);
  const s2 = songTitle(row.w_study_concluding_song);
  return [
    { orden: 1, seccion: "ORACION", tipoClave: "wk_oracion", titulo: "Oración inicial", duracionMin: 1, requiereAyudante: false, needsReview: false },
    { orden: 2, seccion: "CANCION", tipoClave: "cancion_inicial", titulo: s1.titulo, duracionMin: 4, requiereAyudante: false, needsReview: s1.needsReview },
    { orden: 3, seccion: "PRESIDENTE", tipoClave: "wk_presidente", titulo: "Presidente de la reunión", duracionMin: 2, requiereAyudante: false, needsReview: false },
    { orden: 4, seccion: "DISCURSO", tipoClave: "wk_discurso_publico", titulo: str(row.w_public_talk_title || "Discurso público"), duracionMin: 30, requiereAyudante: false, needsReview: true },
    { orden: 5, seccion: "SENTINELA", tipoClave: "wk_sentinela_dirigente", titulo: "Dirigente de la Atalaya", duracionMin: 15, requiereAyudante: false },
    { orden: 6, seccion: "SENTINELA", tipoClave: "wk_sentinela_leitor", titulo: "Lector de la Atalaya", duracionMin: 15, requiereAyudante: false },
    { orden: 7, seccion: "ATALAYA", tipoClave: "w_estudio", titulo: str(row.w_study_title), duracionMin: 60, requiereAyudante: false },
    { orden: 8, seccion: "CANCION", tipoClave: "cancion_final", titulo: s2.titulo, duracionMin: 4, requiereAyudante: false, needsReview: s2.needsReview },
  ];
}

// S-34: Discursos públicos. Cada row es un discurso (título, orador, etc.)
export function mapS34ToParts(row: MwbRow): PartDraft[] {
  const title = str(row.s34_title || row.title || "Discurso público");
  const speaker = str(row.s34_speaker || row.speaker);
  return [
    {
      orden: 1,
      seccion: "DISCURSO",
      tipoClave: "s34_discurso",
      titulo: title,
      detalle: speaker ? `Orador: ${speaker}` : undefined,
      duracionMin: 30,
      requiereAyudante: false,
    },
  ];
}

// Fase 10 — horários. Tenta ler o início da reunião da linha parseada
// (vários nomes possíveis conforme o parser) e calcula o início de cada
// parte de forma cumulativa (início + durações). Formato "HH:MM".

const START_KEYS = [
  "starttime", "start_time", "meeting_starttime", "meeting_start_time",
  "mwb_starttime", "mwb_start_time", "w_starttime", "w_start_time",
  "hora_inicio", "hora", "time",
];

export function parseMeetingStart(row: MwbRow): string | null {
  for (const k of START_KEYS) {
    const v = row[k];
    if (typeof v === "string" && /^\d{1,2}:\d{2}/.test(v.trim())) {
      const [h, m] = v.trim().split(":");
      return `${h.padStart(2, "0")}:${m.slice(0, 2)}`;
    }
  }
  return null;
}

function toMin(hhmm: string): number | null {
  const m = /^(\d{1,2}):(\d{2})/.exec(hhmm);
  if (!m) return null;
  return Number(m[1]) * 60 + Number(m[2]);
}

function toHHMM(min: number): string {
  const h = Math.floor(min / 60) % 24;
  const m = min % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

// Preenche horaInicio de cada parte a partir do início da reunião.
// Sem horário base, mantém undefined.
export function applyStartTimes(base: string | null, parts: PartDraft[]): void {
  const start = base ? toMin(base) : null;
  if (start === null) return;
  let acc = start;
  for (const p of parts) {
    p.horaInicio = toHHMM(acc);
    acc += typeof p.duracionMin === "number" ? p.duracionMin : 0;
  }
}
export function mapSjjToParts(row: MwbRow): PartDraft[] {
  // sjj: Cánticos. Cada row es un canto (número, título).
  const songNum = num(row.sjj_number || row.number);
  const title = str(row.sjj_title || row.title || "Cántico");
  return [
    {
      orden: 1,
      seccion: "CANCION",
      tipoClave: "sjj_cancion",
      titulo: songNum ? `Canción ${songNum} — ${title}` : title,
      duracionMin: 3,
      requiereAyudante: false,
    },
  ];
}
