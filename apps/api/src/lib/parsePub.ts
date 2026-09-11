import { loadPub } from "meeting-schedules-parser/dist/node/index.js";
import { detectPubKind, type PubKind } from "../../../../packages/db/mapping.js";
import { parseSjjFile, parseS34File } from "./jwpubCustomParser.js";

export interface ParsedPub {
  kind: PubKind;
  filename: string;
  rows: Record<string, string | number | undefined>[];
}

// Parse a .jwpub file saved on disk.
// MWB/W: use meeting-schedules-parser (has built-in support).
// sjj/S-34: use custom parser (reading SQLite inside the double-ZIP).
// Throws Error with Spanish message for the client.
export async function parsePubFile(tmpPath: string, filename: string): Promise<ParsedPub> {
  const kind = detectPubKind(filename);
  let rows: ParsedPub["rows"];

  if (kind === "sjj") {
    try {
      rows = await parseSjjFile(tmpPath);
    } catch (e) {
      throw new Error(
        `No se pudo leer el archivo de cantos (${filename}). ${e instanceof Error ? e.message : "Error desconocido."}`
      );
    }
  } else if (kind === "s34") {
    try {
      rows = await parseS34File(tmpPath);
    } catch (e) {
      throw new Error(
        `No se pudo leer el archivo de discursos (${filename}). ${e instanceof Error ? e.message : "Error desconocido."}`
      );
    }
  } else {
    try {
      rows = (await loadPub(tmpPath)) as ParsedPub["rows"];
    } catch (e) {
      throw new Error(
        `No se pudo leer el archivo .jwpub (${filename}). Verifique que sea un archivo válido.`
      );
    }
  }

  if (!Array.isArray(rows) || rows.length === 0) {
    throw new Error(`El archivo ${filename} no contiene datos para importar.`);
  }
  return { kind, filename, rows };
}
