import { isDbConfigured } from "../../../../packages/db/db.js";
import {
  checkEligibility,
  type PartRef,
  type PublisherRef,
} from "./eligibility.js";
import {
  deleteMemWarnings,
  findMemPart,
  getMemAssignment,
  getMemPublisher,
  listMemAssignments,
  listMemDetailed,
  listMemWarnings,
  publishMemMeeting,
  replaceMemWarnings,
  titularAssignedMem,
  upsertMemAssignment,
} from "./assignStore.js";
import {
  deleteNeonWarnings,
  fetchNeonSyncData,
  findNeonPart,
  getNeonAssignment,
  getNeonPublisher,
  publishNeonMeeting,
  saveNeonAssignment,
  titularAssignedNeon,
  type AssignRow,
  type SyncData,
  type WarningRow,
} from "./repoAssign.js";
import type { ListedMeeting } from "./repoNeon.js";

// Fase 2B — orquestra assign/publish/sync.
// Neon primeiro (se há DATABASE_URL), memória depois.
// Designar exige online: validação sempre no servidor.

// ---------- assign ----------

interface Bundle {
  part: PartRef;
  meetingId: string;
  titular: PublisherRef;
  ayudante: PublisherRef | null;
  yaAsignado: boolean;
  fuente: "neon" | "memoria";
}

async function bundleNeon(
  congId: string,
  partId: string,
  titularId: string,
  ayudanteId: string | null
): Promise<Bundle | null> {
  const hit = await findNeonPart(congId, partId);
  if (!hit) return null;
  const tit = await getNeonPublisher(titularId);
  if (!tit) return null;
  let ayu: PublisherRef | null = null;
  if (ayudanteId) {
    ayu = await getNeonPublisher(ayudanteId);
    if (!ayu) return null;
  }
  return {
    part: {
      id: hit.part.id,
      meetingId: hit.part.meetingId,
      congregationId: hit.part.congregationId,
      tipoClave: hit.part.tipoClave,
      requiereAyudante: hit.part.requiereAyudante,
      needsReview: hit.part.needsReview,
    },
    meetingId: hit.part.meetingId,
    titular: tit,
    ayudante: ayu,
    yaAsignado: await titularAssignedNeon(hit.part.meetingId, titularId, partId),
    fuente: "neon",
  };
}

function bundleMem(
  congId: string,
  partId: string,
  titularId: string,
  ayudanteId: string | null
): Bundle | null {
  const hit = findMemPart(congId, partId);
  if (!hit) return null;
  const tit = getMemPublisher(titularId);
  if (!tit) return null;
  let ayu: PublisherRef | null = null;
  if (ayudanteId) {
    ayu = getMemPublisher(ayudanteId) ?? null;
    if (!ayu) return null;
  }
  return {
    part: {
      id: hit.part.id,
      meetingId: hit.meetingId,
      congregationId: hit.congregationId,
      tipoClave: hit.part.tipoClave,
      requiereAyudante: hit.part.requiereAyudante,
      needsReview: hit.part.needsReview,
    },
    meetingId: hit.meetingId,
    titular: tit,
    ayudante: ayu,
    yaAsignado: titularAssignedMem(hit.meetingId, titularId, partId),
    fuente: "memoria",
  };
}

export interface FlowReply {
  status: number;
  body: unknown;
}

// Ao trocar de titular, limpa os avisos do anterior se ele não tem
// outra parte na reunião (evita warnings órfãos; ver docs/FASE2B.md).
async function dropPrevTitularNeon(
  meetingId: string,
  partId: string,
  prevTitular: string | null,
  titularId: string
): Promise<void> {
  if (!prevTitular || prevTitular === titularId) return;
  if (await titularAssignedNeon(meetingId, prevTitular, partId)) return;
  await deleteNeonWarnings(meetingId, prevTitular);
}

export async function assignPart(
  congId: string,
  partId: string,
  titularId: string,
  ayudanteId: string | null
): Promise<FlowReply> {
  let b: Bundle | null = null;
  if (isDbConfigured()) b = await bundleNeon(congId, partId, titularId, ayudanteId);
  if (!b) b = bundleMem(congId, partId, titularId, ayudanteId);
  if (!b) {
    // Mensagem mais específica: parte? titular? ajudante?
    const partOk =
      (isDbConfigured() && (await findNeonPart(congId, partId))) ||
      findMemPart(congId, partId);
    if (!partOk)
      return { status: 404, body: { error: "Parte no encontrada" } };
    const titOk =
      (isDbConfigured() && (await getNeonPublisher(titularId))) ||
      getMemPublisher(titularId);
    if (!titOk)
      return { status: 404, body: { error: "Titular no encontrado" } };
    return { status: 404, body: { error: "Ayudante no encontrado" } };
  }

  const { warnings } = checkEligibility({
    titular: b.titular,
    ayudante: b.ayudante,
    ayudanteId,
    part: b.part,
    titularYaAsignadoEstaSemana: b.yaAsignado,
  });
  const duro = warnings.find((w) => w.duro);
  if (duro) return { status: 422, body: { error: duro.mensajeEs } };
  const suaves = warnings.filter((w) => !w.duro);

  if (b.fuente === "neon") {
    const prev = await getNeonAssignment(b.part.id);
    const saved = await saveNeonAssignment({
      partId: b.part.id,
      meetingId: b.meetingId,
      congregationId: congId,
      titularId,
      ayudanteId,
      items: suaves.map((w) => ({ tipo: w.tipo, mensajeEs: w.mensajeEs })),
    });
    if (saved) {
      await dropPrevTitularNeon(b.meetingId, b.part.id, prev?.titular_id ?? null, titularId);
      return {
        status: 200,
        body: {
          assignment: saved.assignment,
          warnings: saved.warnings.map((w) => ({
            tipo: w.tipo,
            mensaje_es: w.mensaje_es,
          })),
          persistencia: "neon",
        },
      };
    }
    // cai para memória abaixo (best-effort, como na 2A)
  }
  const prevMem = getMemAssignment(b.part.id);
  const a = upsertMemAssignment({
    partId: b.part.id,
    meetingId: b.meetingId,
    congregationId: congId,
    titularId,
    ayudanteId,
  });
  if (
    prevMem &&
    prevMem.titular_id !== titularId &&
    !titularAssignedMem(b.meetingId, prevMem.titular_id, b.part.id)
  ) {
    deleteMemWarnings(b.meetingId, prevMem.titular_id);
  }
  const ws = replaceMemWarnings({
    meetingId: b.meetingId,
    congregationId: congId,
    publisherId: titularId,
    items: suaves.map((w) => ({ tipo: w.tipo, mensajeEs: w.mensajeEs })),
  });
  return {
    status: 200,
    body: {
      assignment: a,
      warnings: ws.map((w) => ({ tipo: w.tipo, mensaje_es: w.mensaje_es })),
      persistencia: "memoria",
    },
  };
}

// ---------- publish ----------

export async function publishMeetingFlow(
  congId: string,
  mid: string
): Promise<FlowReply> {
  if (isDbConfigured()) {
    const r = await publishNeonMeeting(congId, mid);
    if (r === "ok")
      return {
        status: 200,
        body: { meeting_id: mid, estado: "published", persistencia: "neon" },
      };
    if (r === "already")
      return { status: 409, body: { error: "La reunión ya está publicada" } };
    // "not_found" ou null (erro) → tenta memória
    if (r === "not_found") {
      const m = publishMemMeeting(congId, mid);
      if (m === "ok")
        return {
          status: 200,
          body: { meeting_id: mid, estado: "published", persistencia: "memoria" },
        };
      if (m === "already")
        return { status: 409, body: { error: "La reunión ya está publicada" } };
      return { status: 404, body: { error: "Reunión no encontrada" } };
    }
  }
  const m = publishMemMeeting(congId, mid);
  if (m === "ok")
    return {
      status: 200,
      body: { meeting_id: mid, estado: "published", persistencia: "memoria" },
    };
  if (m === "already")
    return { status: 409, body: { error: "La reunión ya está publicada" } };
  return { status: 404, body: { error: "Reunión no encontrada" } };
}

// ---------- sync ----------

function sinceTime(raw: string | null): number | null {
  if (!raw) return null;
  const t = Date.parse(raw);
  return Number.isNaN(t) ? null : t;
}

export function buildSyncPayload(
  meetings: ListedMeeting[],
  assignments: AssignRow[],
  warnings: WarningRow[],
  sinceRaw: string | null,
  persistencia: "neon" | "memoria"
) {
  const t = sinceTime(sinceRaw);
  const keepA =
    t === null
      ? assignments
      : assignments.filter((a) => Number.isNaN(Date.parse(a.updated_at)) || Date.parse(a.updated_at) >= t);
  const keepW =
    t === null
      ? warnings
      : warnings.filter((w) => Number.isNaN(Date.parse(w.created_at)) || Date.parse(w.created_at) >= t);
  return {
    since: sinceRaw,
    meetings: meetings.map((m) => ({
      id: m.id,
      congregation_id: m.congregation_id,
      import_id: m.import_id,
      fecha: m.fecha,
      tipo: m.tipo,
      semana_label: m.semana_label,
      estado: m.estado,
      sala: m.sala,
    })),
    parts: meetings.flatMap((m) =>
      m.parts.map((p) => ({
        id: p.id,
        meeting_id: m.id,
        orden: p.orden,
        seccion: p.seccion,
        tipo_clave: p.tipo_clave,
        titulo: p.titulo,
        sala: p.sala,
        requiere_ayudante: p.requiere_ayudante,
        needs_review: p.needs_review,
      }))
    ),
    assignments: keepA,
    warnings: keepW,
    // 2B: meetings/parts sem coluna de data → sempre completos.
    // assignments/warnings filtrados quando `since` válido.
    filtrado: false,
    persistencia,
  };
}

function memSyncData(congId: string): SyncData {
  return {
    meetings: listMemDetailed(congId),
    assignments: listMemAssignments(congId),
    warnings: listMemWarnings(congId),
  };
}

export async function syncCongregation(congId: string, sinceRaw: string | null) {
  if (isDbConfigured()) {
    try {
      const d = await fetchNeonSyncData(congId);
      if (d) return buildSyncPayload(d.meetings, d.assignments, d.warnings, sinceRaw, "neon");
    } catch {
      // cai para memória
    }
  }
  const d = memSyncData(congId);
  return buildSyncPayload(d.meetings, d.assignments, d.warnings, sinceRaw, "memoria");
}
