# NinDuelist — Arquitetura

Documentacao tecnica completa: stack, estrutura, decisoes arquiteturais, CI/CD, deploy, hardening e observabilidade.

---

## Stack

| Tecnologia | Uso |
|------------|-----|
| **Node.js 20** | Runtime |
| **TypeScript** | Linguagem (strict mode) |
| **Discord.js 14** | Integracao Discord |
| **Prisma** | ORM + migrations |
| **PostgreSQL** | Banco de dados (Supabase) |
| **Vitest** | Testes unitarios |
| **Docker** | Container (Alpine multi-stage) |
| **Fly.io** | Deploy em producao (regiao `gru` — Sao Paulo) |
| **GitHub Actions** | CI/CD (lint, typecheck, testes, deploy) |

---

## Estrutura de pastas

```
src/
├── commands/          # Slash commands (12 comandos)
│   └── index.ts       # Barrel — mapa command -> handler
├── buttons/           # Button handlers (aceitar, iniciar, cancelar, etc.)
│   ├── handler.ts     # HOF que elimina boilerplate dos handlers
│   └── index.ts       # Barrel — mapa action -> handler
├── modals/            # Modal handlers (submit-score)
│   └── index.ts       # Barrel — mapa action -> handler
├── services/          # Logica de negocio
│                        (duel, player, ranking, season, antifarm, pending,
│                         history, profile, h2h, activity, records, audit, search)
├── lib/               # Utilitarios
│                        (embeds, components, logger, prisma, pagination,
│                         notifications, cooldown, retry, job-health,
│                         ops-webhook, notification-metrics, health-server, validation)
├── events/            # Event handlers Discord (ready, interactionCreate)
├── jobs/              # Background jobs (expire-duels, season-check, reconcile-embeds)
├── config.ts          # Constantes e validacao de env vars
├── index.ts           # Bootstrap do client Discord + graceful shutdown
└── deploy-commands.ts # Script de registro de slash commands
```

---

## Camadas

- **Commands** — Recebem interacoes do Discord, delegam aos services. Nenhuma logica de negocio.
- **Buttons/Modals** — Barrel files exportam mapas `Record<string, handler>` para lookup direto no roteador.
- **Services** — Centralizam validacoes, pontuacao, regras anti-farm, gestao de seasons e confirmacao atomica.
- **Lib** — Utilitarios transversais: embeds builder, componentes Discord, logger estruturado, Prisma client, paginacao, notificacoes, cooldown, retry, health server, ops webhook, metricas, validacao.
- **Jobs** — Background jobs com `setTimeout` recursivo (expiracao em 1min, season check em 5min). Reconcile de embeds roda uma vez no startup.

---

## Decisoes arquiteturais

### Estado e concorrencia

- **Optimistic locking** — Todas as transicoes de estado usam `updateMany` com filtro de status. Se o status ja mudou (race condition), retorna null e mostra erro amigavel ao usuario.
- **Transacao atomica na confirmacao** — `confirmAndApplyResult` encapsula `confirmResult` + `applyResult` dentro de `prisma.$transaction()`, garantindo consistencia entre status do duelo e stats dos jogadores.
- **Transaction timeout** — Timeout explicito de 10s nas interactive transactions (`confirmAndApplyResult` e admin `fix-result`). Batch transactions (array) nao suportam timeout no Prisma.

### Discord

- **Embed unico editado in-place** — Cada duelo tem um embed persistente que e atualizado via `channelId` + `messageId`. Botoes mudam dinamicamente conforme o estado.
- **Auto-discovery de handlers** — Barrel files (`index.ts`) exportam mapas `Record<string, handler>`. O roteador em `interactionCreate.ts` faz lookup direto sem `switch/case`.
- **Graceful shutdown** — `SIGTERM`/`SIGINT` desconectam o client Discord e o Prisma antes de encerrar o processo.

### Jobs

- **setTimeout recursivo** — Evita execucao concorrente (ao contrario de `setInterval`). Cada ciclo agenda o proximo so apos terminar.
- **Retry com backoff exponencial** — `withRetry` generico (1s -> 2s -> 4s) aplicado nos jobs. Falha final e logada e o proximo ciclo tenta novamente.
- **Job health check** — Registro in-memory do ultimo ciclo bem-sucedido por job. Log de warning se gap entre ciclos excede 2x o intervalo esperado.
- **Reconcile de embeds no startup** — `reconcileStaleEmbeds()` limpa botoes de duelos terminais das ultimas 24h ao iniciar, evitando embeds desatualizados.

### Notificacoes

- **Fire-and-forget** — DM com fallback para mencao no canal em todos os eventos do ciclo de vida. Nunca bloqueiam o fluxo principal.
- **Cooldown in-memory** — Map generico key-based para rate limiting. Usado no `/duel` (30s), nos botoes (5s) e nas notificacoes (5min por usuario por evento). Aceita perda no restart.

---

## Hardening

### Validacao de input

- **`sanitizeText`** — Neutraliza @everyone/@here injection em inputs de texto. Limita tamanho.
- **`validateScore`** — Centraliza validacao de placar por formato (MD1: 1-0, MD3: 2-0 ou 2-1).
- Centralizados em `lib/validation.ts`, usados em admin `fix-result` e `submit-score`.

### Integridade no banco de dados

- `CHECK` constraint `Duel_score_format_check` — Placar coerente com formato do duelo.
- `CHECK` constraint `Duel_winner_participant_check` — `winnerId` deve ser `challengerId` ou `opponentId`.
- Indice unico parcial `Season_single_active_idx` — Previne multiplas seasons ativas simultaneamente.
- `witnessId` — `NOT NULL` com `ON DELETE RESTRICT`.

### Tipagem

- Zero `as any` no codigo de producao. Substituidos por tipos Discord.js (`TextChannel`, `GuildMemberRoleManager`).
- `duelWhere` em `history.service.ts` tipado como `Prisma.DuelWhereInput`.

---

## Observabilidade

### Health server

- Endpoint HTTP `/health` retorna status do bot, saude dos jobs, uptime e metricas de notificacoes.
- Responde `200 ok` ou `503 degraded`.
- Configuravel via `HEALTH_PORT` (padrao: 8080).
- Usado pelo Fly.io para monitorar o container (reinicia se falhar).

### Alertas ops

- Webhook Discord para canal privado (`OPS_WEBHOOK_URL`).
- Alertas de falhas criticas de jobs.
- Dedup automatico: 1 alerta por incidente ate recovery.

### Metricas de notificacoes

- Contadores in-memory: DM sent/failed, fallback sent/failed, throttled.
- Expostos no endpoint `/health`.
- Aceita perda no restart (in-memory).

### Logging

- JSON estruturado com timestamp, level e context.
- Sem dependencia externa.
- Correlacao por `requestId` (interaction ID do Discord) em todas as interacoes.
- Log de entrada para cada comando, botao e modal recebido.

---

## CI/CD

### Pipeline

```
PR aberto → CI (lint + typecheck + testes) → Review → Merge na main → Deploy automatico
```

### CI (`ci.yml`)

- Trigger: push e PR para `main`
- Steps: `npm ci` → `prisma generate` → lint → typecheck (`tsc --noEmit`) → testes com cobertura
- Cobertura minima: 80% lines/functions, 70% branches
- Env vars de CI: valores dummy (testes usam mocks, sem banco real)

### Deploy (`deploy.yml`)

- Trigger: `workflow_run` — dispara quando CI completa com sucesso na `main`
- Usa `superfly/flyctl-actions/setup-flyctl@master` + `fly deploy --remote-only`
- `FLY_API_TOKEN` (escopo deploy-only) como secret do repositorio GitHub
- Build remoto no Fly.io (nunca expoe Docker local)
- PRs nunca disparam deploy — apenas CI

### Branch protection

- PRs obrigatorios para `main`
- CI deve passar antes do merge
- Squash merge only
- Force push bloqueado
- Bypass: repository admin (emergencia)

---

## Deploy (Fly.io)

### Configuracao (`fly.toml`)

- App: `ninduelist`
- Regiao: `gru` (Sao Paulo)
- Recursos: `shared-cpu-1x`, 256MB RAM (free tier)
- `auto_stop_machines = false` — bot deve rodar 24/7
- `auto_start_machines = false` — nao e HTTP app
- `min_machines_running = 1` — sempre 1 machine ativa
- `max_machines_running = 1` — bot Discord nao pode ter multiplas instancias (mesmo token)

### Health check

- Tipo: HTTP GET `/health`
- Intervalo: 30s
- Timeout: 5s
- Grace period: 30s (tempo de startup)
- Se falhar: Fly.io reinicia o container automaticamente

### Secrets

Gerenciados exclusivamente via `fly secrets set`. Nunca no `fly.toml`, nunca no repositorio.

Secrets configurados:
- `DISCORD_TOKEN`, `DISCORD_CLIENT_ID`, `DATABASE_URL` (obrigatorios)
- `DISCORD_GUILD_ID`, `ADMIN_ROLE_IDS`, `OPS_WEBHOOK_URL` (configurados)

### Rollback

```bash
fly releases          # Lista releases anteriores
fly deploy --image <image>  # Volta para uma release anterior
```

---

## Distribuicao

O bot e de uso privado. Novos servidores Discord so recebem acesso mediante contato direto com os socios por e-mail. `DISCORD_GUILD_ID` e setado em producao para restringir commands ao servidor autorizado.
