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
