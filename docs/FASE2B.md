# FASE 2B — Designações + publish + sync real

Fase 2B completa com fallback gracioso: com `DATABASE_URL` persiste no
Neon, sem banco segue em memória sem quebrar nada. RLS **não** ativado
(só documentado). Nenhum commit/push feito.

## Endpoints finais

- `POST /c/:id/parts/:partId/assign` body `{ titular_id, ayudante_id? }`
  - 200 → `{ assignment, warnings: [{ tipo, mensaje_es }], persistencia }`
  - 400 → `{ error: "Datos inválidos" }` (UUIDs de `:id`/`:partId`/body)
  - 404 → `{ error: "Parte no encontrada" | "Titular no encontrado" | "Ayudante no encontrado" }`
    (parte/reunião fora da congregação `:id` também dá 404 de parte)
  - 422 → `{ error: mensajeEs }` (primeiro duro; ver matriz)
  - Upsert por `part_id` (unique): re-designar substitui titular/ajudante
    e **troca** os warnings desse publicador na reunião.
  - Designar exige online: validação transacional no servidor. O mobile
    mostra `Necesitas conexión para asignar` em erro de rede (sem mudar).
- `POST /c/:id/meetings/:mid/publish`
  - 200 → `{ meeting_id, estado: "published", persistencia }`
  - 400 → `Datos inválidos` (UUIDs)
  - 404 → `Reunión no encontrada` (inexistente ou de outra congregação)
  - **409** → `La reunión ya está publicada` (escolha documentada:
    publicar é idempotente no sentido de leitura, mas repetir indica
    erro de fluxo; 409 sinaliza em espanhol em vez de 200 silencioso)
- `GET /c/:id/meetings` — contrato 2A preservado (só garante `estado`
  correto após publish). Parts agora com **UUID real** (antes
  `${meetingId}#${orden}` no modo memória) — formato continua string.
- `GET /c/:id/sync?since=` → `{ since, meetings, parts, assignments,
  warnings, filtrado, persistencia }`
  - `meetings`: sem `updatedAt` → sempre completos
  - `parts`: lista plana com `meeting_id`, sempre completa
  - `assignments`/`warnings`: filtrados por data quando `since` válido
  - `filtrado: false` sempre na 2B (nem tudo pôde ser filtrado; ver abaixo)
  - `since` inválido → ignora filtro, nunca 500

## Formato de warnings

Linha em `assignment_warnings` (Neon) por aviso suave:
`{ id, meeting_id, publisher_id, tipo, mensaje_es, created_at }`.
Resposta do assign devolve `warnings: [{ tipo, mensaje_es }]`.

Limitação: a tabela não tem `part_id` (só meeting+publisher), então
re-designar **substitui** os avisos anteriores desse publicador na
reunião (delete + insert). Ao **trocar** de titular, os avisos do titular
antigo são apagados se ele não tiver outra parte na reunião
(verificação de `doble_asignacion` invertida); se ele tem outra parte,
os avisos são mantidos (não dá para separar por parte sem `part_id` —
pendência Fase 3: coluna `part_id` em `assignment_warnings`).

## Matriz duro / suave

| Regra | `tipo` | Duro (422) / suave |
|---|---|---|
| Titular == ajudante | `titular_ayudante_iguales` | **duro** |
| Titular/ajudante de outra congregação | `otra_congregacion` | **duro** |
| Leitura (`mwb_tgw_bread`) e AYF 1..4 só homens | `solo_varon` | suave |
| EBC (`mwb_lc_cbs`) só anciano/siervo | `ebc_solo_nombrados` | suave |
| `requiereAyudante` sem ajudante | `requiere_ayudante` | suave |
| Titular já designado noutra parte da semana | `doble_asignacion` | suave |
| Parte com `needsReview` | `needs_review` | suave |

`doble_asignacion` = titular já tem assignment noutra parte da **mesma
reunião** (escopo semana = reunião; excluir a própria parte no upsert).
Só verifica o titular (ajudante pode repetir — decisão futura).

## Fallback memória

- Sem `DATABASE_URL` (ou falha Neon): publishers/assignments/warnings
  em `assignStore.ts`, meetings/parts em `importStore.ts` — mesmo formato
  snake_case + `persistencia: "memoria"`.
- Publishers em memória precisam de seed (`upsertMemPublisher`; o teste
  `test:assign` faz isso). Em produção com Neon, lê `publishers`.
- Ordem de resolução do assign: Neon (parte+titular+ajudante) → memória
  → 404 específico. Erro de escrita no Neon após leitura cai para memória
  (best-effort, como na 2A).

## Como ativar RLS (Fase 3, NÃO fazer agora)

1. Aplicar `0001_fase2a.sql` + `0002_fase2b.sql` no Neon (SQL Editor/psql).
2. Descomentar os blocos `RLS pronto para ativar` nos dois arquivos
   (`ENABLE ROW LEVEL SECURITY` + `CREATE POLICY ...`).
3. Na API, após abrir cada conexão/request, executar
   `SET app.congregation_id = '<uuid-da-congregação>'` (o papel da API
   precisa de permissão; policies comparam com `current_setting`).
4. Manter o filtro app-level (`WHERE congregation_id = :id`) como
   defesa em profundidade — nunca remover.
5. Futuro: 1 projeto Neon por congregação via API (fora do escopo).

## Arquivos (todos < 400 linhas)

- `apps/api/src/lib/assignStore.ts` (novo) — memória
- `apps/api/src/lib/repoAssign.ts` (novo) — Neon assign/publish/sync
- `apps/api/src/lib/assignFlow.ts` (novo) — orquestração + `buildSyncPayload`
- `apps/api/src/lib/__check_assign.ts` (novo) + script `test:assign`
- `apps/api/src/app.ts` (novo, `buildApp` p/ inject) + `src/index.ts` (só listen)
- `routes/meetings.ts`, `routes/sync.ts` (reais), `routes/imports.ts`
  (parts com UUID), `lib/importStore.ts` (tipo com `id`)
- `packages/db/drizzle/0002_fase2b.sql` (novo)

## Pendências Fase 3

- Mobile: tela de designar (online-only), auth/congregação real,
  SQLite leitura offline consumindo `/sync`, `expo-print/sharing` + ical,
  EAS Build + `expo-updates` OTA.
- API: ativar RLS (acima) ou 1 projeto Neon por congregação via API;
  `updatedAt` em meetings p/ sync incremental de verdade (`filtrado: true`);
  limpeza de warnings por parte; checar ajudante em `doble_asignacion`;
  endpoint de publishers (hoje só seed/teste ou insert direto).
- Parsers `sjj` (songs_cache) e `S-34` (talks_catalog) — ainda 422 proposital.
