import { describe, it, expect } from "vitest";
import { buildSyncPayload } from "./syncFlow.js";
import type { ListedMeeting } from "./repoNeon.js";
import type { AssignRow, WarningRow } from "./repoAssign.js";
import type { Prayer } from "./prayersStore.js";
import type { Unavailability } from "./unavailabilityStore.js";

const CONG = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const M1 = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const M2 = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";

function meeting(id: string, updatedAt: string): ListedMeeting {
  return {
    id,
    congregation_id: CONG,
    import_id: null,
    fecha: "2026-09-14",
    tipo: "entre_semana",
    semana_label: null,
    estado: "draft",
    sala: "A",
    updated_at: updatedAt,
    hora_inicio: "19:00",
    lectura_semanal: null,
    titulo_atalaya: null,
    cancion_inicial: null,
    cancion_intermedia: null,
    cancion_final: null,
    parts_count: 1,
    parts: [
      {
        id: `part-${id}`,
        orden: 1,
        seccion: "TESOROS",
        tipo_clave: "mwb_tgw_talk",
        titulo: "Discurso",
        sala: "A",
        requiere_ayudante: false,
        needs_review: false,
        duracion_min: 10,
        hora_inicio: "19:00",
      },
    ],
  };
}

function assignment(meetingId: string, updatedAt: string): AssignRow {
  return {
    id: `a-${meetingId}`,
    part_id: `part-${meetingId}`,
    meeting_id: meetingId,
    congregation_id: CONG,
    titular_id: "dddddddd-dddd-4ddd-8ddd-dddddddddddd",
    ayudante_id: null,
    updated_at: updatedAt,
  };
}

function warning(meetingId: string, partId: string | null): WarningRow {
  return {
    id: `w-${meetingId}`,
    meeting_id: meetingId,
    publisher_id: "dddddddd-dddd-4ddd-8ddd-dddddddddddd",
    part_id: partId,
    tipo: "needs_review",
    mensaje_es: "Requiere revisión",
    created_at: "2026-09-14T10:00:00.000Z",
  };
}

const OLD = "2026-01-01T00:00:00.000Z";

describe("buildSyncPayload", () => {
  it("monta payload completo sem filtro (since null)", () => {
    const prayers: Prayer[] = [
      { id: "pr1", meeting_id: M1, congregation_id: CONG, tipo: "inicial", publisher_id: null },
      { id: "prX", meeting_id: "other", congregation_id: CONG, tipo: "final", publisher_id: null },
    ];
    const unav: Unavailability[] = [
      { id: "u1", congregation_id: CONG, publisher_id: "p1", fecha_inicio: "2026-09-01", fecha_fin: "2026-09-02", motivo: null },
    ];
    const p = buildSyncPayload(
      [meeting(M1, OLD), meeting(M2, OLD)],
      [assignment(M1, OLD)],
      [warning(M1, null)],
      null,
      "memoria",
      prayers,
      unav
    );
    expect(p.filtrado).toBe(false);
    expect(p.persistencia).toBe("memoria");
    expect(p.meetings).toHaveLength(2);
    expect(p.parts).toHaveLength(2);
    expect(p.assignments).toHaveLength(1);
    expect(p.warnings).toHaveLength(1);
    expect(p.warnings[0].part_id).toBeNull();
    // Oração de outra reunião é filtrada; indisponibilidade passa direto.
    expect(p.prayers).toHaveLength(1);
    expect(p.unavailability).toHaveLength(1);
    // Reconciliação anti-fantasma: todos os IDs atuais, sem filtro.
    expect(p.all_meeting_ids).toEqual([M1, M2]);
  });

  it("since futuro filtra tudo mas mantém all_meeting_ids", () => {
    const p = buildSyncPayload(
      [meeting(M1, OLD)],
      [assignment(M1, OLD)],
      [warning(M1, `part-${M1}`)],
      "2099-01-01T00:00:00.000Z",
      "neon"
    );
    expect(p.filtrado).toBe(true);
    expect(p.meetings).toHaveLength(0);
    expect(p.assignments).toHaveLength(0);
    expect(p.warnings).toHaveLength(0);
    expect(p.all_meeting_ids).toEqual([M1]);
  });

  it("since inválido não filtra (nunca 500)", () => {
    const p = buildSyncPayload([meeting(M1, OLD)], [], [], "lixo", "memoria");
    expect(p.filtrado).toBe(false);
    expect(p.meetings).toHaveLength(1);
  });
});
