# NinDuelist — Historico de Desenvolvimento

Registro completo de todas as fases de evolucao do projeto, da concepcao ao estado atual.

---

## Fase 1 — Consolidacao (divida tecnica + consistencia)

Objetivo: eliminar inconsistencias, preparar base para features novas.

### 1.1 Padronizacao de handlers
- Extrair `validateDuelButton` helper compartilhado entre HOF e `submit-result.ts`
- Remover `as any` desnecessarios em `interactionCreate.ts`
- Extrair `calcStartRank` duplicado entre `rank.ts` e `pagination.ts`

### 1.2 Limpeza de build e deps
- Mover `typescript` e `prisma` CLI para `devDependencies`
- Multi-stage Dockerfile (build stage + runtime stage)
- `DISCORD_GUILD_ID` tipagem corrigida para `string | undefined`

### 1.3 Schema e tipos
- `channelId` obrigatorio no schema + migration incremental
- `LeaderboardResult` tipo explicito exportado em `ranking.service.ts`

---

## Fase 2 — Resiliencia (robustez em producao)

Objetivo: bot mais confiavel, menos edge cases silenciosos.

### 2.1 Jobs mais robustos
- `withRetry` helper com backoff exponencial reutilizavel (`lib/retry.ts`)
- Retry em ambos os jobs (`expire-duels`, `season-check`)
- Log de metricas por ciclo (duelos processados, falhas de embed, duracao)
- Run imediato do expire-duels no startup (reconcilia duelos presos)

### 2.2 Sincronizacao embed/banco
- Log estruturado (warn) quando update de embed falha (duelId, channelId, messageId)
- `reconcileStaleEmbeds()` no startup: limpa botoes de duelos terminais das ultimas 24h

### 2.3 Rate limiting basico
- `lib/cooldown.ts` — modulo de cooldown in-memory reutilizavel
- Cooldown de 30s por usuario no `/duel` (DUEL_COOLDOWN_MS)
- Debounce de 5s em botoes de acao via HOF (BUTTON_COOLDOWN_MS)

### 2.4 Aviso de expiracao
- Notificacao DM quando duelo esta a 10 min de expirar (EXPIRY_WARNING_MS)
- Flag `expiryWarned` no schema + migration incremental
- `notifyDuelExpiringSoon()` com fallback para canal

---

## Fase 2.5 — Hardening (edge cases + saude operacional)

Objetivo: fechar brechas conhecidas antes de adicionar features novas.

### 2.5.1 Guard de season expirada na criacao de duelo
- Validar `season.endDate <= now()` no comando `/duel` (apos `getActiveSeason()`)
- Retornar erro amigavel se season estiver expirada mas job ainda nao rodou

### 2.5.2 Health check de jobs
- `lib/job-health.ts` — registro in-memory de ultimo ciclo bem-sucedido por job
- Log `warn` se gap entre ciclos > 2x intervalo esperado
- Registro no startup log dos jobs registrados (ready.ts)
- Integracao em `expire-duels` e `season-check` (register, check, mark)

---

## Fase 3 — Engajamento (features para a comunidade)

Objetivo: mais motivos para jogadores interagirem com o sistema.

### 3.1 `/h2h @a @b`
- Service: buscar duelos CONFIRMED entre dois jogadores na season
- Calculo: vitorias de cada lado, win rate do confronto
- Embed: ultimos duelos entre eles com placar

### 3.2 `/activity`
- Service: ranking por total de duelos jogados (wins + losses) na season
- Embed: top 10 mais ativos com contagem

### 3.3 `/records`
- Service: queries para maior streak, melhor win rate (min. 5 jogos), mais duelos
- Embed: recordes da season com holders

---

## Fase 3.5 — UX do fluxo de duelo

Objetivo: simplificar o fluxo de duelo, eliminar friccao desnecessaria.

### 3.5.1 Remover aceite da testemunha
- Quando oponente aceita, mover direto para ACCEPTED (sem esperar testemunha)
- Remover botao "Aceitar Testemunha" do embed de PROPOSED
- Testemunha so participa na validacao do resultado (AWAITING_VALIDATION)

### 3.5.2 Substituir modal de resultado por botoes
- Ao clicar "Enviar Resultado", mostrar mensagem efemera: "Quem venceu?" com 2 botoes (nome de cada jogador)
- Ao clicar no vencedor: MD1 submete direto (1-0), MD3 abre modal pedindo placar (2-0 ou 2-1)
- Remover campo de ID do vencedor do modal

---

## Fase 4 — Admin completo

Objetivo: ferramentas para moderacao sem acesso direto ao banco.

### 4.1 Infra de auditoria
- Tabela `AdminActionLog` (action, adminDiscordId, duelId, reason, previousStatus, newStatus, createdAt)
- Service de audit: `logAdminAction()` e `getAdminLogs()` reutilizaveis
- Migrar `/admin cancel` para usar audit log persistente

### 4.2 Novos comandos admin
- `/admin reopen duel_id reason` — reabrir duelo para IN_PROGRESS (reverte stats se CONFIRMED)
- `/admin fix-result duel_id winner score reason` — corrigir resultado com recalculo transacional
- `/admin force-expire duel_id reason` — forcar expiracao de duelo nao-terminal
- `/admin logs duel_id` — consultar historico de acoes admin

### 4.3 Gestao de season (admin)
- `/admin season status` — ver season ativa (numero, nome, datas, total de duelos, jogadores ativos)
- `/admin season end` — encerrar season ativa manualmente, definir top 1/2/3 automaticamente pelo ranking
- `/admin season create name duration` — criar nova season com nome e duracao customizada
- Coluna `name` (TEXT, nullable) na tabela Season
- Embed de encerramento com podio (top 3) enviado no canal

### 4.4 Busca de duelos (admin)
- `/admin search player @player` — listar ultimos 15 duelos de um jogador
- `/admin search status STATUS` — listar ultimos 15 duelos em um status especifico

---

## Fase 4.5 — CI/CD e qualidade automatizada

Objetivo: garantir que nenhum push quebre producao.

### 4.5.1 Pipeline de CI (GitHub Actions)
- Workflow `ci.yml`: `npm test` em todo push/PR para `main`
- `tsc --noEmit` para checar tipos sem compilar
- Cache de `node_modules` no CI
- Badge de status no README
- Cobertura de testes com thresholds (80% lines/functions, 70% branches)

### 4.5.2 Lint e formatacao
- ESLint com `typescript-eslint` (flat config, `eslint.config.mjs`)
- Prettier com config unico (`.prettierrc`)
- `no-explicit-any` como warning (off em `*.test.ts`)

### 4.5.3 Protecao de branch
- Ruleset `main-protection` ativo no GitHub
- Restrict deletions, block force pushes
- Require a pull request before merging (squash only)
- Require status checks to pass
- Bypass: Repository admin (emergencia)

---

## Fase 5 — Melhorias de notificacao

Objetivo: notificacoes mais inteligentes, menos ruido, admin visivel.

### 5.1 Notificacoes de acoes admin
- Notificar duelistas ao `/admin cancel`, `/admin reopen`, `/admin force-expire`, `/admin fix-result`
- Mensagem inclui reason do admin

### 5.2 Anti-spam: deduplicacao por evento + cooldown por usuario
- Cooldown de notificacao por usuario por tipo de evento (reutiliza `lib/cooldown.ts`)
- Constante `NOTIFICATION_COOLDOWN_MS` em `config.ts` (5 minutos)

### 5.3 Opt-out de DMs por usuario
- Coluna `dmEnabled` (Boolean, default true) no Player
- Check `dmEnabled` em `sendDmWithFallback` antes de enviar DM (fallback para canal se desativado)
- Comando `/settings notifications on|off`

### 5.4 Notificacao de season encerrando (24h antes)
- Coluna `endingNotificationSent` (Boolean, default false) na Season
- Funcao `notifySeasonEnding(client, season)` em `notifications.ts`
- Constante `SEASON_ENDING_WARNING_MS` em `config.ts` (24 horas)

---

## Fase 5.5 — Correcoes e polish

Objetivo: corrigir bugs funcionais e operacionais identificados na analise complementar.

- Botoes desabilitados somente apos validar permissao (nao afeta embed para outros)
- Limpar logica obsoleta de `witnessAccepted` em `pending.service.ts`
- Corrigir arrays de medalhas em `embeds.ts` para emojis corretos
- `markJobSuccess` movido para dentro do `try` (health check nao mascara falhas)
- `notifySeasonEnding` executado antes de `markSeasonEndingNotified` (retry automatico se falhar)

---

## Fase 6 — Filtros avancados

Objetivo: mais controle na consulta de dados.

- `/history` com filtros `vs:@user`, `from:YYYY-MM-DD`, `to:YYYY-MM-DD`
- `/history` com paginacao por botoes (10 duelos por pagina, botoes Anterior/Proxima)
- `/pending` com parametro `limit` (1-50) para limitar resultados
- `/season` (publico) — status da season atual com top 3 parcial

---

## Fase 7 — Observabilidade e monitoramento

Objetivo: saber o que esta acontecendo em producao sem cavar logs manualmente.

### 7.1 Monitoramento de saude
- Endpoint HTTP `/health` (status do bot, ultimo ciclo dos jobs, uptime, metricas de notificacoes)
- Health check HTTP (200 ok / 503 degraded) — usado pelo Fly.io para monitorar o container

### 7.2 Alertas
- Webhook Discord para canal privado de ops (`OPS_WEBHOOK_URL`): alertas de erros criticos
- Alerta quando gap de job health > threshold (dedup — so envia uma vez ate recuperar)
- Alerta em falha de jobs (`expire-duels`, `season-check`)
- Metricas de sucesso/falha de notificacoes (DM sent/failed, fallback sent/failed, throttled)

### 7.3 Logging aprimorado
- Correlacao de logs por `requestId` (interaction ID do Discord) em todas as interacoes
- Log de entrada para cada comando, botao e modal recebido

---

## Fase 8 — Dividas tecnicas e hardening

Objetivo: resolver custos compostos que acumulam complexidade silenciosamente.

### 8.1 Validacao de input
- `sanitizeText` — neutraliza @everyone/@here, limita tamanho
- `validateScore` — MD1: 1-0, MD3: 2-0 ou 2-1
- Centralizados em `lib/validation.ts` (usado em admin fix-result e submit-score)

### 8.2 Tipagem e contratos
- `as any` eliminados do codigo fonte (substituidos por tipos Discord.js)
- `duelWhere` em `history.service.ts` tipado como `Prisma.DuelWhereInput`

### 8.3 Resiliencia de estado
- Timeout de transacoes Prisma: `{ timeout: 10_000 }` em `confirmAndApplyResult` e admin `fix-result`
- Cooldown in-memory: aceita perda no restart (documentado)

### 8.4 Integridade no banco de dados
- `CHECK` constraint `Duel_score_format_check`: placar coerente com formato
- `CHECK` constraint `Duel_winner_participant_check`: winnerId IN (challengerId, opponentId)
- Indice unico parcial `Season_single_active_idx`: previne multiplas seasons ativas
- `/admin season repair <id>` — recalcula `PlayerSeason` a partir dos duelos confirmados

### 8.5 Manutencao de migrations
- `migration_phase5.sql` tornado idempotente (`ADD COLUMN IF NOT EXISTS`)
- `witnessId` corrigido para NOT NULL + ON DELETE RESTRICT
- `migration_phase8.sql`: drop witnessAccepted, CHECK constraints, indice parcial
- Campo `witnessAccepted` removido do Prisma schema
- Fluxo de migrations: `migration.sql` → `migration_phase5.sql` → `migration_phase8.sql`

---

## Problemas Conhecidos (todos resolvidos)

| # | Problema | Resolvido em |
|---|---------|-------------|
| 1 | Jobs sem retry — falha silenciosa | Fase 2.1 |
| 2 | Embed/botoes dessincronizados | Fase 2.2 |
| 3 | Sem rate limiting | Fase 2.3 |
| 4 | Season check gap — duelos criados na season expirada | Fase 2.5.1 |
| 5 | Audit trail admin apenas em stdout | Fase 4.1 |
| 6 | `submit-result.ts` fora do padrao HOF | Fase 1.1 |
| 7 | Jobs sem health check | Fase 2.5.2 |
| 8 | Modal de resultado pede ID Discord do vencedor | Fase 3.5.2 |
| 9 | Testemunha precisa aceitar para duelo iniciar | Fase 3.5.1 |
| 10 | Sem gestao de season pelo Discord | Fase 4.3 |
| 11 | `notifyDuelExpiringSoon` so notificava oponente | Pre-Fase 5 |
| 12 | `disableAllButtons` chamado antes de validar permissao | Fase 5.5.1 |
| 13 | `/pending` usava `witnessAccepted` na logica de urgencia | Fase 5.5.2 |
| 14 | Medalhas vazias no top 3 | Fase 5.5.3 |
| 15 | `markJobSuccess` no `finally` mascarava falhas | Fase 5.5.4 |
| 16 | `markSeasonEndingNotified` chamado antes do envio | Fase 5.5.5 |

---

## Decisoes de Produto Registradas

- **Modo unico:** Apenas ranqueado. Modo casual descartado.
- **Rejeicao de resultado:** Volta para IN_PROGRESS (nao cancela). Permite resubmissao.
- **Pontos negativos:** Permitidos. Sem floor em 0.
- **Anti-farm:** 1 duelo confirmado por par de jogadores por dia (UTC).
- **Season:** 30 dias, fechamento automatico, campeao = mais pontos.
- **Notificacoes:** DM com fallback para canal. Fire-and-forget.
- **Admin:** Cargo via `ADMIN_ROLE_IDS` env var. Reason obrigatorio.
- **Escopo:** 1-2 servidores Discord, < 200 jogadores ativos.
- **Infra:** Supabase free tier, deploy automatico no Fly.io (push → main → deploy).
- **CI/CD:** GitHub Actions para testes e lint antes do deploy.
- **Repositorio:** Publico no GitHub. Branch protection rules sem plano pago.
- **Branch protection:** PRs obrigatorios, CI deve passar, squash merge only, force push bloqueado.
- **Monetizacao:** Nao planejada. Projeto comunitario.
- **Contribuidores:** Apenas os 2 socios.
- **Cooldown in-memory:** Aceita perda no restart. Redis nao se justifica na escala atual.
- **Testemunha:** Nao precisa aceitar para o duelo iniciar. So valida resultado.
- **Resultado:** Botoes com nomes dos jogadores ("Quem venceu?"). MD1 auto-submete 1-0.
- **Season admin:** Encerramento define top 3 automaticamente pelo ranking.
- **Opt-out DMs:** Campo `dmEnabled` (Boolean) no Player. Sem JSON de preferencias.
- **Anti-spam notificacoes:** Cooldown de 5 min por usuario por tipo de evento. In-memory.
- **Admin notifica:** Todas as acoes admin notificam os duelistas com reason.
- **Season ending:** Aviso 24h antes do encerramento. Flag `endingNotificationSent` para dedup.
- **Dashboard de metricas:** Descartado. `/health` + logs estruturados suficientes para a escala.
- **Metricas de notificacoes:** In-memory, expostas no `/health`. Aceita perda no restart.
- **Alertas ops:** Webhook Discord para canal privado. Dedup automatico.
- **Tipos discriminados de estados:** Descartado. Over-engineering para a escala.
- **Outbox de notificacoes:** Descartado. Fire-and-forget suficiente.
- **Hardening multi-instancia:** Descartado. Instancia unica.
- **Distribuicao do bot:** Acesso restrito. Novos servidores apenas mediante contato por e-mail com os socios. `DISCORD_GUILD_ID` setado em producao.
- **Infra de deploy:** Migrado de Railway para Fly.io (regiao `gru` — Sao Paulo). Supabase mantido como banco.
