// Teste HTTP end-to-end via inject (modo memória, sem DATABASE_URL).
delete process.env.DATABASE_URL;

import { describe, it, expect, beforeAll } from "vitest";
import type { FastifyInstance } from "fastify";
import { buildApp } from "./app.js";
import { signToken } from "./lib/auth.js";
import { saveConfirmedMeetings } from "./lib/importStore.js";
import { upsertMemPublisher } from "./lib/assignStore.js";

const CONG = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const MID = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const P_TALK = "cccccccc-cccc-4ccc-8ccc-cccccccc0001";
const T_MAN = "dddddddd-dddd-4ddd-8ddd-dddddddddddd";

let app: FastifyInstance;
let authHeader: Record<string, string>;

beforeAll(async () => {
  upsertMemPublisher({ id: T_MAN, sexo: "hombre", ebc: true, congregationId: CONG });
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
        { id: P_TALK, orden: 2, seccion: "TESOROS", tipoClave: "mwb_tgw_talk", titulo: "Discurso", requiereAyudante: false, sala: "A" },
      ],
    },
  ]);
  app = await buildApp();
  const token = signToken({ id: T_MAN, congregationId: CONG, email: "t@t.t", nombre: "T", rol: "admin" });
  authHeader = { authorization: `Bearer ${token}` };
});

describe("rotas HTTP", () => {
  it("GET /salud responde ok", async () => {
    const r = await app.inject({ method: "GET", url: "/salud" });
    expect(r.statusCode).toBe(200);
    expect(r.json().ok).toBe(true);
  });

  it("POST assign + GET sync espelham a designação", async () => {
    const a = await app.inject({
      method: "POST",
      url: `/c/${CONG}/parts/${P_TALK}/assign`,
      headers: authHeader,
      payload: { titular_id: T_MAN },
    });
    expect(a.statusCode).toBe(200);
    expect(a.json().persistencia).toBe("memoria");

    const s = await app.inject({ method: "GET", url: `/c/${CONG}/sync`, headers: authHeader });
    const b = s.json();
    expect(s.statusCode).toBe(200);
    expect(b.meetings).toHaveLength(1);
    expect(b.assignments).toHaveLength(1);
    expect(b.all_meeting_ids).toEqual([MID]);
  });

  it("POST publish muda estado; republicar dá 409", async () => {
    const p1 = await app.inject({ method: "POST", url: `/c/${CONG}/meetings/${MID}/publish`, headers: authHeader });
    expect(p1.statusCode).toBe(200);
    expect(p1.json().estado).toBe("published");
    const p2 = await app.inject({ method: "POST", url: `/c/${CONG}/meetings/${MID}/publish`, headers: authHeader });
    expect(p2.statusCode).toBe(409);
  });

  it("GET /c/:id/meetings lista reuniões", async () => {
    const r = await app.inject({ method: "GET", url: `/c/${CONG}/meetings`, headers: authHeader });
    expect(r.statusCode).toBe(200);
    expect(r.json().meetings).toHaveLength(1);
  });

  it("sem token dá 401; congregation inválida dá 400 (nunca 500)", async () => {
    const noAuth = await app.inject({ method: "GET", url: `/c/${CONG}/sync` });
    expect(noAuth.statusCode).toBe(401);
    const r = await app.inject({ method: "GET", url: "/c/no-uuid/sync", headers: authHeader });
    expect(r.statusCode).toBe(400);
  });
});
