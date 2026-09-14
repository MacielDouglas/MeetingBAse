# Meeting Base — Clone mobile de designações (ES, iOS + Android)

Clone do TheocBase focado em **designações** (sem territórios).

- Mobile: Expo React Native + TypeScript, UI em espanhol, iOS + Android.
- API própria: Fastify + Zod + Drizzle + Neon Postgres.
- Híbrido: consulta offline (SQLite local), designar exige online.
- Import `.jwpub` para gerar programas (mwb, Atalaya, cánticos sjj, discursos S-34).
- Sala A fixa. Conflitos com alerta suave em espanhol.

## Estrutura

```
apps/mobile/   → app Expo (Router, TanStack Query, SQLite local, i18n es)
apps/api/      → API Fastify (imports, meetings, assign, sync, generate)
packages/db/   → schema Drizzle + mapeamento mwb_* → parts + migrations
maestro/       → teste smoke E2E (manual)
.opencode/agents/meeting-base.md → agente de continuidade
```

## Setup

```powershell
npm install --legacy-peer-deps
# API precisa de DATABASE_URL (Neon). Sem ela, roda em modo memória.
npm run dev --workspace=@meeting-base/api
# Mobile (outro terminal)
npx expo start --workspace=@meeting-base/mobile
```

Dispositivo físico iOS/Android: defina `EXPO_PUBLIC_API_URL=http://<IP-LAN-do-PC>:3001`
(a tela Importar mostra a URL em uso).

## Scripts

| Comando | Onde | O que faz |
|---|---|---|
| `npx tsc --noEmit -p apps/api/tsconfig.json` | raiz | typecheck API |
| `npx tsc --noEmit -p apps/mobile/tsconfig.json` | raiz | typecheck mobile |
| `npm test --workspace=@meeting-base/api` | raiz | testes vitest (63) |
| `maestro test maestro/smoke.yaml` | raiz | smoke E2E (manual, requer login via env) |

## Telas (tabs)

Inicio, Programa (offline + publicar), Asignar (titular/ayudante, orações, sugerir),
Importar (.jwpub + merge + persistência), Publicadores (CRUD), Ausencias (CRUD),
Falantes, Visitas, Exportar (templates + PDF + .ics), Perfil.

## Endpoints principais

```
POST /auth/login · POST /auth/register · GET /auth/me
POST /c/:id/imports · GET /imports/:job · POST /imports/:job/confirm
GET  /c/:id/meetings · POST /c/:id/meetings/:mid/publish
POST /c/:id/parts/:partId/assign · POST /c/:id/parts/:partId/suggest
GET  /c/:id/publishers/:pid/history
GET/POST /c/:id/meetings/:mid/prayers
GET/POST/DELETE /c/:id/unavailability
GET  /c/:id/sync · GET /c/:id/templates · POST /c/:id/generate · GET /c/:id/ical
GET/POST/PUT/DELETE /c/:id/speakers · /c/:id/visits · /c/:id/publishers
```

## Fases entregues

- Fases 0–9: base, designações, UX, Neon, infra, E2E.
- Fase 10: horários (reunião/partes) + orações inicial/final.
- Fase 11: indisponibilidade (tab Ausencias, regra suave, filtro nos pickers).
- Fase 12: cânticos com nome + catálogos no sync (sobrevivem ao restart).
- Fase 13: designação inteligente (histórico, anti-repetição, botão Sugerir).
- Fase 14: 11 templates + engine (`EMPTY`, `!REPEAT!`, horários por parte).
- Fase 15: icons/splash, skeleton, smoke Maestro, README.

## Regras do projeto

- Responder em pt-BR; UI em espanhol; código em espanhol/inglês simples.
- NUNCA acessar `C:\*` nem arquivos `.env`. Temporários em `D:\temp`.
- Máx. 400 linhas por arquivo de código. iOS + Android sempre.

## Referências locais (leitura)

- `D:\TheocBase` — app original desktop
- `D:\TheocBase\jwpub` — exemplos: `mwb_S_202611.jwpub`, `w_S_202606.jwpub`, `sjj_S.jwpub`, `S-34_S (1).jwpub`
