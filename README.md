# Meeting Base — Clone mobile de designações (ES, iOS + Android)

Clone do TheocBase focado só em **designações** (sem territórios).

- Mobile: Expo React Native + TypeScript, UI em espanhol, iOS + Android.
- API própria: Fastify + Zod + Drizzle + Neon Postgres.
- Híbrido: consulta offline (SQLite local), designar exige online.
- Import `.jwpub` para gerar programas (mwb, Atalaya, cánticos sjj, discursos S-34).
- Sala A fixa. Conflitos com alerta suave em espanhol.

## Estrutura

```
apps/mobile/   → app Expo (Router, TanStack Query, SQLite local, i18n es)
apps/api/      → API Fastify (imports, meetings, assign, sync)
packages/db/   → schema Drizzle + mapeamento mwb_* → parts
.opencode/agents/meeting-base.md → agente de continuidade
docs/FASE0.md  → plano da fase 0
```

## Fase 0 (atual)

Scaffold + contratos. Sem credenciais no repo. Não criar nem ler `.env`.

## Referências locais (leitura)

- `D:\TheocBase` — app original desktop
- `D:\TheocBase\jwpub` — exemplos: `mwb_S_202611.jwpub`, `w_S_202606.jwpub`, `sjj_S.jwpub`, `S-34_S (1).jwpub`
