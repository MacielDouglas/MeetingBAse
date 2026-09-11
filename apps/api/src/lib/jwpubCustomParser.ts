import JSZip from "jszip";
import initSqlJs from "sql.js";
import { readFile } from "fs/promises";

// Custom parser for sjj (songs) and S-34 (public talks) .jwpub files.
// These are double-ZIP archives: outer ZIP → contents (inner ZIP) → pubname_S.db (SQLite).
// The meeting-schedules-parser only handles MWB/W files; we handle the rest here.

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type SqlDatabase = any;

interface DocRow {
  DocumentId: number;
  ChapterNumber: number | null;
  Title: string | null;
  Class: number;
  ContextTitle: string | null;
}

async function openJwpubDb(tmpPath: string): Promise<SqlDatabase> {
  const raw = await readFile(tmpPath);
  const outerZip = await JSZip.loadAsync(raw);

  // Find the "contents" entry (inner ZIP)
  const contentsEntry = outerZip.file("contents");
  if (!contentsEntry) throw new Error("No se encontró 'contents' en el archivo .jwpub");

  const contentsBuf = await contentsEntry.async("nodebuffer");
  const innerZip = await JSZip.loadAsync(contentsBuf);

  // Find the SQLite database (*.db)
  const dbFiles = Object.keys(innerZip.files).filter(
    (name) => name.endsWith(".db") && !innerZip.files[name].dir
  );
  if (dbFiles.length === 0) throw new Error("No se encontró base de datos SQLite en el .jwpub");

  const dbBuf = await innerZip.files[dbFiles[0]].async("nodebuffer");
  const SQL = await initSqlJs();
  return new SQL.Database(dbBuf);
}

function queryDocs(db: SqlDatabase, classFilter: number): DocRow[] {
  const stmt = db.prepare(
    `SELECT DocumentId, ChapterNumber, Title, Class, ContextTitle
     FROM Document
     WHERE Class = ?
     ORDER BY ChapterNumber, DocumentId`
  );
  stmt.bind([classFilter]);

  const rows: DocRow[] = [];
  while (stmt.step()) {
    const r = stmt.getAsObject();
    rows.push({
      DocumentId: Number(r.DocumentId),
      ChapterNumber: r.ChapterNumber != null ? Number(r.ChapterNumber) : null,
      Title: r.Title != null ? String(r.Title) : null,
      Class: Number(r.Class),
      ContextTitle: r.ContextTitle != null ? String(r.ContextTitle) : null,
    });
  }
  stmt.free();
  return rows;
}

// Parse sjj (songs) .jwpub → array of { sjj_number, sjj_title, number, title }
export async function parseSjjFile(tmpPath: string): Promise<Record<string, string | number>[]> {
  const db = await openJwpubDb(tmpPath);
  const rows = queryDocs(db, 31); // Class 31 = Song
  db.close();
  if (rows.length === 0) {
    throw new Error("El archivo sjj no contiene canciones (Class=31).");
  }
  return rows.map((r) => ({
    sjj_number: r.ChapterNumber ?? 0,
    sjj_title: r.Title ?? "",
    number: r.ChapterNumber ?? 0,
    title: r.Title ?? "",
  }));
}

// Parse S-34 (public talks) .jwpub → array of { s34_title, s34_number, title, number }
export async function parseS34File(tmpPath: string): Promise<Record<string, string | number>[]> {
  const db = await openJwpubDb(tmpPath);
  const rows = queryDocs(db, 34); // Class 34 = Public Talk
  db.close();
  if (rows.length === 0) {
    throw new Error("El archivo S-34 no contiene discursos (Class=34).");
  }
  return rows.map((r) => ({
    s34_title: r.Title ?? "",
    s34_number: r.DocumentId,
    title: r.Title ?? "",
    number: r.DocumentId,
  }));
}
