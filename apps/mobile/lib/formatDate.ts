// Utilitários de formatação de data e hora para todo o app.
// Formatos: data DD-MM-AAAA, hora 24hs.

/** Formata "YYYY-MM-DD" para "DD-MM-AAAA" */
export function fmtDate(fecha: string): string {
  if (!fecha) return "";
  const parts = fecha.split("-");
  if (parts.length !== 3) return fecha;
  return `${parts[2]}-${parts[1]}-${parts[0]}`;
}

/** Formata "HH:MM" para "HH:MM" (já é 24hs, retorna como está) */
export function fmtTime(hora: string | null): string {
  return hora ?? "";
}

/** Formata data + hora: "DD-MM-AAAA HH:MM" */
export function fmtDateTime(fecha: string, hora: string | null): string {
  const d = fmtDate(fecha);
  const h = fmtTime(hora);
  return h ? `${d} ${h}` : d;
}

/** Formata lastSync ISO string para "DD-MM-AAAA HH:MM" legível */
export function fmtLastSync(iso: string | null): string {
  if (!iso) return "";
  try {
    const d = new Date(iso);
    const dd = String(d.getDate()).padStart(2, "0");
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const yyyy = d.getFullYear();
    const hh = String(d.getHours()).padStart(2, "0");
    const mi = String(d.getMinutes()).padStart(2, "0");
    return `${dd}-${mm}-${yyyy} ${hh}:${mi}`;
  } catch {
    return iso;
  }
}

/** Formata "YYYY-MM-DD" para "DD de mes de AAAA" (espanhol, legível) */
export function fmtDateLong(fecha: string): string {
  if (!fecha) return "";
  const MESES = [
    "enero", "febrero", "marzo", "abril", "mayo", "junio",
    "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre",
  ];
  const parts = fecha.split("-");
  if (parts.length !== 3) return fecha;
  const dd = parseInt(parts[2], 10);
  const mm = parseInt(parts[1], 10) - 1;
  const yyyy = parts[0];
  return `${dd} de ${MESES[mm] ?? parts[1]} de ${yyyy}`;
}

// ── Cálculo de datas de reunião baseado na configuração ──

/**
 * Calcula a data de uma reunião baseado no início da semana e no dia configurado.
 * @param weekStart - Data do início da semana (segunda-feira) "YYYY-MM-DD"
 * @param dayOfWeek - Dia da semana configurado (1=Dom, 2=Seg, ..., 7=Sab)
 * @returns Data da reunião "YYYY-MM-DD"
 */
export function calcMeetingDate(weekStart: string, dayOfWeek: number): string {
  const d = new Date(weekStart + "T00:00:00");
  // weekStart é segunda (dia 2). Calculamos offset até o dia desejado.
  // dayOfWeek: 1=Dom, 2=Seg, 3=Ter, 4=Qua, 5=Qui, 6=Sex, 7=Sab
  // Segunda = 2, então offset = dayOfWeek - 2
  let offset = dayOfWeek - 2;
  if (offset < 0) offset += 7; // Dom (1) → offset 6 (6 dias após segunda)
  d.setDate(d.getDate() + offset);
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  return `${d.getFullYear()}-${mm}-${dd}`;
}

/**
 * Retorna o início da semana (segunda-feira) para uma data dada.
 */
export function getWeekStart(fecha: string): string {
  const d = new Date(fecha + "T00:00:00");
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  const monday = new Date(d);
  monday.setDate(diff);
  const dd = String(monday.getDate()).padStart(2, "0");
  const mm = String(monday.getMonth() + 1).padStart(2, "0");
  return `${monday.getFullYear()}-${mm}-${dd}`;
}

/**
 * Retorna o fim da semana (domingo) para uma data dada.
 */
export function getWeekEnd(fecha: string): string {
  const weekStart = getWeekStart(fecha);
  const d = new Date(weekStart + "T00:00:00");
  d.setDate(d.getDate() + 6);
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  return `${d.getFullYear()}-${mm}-${dd}`;
}

/**
 * Calcula as datas de reunião para uma semana baseado na configuração.
 * @param weekStart - Início da semana "YYYY-MM-DD"
 * @param config - Configuração { midweekDay, weekendDay }
 * @returns { midweekDate, weekendDate }
 */
export function calcWeekMeetingDates(
  weekStart: string,
  config: { midweekDay: number; weekendDay: number }
): { midweekDate: string; weekendDate: string } {
  return {
    midweekDate: calcMeetingDate(weekStart, config.midweekDay),
    weekendDate: calcMeetingDate(weekStart, config.weekendDay),
  };
}

/**
 * Nome do dia da semana em espanhol.
 */
export function dayNameEs(dayOfWeek: number): string {
  const days = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"];
  return days[dayOfWeek - 1] ?? "";
}
