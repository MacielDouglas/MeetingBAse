// Lectura offline del programa: meetings + parts + titular + warnings.
// iOS + Android via expo-sqlite. Chamado por usePrograma após o sync.

import { getDb } from "./db";

// ---------- tipos de lectura ----------

export interface ProgramaWarning {
  id: string;
  tipo: string;
  mensaje_es: string;
}

export interface ProgramaPart {
  id: string;
  meeting_id: string;
  orden: number;
  seccion: string | null;
  tipo_clave: string | null;
  titulo: string;
  sala: string;
  requiere_ayudante: boolean;
  needs_review: boolean;
  duracion_min: number | null;
  hora_inicio: string | null;
  titular_id: string | null;
  ayudante_id: string | null;
  warnings: ProgramaWarning[];
}

export interface ProgramaPrayer {
  id: string;
  tipo: string;
  publisher_id: string | null;
}

export interface ProgramaMeeting {
  id: string;
  fecha: string;
  tipo: string;
  semana_label: string | null;
  estado: string;
  sala: string;
  hora_inicio: string | null;
  lectura_semanal: string | null;
  titulo_atalaya: string | null;
  cancion_inicial: number | null;
  cancion_intermedia: number | null;
  cancion_final: number | null;
  parts: ProgramaPart[];
  prayers: ProgramaPrayer[];
}

// Lee el programa offline: meetings + parts + titular + warnings.
// Warnings son por (meeting, publisher): se muestran en cada parte
// cuyo titular coincide con publisher_id.
export async function loadPrograma(congregationId: string): Promise<ProgramaMeeting[]> {
  const d = getDb();
  const ms = d.getAllSync<{
    id: string;
    fecha: string;
    tipo: string;
    semana_label: string | null;
    estado: string;
    sala: string;
    hora_inicio: string | null;
    lectura_semanal: string | null;
    titulo_atalaya: string | null;
    cancion_inicial: number | null;
    cancion_intermedia: number | null;
    cancion_final: number | null;
  }>(
    "SELECT id, fecha, tipo, semana_label, estado, sala, hora_inicio, lectura_semanal, titulo_atalaya, cancion_inicial, cancion_intermedia, cancion_final FROM meetings WHERE congregation_id = ? ORDER BY fecha ASC",
    congregationId
  );
  if (ms.length === 0) return [];
  const ps = d.getAllSync<{
    id: string;
    meeting_id: string;
    orden: number;
    seccion: string | null;
    tipo_clave: string | null;
    titulo: string;
    sala: string;
    requiere_ayudante: number;
    needs_review: number;
    duracion_min: number | null;
    hora_inicio: string | null;
  }>(
    "SELECT id, meeting_id, orden, seccion, tipo_clave, titulo, sala, requiere_ayudante, needs_review, duracion_min, hora_inicio FROM parts WHERE meeting_id IN (SELECT id FROM meetings WHERE congregation_id = ?) ORDER BY meeting_id, orden ASC",
    congregationId
  );
  const as = d.getAllSync<{
    part_id: string;
    meeting_id: string;
    titular_id: string;
    ayudante_id: string | null;
  }>(
    "SELECT part_id, meeting_id, titular_id, ayudante_id FROM assignments WHERE congregation_id = ?",
    congregationId
  );
  const ws = d.getAllSync<{
    id: string;
    meeting_id: string;
    publisher_id: string;
    part_id: string | null;
    tipo: string;
    mensaje_es: string;
  }>(
    "SELECT id, meeting_id, publisher_id, part_id, tipo, mensaje_es FROM warnings WHERE meeting_id IN (SELECT id FROM meetings WHERE congregation_id = ?)",
    congregationId
  );

  const byPart = new Map(as.map((a) => [a.part_id, a]));
  const prs = d.getAllSync<{
    id: string;
    meeting_id: string;
    tipo: string;
    publisher_id: string | null;
  }>(
    "SELECT id, meeting_id, tipo, publisher_id FROM prayers WHERE congregation_id = ?",
    congregationId
  );
  const prayersByMeeting = new Map<string, ProgramaPrayer[]>();
  for (const pr of prs) {
    const list = prayersByMeeting.get(pr.meeting_id) ?? [];
    list.push({ id: pr.id, tipo: pr.tipo, publisher_id: pr.publisher_id });
    prayersByMeeting.set(pr.meeting_id, list);
  }
  // Catálogo de cânticos: "Canción N" → "Canción N — Título".
  const songs = d.getAllSync<{ number: number; title: string }>(
    "SELECT number, title FROM song_catalog WHERE congregation_id = ?",
    congregationId
  );
  const songByNumber = new Map(songs.map((s) => [s.number, s.title]));
  function songTitle(titulo: string): string {
    const m = /^Canción (\d+)$/.exec(titulo.trim());
    if (!m) return titulo;
    const title = songByNumber.get(Number(m[1]));
    return title ? `Canción ${m[1]} — ${title}` : titulo;
  }
  const warnsByPart = new Map<string, ProgramaWarning[]>();
  for (const w of ws) {
    const k = w.part_id ?? `${w.meeting_id}::${w.publisher_id}`;
    const list = warnsByPart.get(k) ?? [];
    list.push({ id: w.id, tipo: w.tipo, mensaje_es: w.mensaje_es });
    warnsByPart.set(k, list);
  }
  const partsByMeeting = new Map<string, ProgramaPart[]>();
  for (const p of ps) {
    const a = byPart.get(p.id);
    const list = partsByMeeting.get(p.meeting_id) ?? [];
    list.push({
      id: p.id,
      meeting_id: p.meeting_id,
      orden: p.orden,
      seccion: p.seccion,
      tipo_clave: p.tipo_clave,
      titulo: songTitle(p.titulo),
      sala: p.sala,
      requiere_ayudante: p.requiere_ayudante === 1,
      needs_review: p.needs_review === 1,
      duracion_min: p.duracion_min,
      hora_inicio: p.hora_inicio,
      titular_id: a?.titular_id ?? null,
      ayudante_id: a?.ayudante_id ?? null,
      warnings: warnsByPart.get(p.id) ?? [],
    });
    partsByMeeting.set(p.meeting_id, list);
  }
  return ms.map((m) => ({
    id: m.id,
    fecha: m.fecha,
    tipo: m.tipo,
    semana_label: m.semana_label,
    estado: m.estado,
    sala: m.sala,
    hora_inicio: m.hora_inicio,
    lectura_semanal: m.lectura_semanal,
    titulo_atalaya: m.titulo_atalaya,
    cancion_inicial: m.cancion_inicial,
    cancion_intermedia: m.cancion_intermedia,
    cancion_final: m.cancion_final,
    parts: partsByMeeting.get(m.id) ?? [],
    prayers: prayersByMeeting.get(m.id) ?? [],
  }));
}
