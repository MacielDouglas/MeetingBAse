import { describe, it, expect } from "vitest";
import { checkEligibility } from "./eligibility.js";
import { upsertPrayer, listPrayers } from "./prayersStore.js";
import {
  createUnavailability,
  listUnavailability,
  unavailablePublisherIds,
} from "./unavailabilityStore.js";
import { createPublisher } from "./publishersStore.js";
import { saveConfirmedMeetings } from "./importStore.js";
import { upsertMemAssignment } from "./assignStore.js";
import { publisherHistory, suggestCandidates, titularRepeatedLastWeek } from "./suggest.js";

const CONG = "11111111-1111-1111-1111-111111111111";

describe("fase 11: unavailability", () => {
  it("filtra por data e publicador", async () => {
    await createUnavailability({
      congregationId: CONG,
      publisherId: "pub-1",
      fechaInicio: "2026-09-14",
      fechaFin: "2026-09-20",
      motivo: "Viaje",
    });
    const all = await listUnavailability(CONG);
    expect(all.length).toBeGreaterThanOrEqual(1);
    expect(await unavailablePublisherIds(CONG, "2026-09-15")).toContain("pub-1");
    expect(await unavailablePublisherIds(CONG, "2026-09-25")).not.toContain("pub-1");
    const byPub = await listUnavailability(CONG, { publisherId: "pub-1", fecha: "2026-09-16" });
    expect(byPub.length).toBeGreaterThanOrEqual(1);
  });

  it("elegibilidade avisa indisponível (suave)", () => {
    const base = {
      titular: { id: "t1", sexo: "M", cargo: "publicador", congregationId: CONG },
      part: {
        id: "p1",
        meetingId: "m1",
        congregationId: CONG,
        tipoClave: "mwb_lc_cbs",
        requiereAyudante: false,
      },
    };
    const { warnings } = checkEligibility({ ...base, titularIndisponible: true });
    const w = warnings.find((x) => x.tipo === "titular_indisponible");
    expect(w).toBeDefined();
    expect(w?.duro).toBe(false);
  });
});

describe("fase 10: prayers", () => {
  it("upsert por (meeting, tipo)", async () => {
    await upsertPrayer(CONG, "meet-1", "inicial", "pub-1");
    await upsertPrayer(CONG, "meet-1", "inicial", "pub-2");
    const rows = await listPrayers(CONG, "meet-1");
    const inicial = rows.filter((r) => r.tipo === "inicial");
    expect(inicial).toHaveLength(1);
    expect(inicial[0].publisher_id).toBe("pub-2");
  });
});

describe("fase 13: suggest + history", () => {
  it("sugere disponíveis e conta historial", async () => {
    const pub = await createPublisher(CONG, { nombre: "Test Pub", sexo: "M" });
    saveConfirmedMeetings([
      {
        id: "meet-h1",
        congregation_id: CONG,
        import_id: "job-1",
        fecha: "2026-09-16",
        tipo: "entre_semana",
        estado: "draft",
        sala: "A",
        parts: [
          {
            id: "part-h1",
            orden: 4,
            seccion: "TESOROS",
            tipoClave: "mwb_tgw_bread",
            titulo: "Lectura",
            requiereAyudante: false,
            sala: "A",
          },
        ],
      },
    ]);
    const cands = await suggestCandidates(CONG, "part-h1");
    expect(cands.length).toBeGreaterThanOrEqual(1);
    expect(cands[0]).toHaveProperty("motivo");

    upsertMemAssignment({
      partId: "part-h1",
      meetingId: "meet-h1",
      congregationId: CONG,
      titularId: pub.id,
      ayudanteId: null,
    });
    const h = await publisherHistory(CONG, pub.id);
    expect(h.total).toBeGreaterThanOrEqual(1);
    expect(h.as_titular).toBeGreaterThanOrEqual(1);
    expect(await titularRepeatedLastWeek(CONG, "meet-h1", "mwb_tgw_bread", pub.id)).toBe(false);
  });
});
