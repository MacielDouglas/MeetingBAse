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
  publishMemMeeting,
  replaceMemWarnings,
  titularAssignedMem,
  upsertMemAssignment,
} from "./assignStore.js";
import {
  deleteNeonWarnings,
  findNeonPart,
  getNeonAssignment,
  getNeonPublisher,
  publishNeonMeeting,
  saveNeonAssignment,
  titularAssignedNeon,
} from "./repoAssign.js";
import { unavailablePublisherIds } from "./unavailabilityStore.js";
import { titularRepeatedLastWeek } from "./suggest.js";

// Fase 2B — orquestra assign/publish/sync.
// Neon primeiro (se há DATABASE_URL), memória depois.
// Designar exige online: validação sempre no servidor.

// ---------- helpers for doble_asignacion ----------

// ---------- assign ----------

interface Bundle {
  part: PartRef;
  meetingId: string;
  meetingFecha: string;
  titular: PublisherRef;
  ayudante: PublisherRef | null;
  yaAsignado: boolean;
  ayudanteYaAsignado: boolean;
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
    meetingFecha: hit.meetingFecha,
    titular: tit,
    ayudante: ayu,
    yaAsignado: await titularAssignedNeon(hit.part.meetingId, titularId, partId),
    ayudanteYaAsignado: ayudanteId
      ? await titularAssignedNeon(hit.part.meetingId, ayudanteId, partId)
      : false,
    fuente: "neon",
  };
}

async function bundleMem(
  congId: string,
  partId: string,
  titularId: string,
  ayudanteId: string | null
): Promise<Bundle | null> {
  const hit = findMemPart(congId, partId);
  if (!hit) return null;
  const tit = await getMemPublisher(titularId, congId);
  if (!tit) return null;
  let ayu: PublisherRef | null = null;
  if (ayudanteId) {
    ayu = await getMemPublisher(ayudanteId, congId) ?? null;
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
    meetingFecha: hit.meetingFecha,
    titular: tit,
    ayudante: ayu,
    yaAsignado: titularAssignedMem(hit.meetingId, titularId, partId),
    ayudanteYaAsignado: ayudanteId
      ? titularAssignedMem(hit.meetingId, ayudanteId, partId)
      : false,
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
  await deleteNeonWarnings(meetingId, prevTitular, partId);
}

export async function assignPart(
  congId: string,
  partId: string,
  titularId: string,
  ayudanteId: string | null
): Promise<FlowReply> {
  let b: Bundle | null = null;
  if (isDbConfigured()) b = await bundleNeon(congId, partId, titularId, ayudanteId);
  if (!b) b = await bundleMem(congId, partId, titularId, ayudanteId);
  if (!b) {
    // Mensagem mais específica: parte? titular? ajudante?
    const partOk =
      (isDbConfigured() && (await findNeonPart(congId, partId))) ||
      findMemPart(congId, partId);
    if (!partOk)
      return { status: 404, body: { error: "Parte no encontrada" } };
    const titOk =
      (isDbConfigured() && (await getNeonPublisher(titularId))) ||
      (await getMemPublisher(titularId, congId));
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
    ayudanteYaAsignadoEstaSemana: b.ayudanteYaAsignado,
    titularIndisponible: (await unavailablePublisherIds(congId, b.meetingFecha)).has(titularId),
    ayudanteIndisponible: ayudanteId
      ? (await unavailablePublisherIds(congId, b.meetingFecha)).has(ayudanteId)
      : false,
    titularRepitioSemanaPasada: await titularRepeatedLastWeek(congId, b.meetingId, b.part.tipoClave, titularId),
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
    deleteMemWarnings(b.meetingId, prevMem.titular_id, b.part.id);
  }
  const ws = replaceMemWarnings({
    meetingId: b.meetingId,
    congregationId: congId,
    publisherId: titularId,
    partId: b.part.id,
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

// Sync em ./syncFlow (limite de 400 linhas por arquivo).
