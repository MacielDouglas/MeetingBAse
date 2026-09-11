# FASE 2A — Persistência Neon (confirm + GET meetings real)

Fase 2A completa com fallback gracioso: com `DATABASE_URL` persiste no Neon,
sem banco segue em memória sem quebrar nada. Assign transacional e publish
ficam para a **2B** (stubs com `pendiente_fase2b`).

## O que persistiu

- `POST /imports/:job/confirm` → além do draft in-memory, tenta gravar no
  Neon via `repoNeon.saveConfirm`: 1 row `imports` + N `meetings` (sala A,
  ordem 1..13 MWB / 1..4 W) + M `parts`. Resposta inclui
  `persistencia: "neon" | "memoria"` + header `x-persistencia`.
- `GET /c/:id/meetings` → real: tenta Neon primeiro (`listMeetings` por
  `congregation_id`, ordenado por `fecha`, com parts por `orden`); se falhar,
  lista os confirms in-memory (`listConfirmedMeetings`) com
  `persistencia: "memoria"`. Sem mais `pendiente_fase2` neste GET.
- `GET /c/:id/sync` → mantém stub, agora com campo `persistencia`
  (`"neon"` se há `DATABASE_URL`, senão `"memoria"`).
- `sjj` / `S-34` → mantém 422 em espanhol (sem parser novo).

## Arquivos

- `packages/db/db.ts` — cliente Drizzle + `@neondatabase/serverless`,
  `db` nullable + `isDbConfigured()`. Lê `DATABASE_URL` do env, sem logar.
- `packages/db/drizzle/0001_fase2a.sql` — DDL idempotente (`imports`,
  `meetings`, `parts` + índices/uniques, `sala` default `"A"`).
- `apps/api/src/lib/repoNeon.ts` — `saveConfirm(job, drafts)` (best-effort
  transacional: usa `db.transaction` se o driver suportar, senão inserts
  sequenciais) e `listMeetings(congregationId)` (filtro app-level
  obrigatório).
- `apps/api/src/lib/eligibility.ts` — catálogo de regras (puro, sem rota).
- `apps/api/src/lib/__check_eligibility.ts` — check manual
  (`npm run test:eligibility --workspace=@meeting-base/api`).
- Mobile: `lib/api.ts` ganhou `getMeetings`; `(tabs)/programa.tsx` lista
  fecha/tipo/Sala A/parts_count via TanStack Query, com fallback
  `Necesitas conexión para asignar` offline. Chaves novas em `i18n/es.json`.

## DDL / RLS strategy

- DDL espelha `packages/db/schema.ts`; aplicar com psql ou Neon SQL Editor.
- Fase 2A: **filtro app-level obrigatório**
  (`WHERE congregation_id = :id` em todo query do `repoNeon`).
- Policies RLS por `congregation_id` estão prontas como **comentários SQL**
  no fim do `0001_fase2a.sql` (chave `app.congregation_id`): descomentar
  quando o papel da API usar `SET app.congregation_id` por request.
- Futuro: 1 projeto Neon por congregação via API (fora do escopo 2A).

## Formato do flag `persistencia`

- Corpo: `{ ..., persistencia: "neon" | "memoria" }` (confirm, meetings, sync).
- Header: `x-persistencia: neon | memoria` (confirm e GET meetings).
- `"memoria"` = sem `DATABASE_URL` ou erro de conexão/query → segue
  in-memory, sem quebrar typecheck nem `test:imports`.

## Catálogo de elegibilidade (para a 2B usar)

`checkEligibility({ titular, ayudante?, ayudanteId?, part, titularYaAsignadoEstaSemana? })`
→ `{ warnings: [{ tipo, mensajeEs, duro }] }`. `duro=true` vira 422 na 2B;
`duro=false` vira row em `assignment_warnings` (alerta suave).

| Regra | `tipo` | `mensajeEs` | Duro / suave |
|---|---|---|---|
| Lectura estudiante (`mwb_tgw_bread`) e AYF 1..4 só homens | `solo_varon` | `Solo un varón puede tomar esta parte` | suave |
| EBC (`mwb_lc_cbs`, 30min) só anciano/siervo ministerial | `ebc_solo_nombrados` | `El EBC lo dirige un anciano o siervo ministerial` | suave |
| `requiereAyudante=true` exige ajudante presente | `requiere_ayudante` | `Esta parte requiere ayudante` | suave |
| Titular já tem outra parte na mesma semana | `doble_asignacion` | `Atención: ya tiene otra parte esta semana` | suave |
| Parte marcada `needsReview` (placeholder do parser) | `needs_review` | `Esta parte requiere revisión` | suave |
| Titular == ajudante | `titular_ayudante_iguales` | `El titular y el ayudante deben ser distintos` | **duro (422)** |
| Titular/ajudante de outra congregação | `otra_congregacion` | `Debe ser de la misma congregación` | **duro (422)** |

Tipos: `PublisherRef { id, sexo, cargo, congregationId }`,
`PartRef { id, meetingId, congregationId, tipoClave, requiereAyudante, needsReview? }`.

## Como rodar sem banco (fallback)

1. Não definir `DATABASE_URL` (nunca commitar `.env`; a API só lê o env).
2. `npm run typecheck --workspace=@meeting-base/api` → limpo.
3. `npm run test:imports --workspace=@meeting-base/api` → mwb 9 weeks/13
   parts, w 4 weeks/4 parts, sjj/S-34 422 em espanhol.
4. `npm run test:eligibility --workspace=@meeting-base/api` → `Elegibilidad OK`.
5. Subir a API e confirmar um import: resposta traz `persistencia: "memoria"`;
   `GET /c/:id/meetings` lista os drafts confirmados in-memory.

Com banco: definir `DATABASE_URL`, aplicar `0001_fase2a.sql` no Neon,
repetir os passos — respostas passam a trazer `persistencia: "neon"`.

## Validação 2A

- `typecheck` API limpo; `test:imports` ok (mesmos números da Fase 1);
  `test:eligibility` ok (8 cenários, 2 duros + 5 suaves + 1 limpo).
- Smoke HTTP (inject + servidor real): upload mwb → 201, confirm → 201 com
  `persistencia: "memoria"` (sem `DATABASE_URL`), GET meetings → 200 com
  9 meetings, primeira `2026-11-02`, 13 parts, sala A.
- Todos os arquivos de código com < 400 linhas; sala sempre A, sem seletor;
  iOS + Android (só `fetch`, sem nativo novo); temporários em `D:\temp`.

## Bugs latentes da Fase 1 corrigidos (sem mudar contrato)

- `@fastify/multipart@8` exigia Fastify 4 e quebrava o boot com Fastify 5
  (`FST_ERR_PLUGIN_VERSION_MISMATCH`); atualizado para `^9` (só API).
- `loadPub` valida o **basename** do caminho (`mwb_X_YYYYMM.jwpub`); o
  temporário `mb-<uuid>.jwpub` sempre falhava no parse. Agora o upload salva
  em `D:\temp\mb-<uuid>\<nome-original>` (pasta única + cleanup recursivo).

## Pendências 2B

- `POST /parts/:id/assign` transacional (usa `checkEligibility`: duros → 422,
  suaves → `assignment_warnings` em espanhol) + designar exige online.
- `POST /meetings/:id/publish` (draft → published) no Neon.
- `GET /sync?since=` real para SQLite offline + warnings no payload.
- Ativar RLS (descomentar policies) ou migrar para 1 projeto Neon por
  congregação via API.
- Mobile: congregação real (auth/sessão), SQLite leitura offline,
  `expo-print/sharing` + ical, EAS Build + `expo-updates` OTA.
- Parsers `sjj` (songs_cache) e `S-34` (talks_catalog) — hoje 422 proposital.
