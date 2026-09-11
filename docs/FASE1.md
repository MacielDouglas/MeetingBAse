# FASE 1 — Pipeline .jwpub (upload → preview → confirm)

Fase 1 completa com persistência in-memory. Neon fica para a Fase 2.

## Endpoints

- `POST /c/:id/imports` (multipart, campo `file`, máx. 25 MB, só `.jwpub`)
  - 201 → `{ job_id, kind, filename, weeks: [{ index, fecha, tipo, semana, lectura, parts_count, needs_review }] }`
  - 400 → congregação inválida / sem arquivo / extensão inválida (`Solo se aceptan archivos .jwpub`)
  - 413 → `Archivo muy grande (máx. 25 MB)`
  - 422 → erro de parsing em espanhol (ex.: `Archivo no compatible: solo se aceptan mwb_S_*.jwpub y w_S_*.jwpub...`, `El archivo no contiene semanas para importar.`)
  - Temporários em `D:\temp\mb-*.jwpub` com cleanup em `finally`. Pasta criada com `mkdirSync(recursive)`.
- `GET /imports/:job` → `{ job_id, estado, kind, weeks }` (preview completo, parts com `sala: "A"`).
- `POST /imports/:job/confirm` body `{ weeks?: number[] }` (vazio = todas)
  - 201 → `{ job_id, estado: "confirmado", meetings }` (draft in-memory, `estado: "draft"`, `sala: "A"`).
  - 404 → já confirmada ou inexistente.
- Stubs Fase 2 mantidos: `GET /c/:id/meetings`, `POST /c/:id/parts/:partId/assign`, `POST /c/:id/meetings/:mid/publish`, `GET /c/:id/sync?since=`.

## Formatos

Preview (upload): semana, fecha, parts_count, needs_review + sala A fixa exibida no mobile, sem seletor.
Confirm: gera meetings draft in-memory com parts ordem 1..13 (MWB) ou 1..4 (W).

## Mapeamento

- MWB → 13 parts ordem 1..13, sala A (`packages/db/mapping.ts:mapMwbToParts`).
- W → 4 parts (canción inicial, discurso placeholder `needsReview`, estudio, canción final), sala A (`mapWatchtowerToParts`).
- `detectPubKind`: `mwb_*` → mwb, `w_*` → w, resto → unsupported (422 em espanhol).
- `importStore.buildWeeks`: monta `WeekPreview` com `sala: "A"` em todas as parts.

## Mobile (Expo Router, iOS + Android, ES)

- `app/_layout.tsx` (QueryClientProvider) + `app/(tabs)/_layout.tsx` (Inicio/Programa/Importar) + `app/(tabs)/importar.tsx`.
- `importar.tsx`: `expo-document-picker` → `POST /c/:id/imports` → `PreviewList` → `Confirmar` → `POST /imports/:job/confirm` → lista drafts. Textos via `i18n/es.json`. Sala A fixa exibida. Sem dependência nativa nova.
- `lib/api.ts`: `API_URL` via `EXPO_PUBLIC_API_URL` (default `http://localhost:3001`), `uploadJwpub`, `confirmImport`.
- `components/PreviewList.tsx`: lista semana/fecha/parts_count/needs_review.
- Offline: erro de rede mostra `Necesitas conexión para asignar`. Designar exige online (Fase 2).

## Resultado validação (`D:\temp\mb-fase1-check.json`)

Comando: `npm run test:imports --workspace=@meeting-base/api` (lê `D:\TheocBase\jwpub`, só leitura, sem copiar).

- `mwb_S_202611.jwpub`: ok=true, weeks=9, first_fecha=2026-11-02, first_parts=13, all_sala_a=true, mwb_13=true, orden_ok=true.
- `w_S_202606.jwpub`: ok=true, weeks=4, first_fecha=2026-08-10, first_parts=4, all_sala_a=true, orden_ok=true.
- `sjj_S.jwpub`: ok=false, 422 espanhol (`Archivo no compatible...`).
- `S-34_S (1).jwpub`: ok=false, 422 espanhol (mesma mensagem).
- `npm run typecheck --workspace=@meeting-base/api`: limpo.

## Pendências Fase 2

- Neon Postgres + Drizzle: persistir `imports`, `meetings`, `parts` (hoje in-memory). IDs seguem UUID.
- RLS por `congregation_id` (depois 1 projeto Neon por congregação via API).
- `POST /parts/:id/assign` transacional + `assignment_warnings` em espanhol (alerta suave; duro só titular != ajudante + mesma congregação).
- `POST /meetings/:id/publish` (draft → published) + `GET /meetings` real + `GET /sync?since=` para SQLite offline.
- Mobile: auth/congregação real, SQLite leitura offline, `expo-print/sharing` + ical, EAS Build + `expo-updates` OTA.
- `sjj` (songs_cache) e `S-34` (talks_catalog): parser próprio pendente — hoje 422 proposital.
