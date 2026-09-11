import { loadPub } from "meeting-schedules-parser/dist/node/index.js";
import { detectPubKind, type PubKind } from "../../../../packages/db/mapping.js";

export interface ParsedPub {
  kind: PubKind;
  filename: string;
  rows: Record<string, string | number | undefined>[];
}

// Parse a .jwpub file saved on disk. Heavy parsing stays on the API.
// Mobile only uploads with expo-document-picker (no parsing on device).
// Throws Error with Spanish message for the client.
export async function parsePubFile(tmpPath: string, filename: string): Promise<ParsedPub> {
  const kind = detectPubKind(filename);
  let rows: ParsedPub["rows"];
  try {
    rows = (await loadPub(tmpPath)) as ParsedPub["rows"];
  } catch (e) {
    throw new Error(
      `No se pudo leer el archivo .jwpub (${filename}). Verifique que sea un archivo válido.`
    );
  }
  if (!Array.isArray(rows) || rows.length === 0) {
    throw new Error(`El archivo ${filename} no contiene datos para importar.`);
  }
  return { kind, filename, rows };
}
