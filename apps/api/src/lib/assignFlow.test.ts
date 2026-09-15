// Testa assign/publish em modo memória (sem DATABASE_URL).
delete process.env.DATABASE_URL;

import { describe, it, expect, beforeAll } from "vitest";
import { assignPart, publishMeetingFlow } from "./assignFlow.js";
import { saveConfirmedMeetings } from "./importStore.js";
import { upsertMemPublisher } from "./assignStore.js";

const CONG = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const MID = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const P_PRESIDENT = "cccccccc-cccc-4ccc-8ccc-cccccccc0000";
const P_TALK = "cccccccc-cccc-4ccc-8ccc-cccccccc0001";
const P_BREAD = "cccccccc-cccc-4ccc-8ccc-cccccccc0002";
const T_MAN = "dddddddd-dddd-4ddd-8ddd-dddddddddddd";
const T_WOMAN = "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee";
const NOPE = "ffffffff-ffff-4fff-8fff-ffffffffffff";

interface AssignBody {
  assignment?: { titular_id?: string };
  warnings?: { tipo: string }[];
  persistencia?: string;
  error?: string;
}

beforeAll(() => {
  upsertMemPublisher({ id: T_MAN, sexo: "hombre", ebc: true, congregationId: CONG });
  upsertMemPublisher({ id: T_WOMAN, sexo: "mujer", ebc: false, congregationId: CONG });
  saveConfirmedMeetings([
    {
      id: MID,
      congregation_id: CONG,
      import_id: "99999999-9999-4999-8999-999999999999",
      fecha: "2026-09-14",
      tipo: "entre_semana",
      semana_label: "14 de septiembre",
      estado: "draft",
      sala: "A",
      parts: [
        { id: P_PRESIDENT, orden: 2, seccion: "PRESIDENTE", tipoClave: "wk_presidente", titulo: "Presidente", requiereAyudante: false, sala: "A" },
        { id: P_TALK, orden: 3, seccion: "TESOROS", tipoClave: "mwb_tgw_talk", titulo: "Discurso", requiereAyudante: false, sala: "A" },
        { id: P_BREAD, orden: 5, seccion: "TESOROS", tipoClave: "mwb_tgw_bread", titulo: "Lectura", requiereAyudante: false, needsReview: true, sala: "A" },
      ],
    },
  ]);
});

describe("assignPart (memória)", () => {
  it("designa parte limpa sem warnings", async () => {
    const r = await assignPart(CONG, P_TALK, T_MAN, null);
    const b = r.body as AssignBody;
    expect(r.status).toBe(200);
    expect(b.persistencia).toBe("memoria");
    expect(b.assignment?.titular_id).toBe(T_MAN);
    expect(b.warnings).toEqual([]);
  });

  it("gera warnings suaves (mulher na leitura sem ayudante)", async () => {
    const r = await assignPart(CONG, P_BREAD, T_WOMAN, null);
    const b = r.body as AssignBody;
    expect(r.status).toBe(200);
    const tipos = (b.warnings ?? []).map((w) => w.tipo);
    expect(tipos).toContain("solo_varon");
    expect(tipos).toContain("needs_review");
  });

  it("bloqueia titular == ajudante (422)", async () => {
    const r = await assignPart(CONG, P_TALK, T_MAN, T_MAN);
    expect(r.status).toBe(422);
  });

  it("retorna 404 para parte inexistente", async () => {
    const r = await assignPart(CONG, NOPE, T_MAN, null);
    expect(r.status).toBe(404);
  });
});

describe("publishMeetingFlow (memória)", () => {
  it("publica draft, rejeita republicar (409) e 404 desconhecida", async () => {
    const ok = await publishMeetingFlow(CONG, MID);
    expect(ok.status).toBe(200);
    expect((ok.body as { estado?: string }).estado).toBe("published");
    const again = await publishMeetingFlow(CONG, MID);
    expect(again.status).toBe(409);
    const missing = await publishMeetingFlow(CONG, NOPE);
    expect(missing.status).toBe(404);
  });
});
