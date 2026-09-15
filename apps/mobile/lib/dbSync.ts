// Guarda o snapshot /sync no SQLite local (offline-first).
// iOS + Android via expo-sqlite. Chamado por usePrograma após GET /sync.

import { getDb, str, num } from "./db";
import type { SyncPayload } from "./api";

// Guarda el snapshot /sync: meetings+parts se reemplazan (siempre
// completos en Fase 2B); assignments/warnings hacen upsert por id
// (incremental cuando `since` filtra). Devuelve el nuevo last_since.
export async function saveSyncPayload(
  congregationId: string,
  payload: SyncPayload
): Promise<string> {
  const now = new Date().toISOString();
  const d = getDb();
  d.withTransactionSync(() => {
    // Only DELETE all meetings if this is a full sync (not filtered/incremental).
    // Incremental syncs use UPSERT to avoid losing existing data.
    if (!payload.filtrado) {
      d.runSync("DELETE FROM parts WHERE meeting_id IN (SELECT id FROM meetings WHERE congregation_id = ?)", congregationId);
      d.runSync("DELETE FROM meetings WHERE congregation_id = ?", congregationId);
    }
    for (const m of payload.meetings ?? []) {
      d.runSync(
        "INSERT OR REPLACE INTO meetings (id, congregation_id, import_id, fecha, tipo, semana_label, estado, sala, hora_inicio, lectura_semanal, titulo_atalaya, cancion_inicial, cancion_intermedia, cancion_final, excepcion, visita_co) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
        str(m.id),
        str(m.congregation_id ?? congregationId, congregationId),
        str((m as { import_id?: unknown }).import_id ?? ""),
        str(m.fecha),
        str(m.tipo),
        (m.semana_label as string | null) ?? null,
        str(m.estado, "draft"),
        str((m as { sala?: unknown }).sala ?? "A", "A"),
        (m.hora_inicio as string | null) ?? null,
        (m.lectura_semanal as string | null) ?? null,
        (m.titulo_atalaya as string | null) ?? null,
        (m.cancion_inicial as number | null) ?? null,
        (m.cancion_intermedia as number | null) ?? null,
        (m.cancion_final as number | null) ?? null,
        (m.excepcion as string | null) ?? null,
        (m.visita_co as boolean | null) ?? false
      );
    }
    for (const p of payload.parts ?? []) {
      d.runSync(
        "INSERT OR REPLACE INTO parts (id, meeting_id, orden, seccion, tipo_clave, titulo, sala, requiere_ayudante, needs_review, duracion_min, hora_inicio, hora_fin) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
        str(p.id),
        str(p.meeting_id),
        num(p.orden),
        (p.seccion as string | null) ?? null,
        (p.tipo_clave as string | null) ?? null,
        str(p.titulo),
        str((p as { sala?: unknown }).sala ?? "A", "A"),
        p.requiere_ayudante ? 1 : 0,
        p.needs_review ? 1 : 0,
        (p.duracion_min as number | null) ?? null,
        (p.hora_inicio as string | null) ?? null,
        (p.hora_fin as string | null) ?? null
      );
    }
    for (const a of payload.assignments ?? []) {
      d.runSync(
        "INSERT OR REPLACE INTO assignments (id, part_id, meeting_id, congregation_id, titular_id, ayudante_id, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)",
        str(a.id),
        str(a.part_id),
        str(a.meeting_id),
        str(a.congregation_id ?? congregationId, congregationId),
        str(a.titular_id),
        (a.ayudante_id as string | null) ?? null,
        str(a.updated_at, now)
      );
    }
    for (const w of payload.warnings ?? []) {
      d.runSync(
        "INSERT OR REPLACE INTO warnings (id, meeting_id, publisher_id, part_id, tipo, mensaje_es, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)",
        str(w.id),
        str(w.meeting_id),
        str(w.publisher_id),
        (w as { part_id?: string | null }).part_id ?? null,
        str(w.tipo),
        str(w.mensaje_es),
        str(w.created_at, now)
      );
    }
    for (const pr of payload.prayers ?? []) {
      d.runSync(
        "INSERT OR REPLACE INTO prayers (id, meeting_id, congregation_id, tipo, publisher_id) VALUES (?, ?, ?, ?, ?)",
        str(pr.id),
        str(pr.meeting_id),
        str(pr.congregation_id ?? congregationId, congregationId),
        str(pr.tipo),
        (pr.publisher_id as string | null) ?? null
      );
    }
    if (!payload.filtrado) {
      d.runSync("DELETE FROM unavailability WHERE congregation_id = ?", congregationId);
    }
    for (const u of payload.unavailability ?? []) {
      d.runSync(
        "INSERT OR REPLACE INTO unavailability (id, congregation_id, publisher_id, fecha_inicio, fecha_fin, motivo) VALUES (?, ?, ?, ?, ?, ?)",
        str(u.id),
        str(u.congregation_id ?? congregationId, congregationId),
        str(u.publisher_id),
        str(u.fecha_inicio),
        str(u.fecha_fin),
        (u.motivo as string | null) ?? null
      );
    }
    // Catálogos sjj/S-34: sempre completos — substitui por congregação.
    d.runSync("DELETE FROM song_catalog WHERE congregation_id = ?", congregationId);
    for (const s of payload.songs ?? []) {
      if (typeof s.number === "number" && s.number > 0 && s.title) {
        d.runSync(
          "INSERT OR REPLACE INTO song_catalog (congregation_id, number, title) VALUES (?, ?, ?)",
          congregationId,
          s.number,
          str(s.title)
        );
      }
    }
    d.runSync("DELETE FROM talk_catalog WHERE congregation_id = ?", congregationId);
    for (const t of payload.talks ?? []) {
      if (t.title) {
        d.runSync(
          "INSERT OR REPLACE INTO talk_catalog (congregation_id, number, title) VALUES (?, ?, ?)",
          congregationId,
          typeof t.number === "number" ? t.number : 0,
          str(t.title)
        );
      }
    }
    d.runSync(
      "INSERT OR REPLACE INTO sync_meta (congregation_id, last_since, updated_at) VALUES (?, ?, ?)",
      congregationId,
      now,
      now
    );
    // Reconciliação: apaga do SQLite local as reuniões que não existem
    // mais no servidor (IDs fantasmas de confirmações antigas). Só quando
    // o payload veio do Neon (autoritativo); nunca no fallback de memória,
    // que pode estar incompleto (ex. API recém-reiniciada).
    const keepIds = payload.all_meeting_ids;
    if (payload.persistencia === "neon" && Array.isArray(keepIds)) {
      if (keepIds.length === 0) {
        d.runSync("DELETE FROM parts WHERE meeting_id IN (SELECT id FROM meetings WHERE congregation_id = ?)", congregationId);
        d.runSync("DELETE FROM assignments WHERE congregation_id = ?", congregationId);
        d.runSync("DELETE FROM warnings WHERE meeting_id IN (SELECT id FROM meetings WHERE congregation_id = ?)", congregationId);
        d.runSync("DELETE FROM prayers WHERE congregation_id = ?", congregationId);
        d.runSync("DELETE FROM meetings WHERE congregation_id = ?", congregationId);
      } else {
        const ph = keepIds.map(() => "?").join(",");
        d.runSync(
          `DELETE FROM parts WHERE meeting_id IN (SELECT id FROM meetings WHERE congregation_id = ? AND id NOT IN (${ph}))`,
          congregationId,
          ...keepIds
        );
        d.runSync(
          `DELETE FROM assignments WHERE congregation_id = ? AND meeting_id NOT IN (${ph})`,
          congregationId,
          ...keepIds
        );
        d.runSync(
          `DELETE FROM warnings WHERE meeting_id IN (SELECT id FROM meetings WHERE congregation_id = ? AND id NOT IN (${ph}))`,
          congregationId,
          ...keepIds
        );
        d.runSync(
          `DELETE FROM prayers WHERE congregation_id = ? AND meeting_id NOT IN (${ph})`,
          congregationId,
          ...keepIds
        );
        d.runSync(
          `DELETE FROM meetings WHERE congregation_id = ? AND id NOT IN (${ph})`,
          congregationId,
          ...keepIds
        );
      }
    }
  });
  return now;
}
