// API cliente para configuração de reuniões (Fase 12).
// Horários, eventos especiais, exceções de agenda.

import { API_URL, authHeaders, toErrorMessage } from "./common";

export interface MeetingConfig {
  midweekDay: number;
  midweekTime: string;
  weekendDay: number;
  weekendTime: string;
}

export interface SpecialEvent {
  id: string;
  tipo: string;
  titulo: string;
  fechaInicio: string;
  fechaFin?: string | null;
  horaInicio?: string | null;
  notas?: string | null;
}

export interface ScheduleException {
  id: string;
  fecha: string;
  tipo: string;
  horaInicio?: string | null;
  notas?: string | null;
}

export interface ConfigPayload {
  config: MeetingConfig;
  events: SpecialEvent[];
  exceptions: ScheduleException[];
}

export async function getConfig(congId: string): Promise<ConfigPayload> {
  const res = await fetch(`${API_URL}/c/${congId}/config`, {
    headers: authHeaders(),
  });
  if (!res.ok) throw new Error(toErrorMessage(await res.json(), "Error al cargar configuración"));
  return res.json();
}

export async function saveConfig(congId: string, config: MeetingConfig): Promise<MeetingConfig> {
  const res = await fetch(`${API_URL}/c/${congId}/config`, {
    method: "PUT",
    headers: { "Content-Type": "application/json", ...authHeaders() },
    body: JSON.stringify(config),
  });
  if (!res.ok) throw new Error(toErrorMessage(await res.json(), "Error al guardar configuración"));
  const data = await res.json();
  return data.config;
}

export async function createEvent(
  congId: string,
  event: Omit<SpecialEvent, "id">
): Promise<SpecialEvent> {
  const res = await fetch(`${API_URL}/c/${congId}/config/events`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...authHeaders() },
    body: JSON.stringify(event),
  });
  if (!res.ok) throw new Error(toErrorMessage(await res.json(), "Error al crear evento"));
  const data = await res.json();
  return data.event;
}

export async function deleteEvent(congId: string, eventId: string): Promise<void> {
  const res = await fetch(`${API_URL}/c/${congId}/config/events/${eventId}`, {
    method: "DELETE",
    headers: authHeaders(),
  });
  if (!res.ok) throw new Error(toErrorMessage(await res.json(), "Error al eliminar evento"));
}

export async function createException(
  congId: string,
  exception: Omit<ScheduleException, "id">
): Promise<ScheduleException> {
  const res = await fetch(`${API_URL}/c/${congId}/config/exceptions`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...authHeaders() },
    body: JSON.stringify(exception),
  });
  if (!res.ok) throw new Error(toErrorMessage(await res.json(), "Error al crear excepción"));
  const data = await res.json();
  return data.exception;
}

export async function deleteException(congId: string, exceptionId: string): Promise<void> {
  const res = await fetch(`${API_URL}/c/${congId}/config/exceptions/${exceptionId}`, {
    method: "DELETE",
    headers: authHeaders(),
  });
  if (!res.ok) throw new Error(toErrorMessage(await res.json(), "Error al eliminar excepción"));
}
