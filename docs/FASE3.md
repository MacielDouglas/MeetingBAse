# FASE 3 — Mobile offline-first + tela Asignar

Fase 3 completa sem mexer na API (zero alterações no backend) e sem
dependências nativas novas (só `expo-sqlite` + TanStack Query, já
instalados). Nenhum commit/push feito.

## Arquitetura offline-first

- Leitura: `GET /c/:id/sync?since=` → SQLite local → tela. Tudo que é
  consulta (Programa) funciona offline após o primeiro sync.
- Escrita: designar e publicar **exigem online** (POST direto na API,
  validação transacional no Postgres). Offline mostra
  `Necesitas conexión para asignar` e bloqueia o envio.
- Sala sempre A, sem seletor. iOS + Android (Expo SDK 57, Expo Go).

## Tabelas SQLite (`lib/db.ts`)

- `meetings (id PK, congregation_id, import_id, fecha, tipo,
  semana_label, estado, sala)` — ordenado por `fecha`.
- `parts (id PK, meeting_id, orden, seccion, tipo_clave, titulo, sala,
  requiere_ayudante 0/1, needs_review 0/1)` — índice por `meeting_id`.
- `assignments (id PK, part_id UNIQUE, meeting_id, congregation_id,
  titular_id, ayudante_id?, updated_at)` — upsert por parte.
- `warnings (id PK, meeting_id, publisher_id, tipo, mensaje_es,
  created_at)` — por (reunião, publicador), igual ao servidor.
- `sync_meta (congregation_id PK, last_since, updated_at)` — guarda o
  último sync por congregação (`{ congregation_id, last_since }`).

Funções: `initDb()` (DDL idempotente), `saveSyncPayload(congregationId,
payload)` (retorna novo `last_since`), `loadPrograma(congregationId)`
(meetings + parts + titular atual + warnings por parte),
`getLastSince(congregationId)`.

## Fluxo sync (`hooks/usePrograma.ts`)

1. `initDb()` + lê `last_since` do `sync_meta`.
2. Online: `GET /sync?since=<last_since>` → `saveSyncPayload` →
   `loadPrograma`. Retorna `{ meetings, offline: false, lastSync }`.
3. Offline (erro de rede): `loadPrograma` direto do SQLite. Retorna
   `{ meetings, offline: true, lastSync }`.
4. Erro não-rede propaga (Tela mostra a mensagem do servidor).

Detalhe: `meetings`/`parts` do payload 2B vêm sempre completos
(`filtrado: false`), então são **substituídos** por congregação;
`assignments`/`warnings` fazem **upsert por id** (preparado para o
incremental real quando a API tiver `updatedAt` em meetings).

## Tela Asignar (`app/(tabs)/asignar.tsx`, nova aba "Asignar")

- Seleciona reunião → parte (dados locais via `usePrograma`).
- Informa `titular_id` (UUID, obrigatório) + `ayudante_id` (UUID,
  opcional) em campos de texto com validação de formato no cliente.
- `POST /c/:id/parts/:partId/assign` online; offline mostra
  `Necesitas conexión para asignar` e o botão fica desabilitado.
- Exibe warnings suaves (`⚠ mensaje_es`) e erros 422 em espanhol
  (ex.: `El titular y el ayudante deben ser distintos`).
- Após sucesso, invalida `["programa"]` (re-sync + releitura SQLite).

## Publicar (tela Programa)

- Botão `Publicar` por reunião em `draft` (desabilitado offline).
- 200 → invalida programa (estado vira `published` no próximo sync).
- 409 → mostra `La reunión ya está publicada`.
- Erro de rede → `Necesitas conexión para asignar`.

## Limitação publishers (temporária, documentada)

Não existe `GET /publishers` na API (verificado em
`apps/api/src` — só seed de teste via `assignStore`/`repoAssign`).
Por isso a tela Asignar usa **entrada manual de UUID** com validação
de formato (`isUuid`), até auth/congregação real trazerem catálogo de
publicadores. Decisão: mais simples funcional, sem inventar endpoint.

## Arquivos (todos < 400 linhas)

- `apps/mobile/lib/db.ts` (novo) — SQLite + tipos `ProgramaMeeting`.
- `apps/mobile/lib/api.ts` — `getSync`, `assignPart`,
  `publishMeeting`, `isUuid` + tipos `SyncPayload`.
- `apps/mobile/hooks/usePrograma.ts` (novo) — query offline-first.
- `apps/mobile/app/(tabs)/programa.tsx` — reescrito (expansível +
  publicar + sincronizar).
- `apps/mobile/app/(tabs)/asignar.tsx` (novo) — aba Asignar.
- `apps/mobile/app/(tabs)/_layout.tsx` — aba Asignar adicionada.
- `apps/mobile/i18n/es.json` — chaves novas (Sincronizar,
  Sincronizado, Sin conexión, Titular/Ayudante UUID, Publicar,
  Publicado, Borrador, etc.).

## Pendências (Fase 4+)

- Auth + `congregation_id` real (hoje fixo zerado) + catálogo de
  publicadores (substituir UUID manual por seletor).
- `expo-print/sharing` + ical, EAS Build + `expo-updates` OTA.
- API: RLS ou 1 projeto Neon por congregação; `updatedAt` em meetings
  p/ sync incremental (`filtrado: true`); `part_id` em
  `assignment_warnings`; checar ajudante em `doble_asignacion`.
- Parsers `sjj` (songs_cache) e `S-34` (talks_catalog) — 422 proposital.
