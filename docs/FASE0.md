# FASE 0 — Fundação

Objetivo: deixar o monorepo pronto para implementar imports e designações.

## Entregas desta fase

- [x] Pasta `D:\Projetos\Meeting Base` + `AGENTS.md` + agente `meeting-base`
- [ ] `packages/db/schema.ts` — tabelas + constraints (Sala A, warnings suaves)
- [ ] `packages/db/mapping.ts` — mapeamento `mwb_*` → parts ordem 1..13
- [ ] `apps/api` — Fastify + rotas stub `/imports`, `/meetings`, `/assign`, `/sync`
- [ ] `apps/mobile` — Expo Router tabs ES + i18n + SQLite local vazio
- [ ] Validar `loadPub` com os 4 `.jwpub` de referência (backend, sem commitar os arquivos)

## Decisões fechadas

1. Sem territórios. Só designações.
2. Um banco por congregação: começa com `congregation_id` + RLS, evolui para projeto Neon por congregação.
3. Offline leitura, online para designar.
4. Do zero, sem importar SQLite do TheocBase.
5. API própria + Neon. Sala A fixa. Alerta suave.

## Próximo (Fase 1)

Pipeline `.jwpub`: upload → `loadPub` → preview → confirm → meetings draft + parts.
