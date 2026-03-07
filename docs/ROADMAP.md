# NinDuelist — Roadmap

Estado atual do projeto e próximos passos.

---

## Implementado

### Comandos
| Comando | Descrição |
|---|---|
| `/duel @oponente formato @testemunha` | Criar duelo ranqueado |
| `/rank [page]` | Ranking paginado da season |
| `/mvp` | Top 3 da season |
| `/pending [limit]` | Duelos pendentes de ação sua (com limite opcional) |
| `/history [@player] [vs] [from] [to] [page]` | Histórico paginado com filtros (oponente, datas) |
| `/season` | Status da season atual (público) |
| `/profile [@player]` | Perfil compacto com ranking |
| `/h2h @a @b` | Confronto direto entre dois jogadores |
| `/activity` | Top 10 jogadores mais ativos da season |
| `/records` | Recordes da season (streak, win rate, duelos) |
| `/admin cancel duel_id reason` | Cancelar duelo (admin) |
| `/admin reopen duel_id reason` | Reabrir duelo terminal (admin) |
| `/admin force-expire duel_id reason` | Forçar expiração (admin) |
| `/admin fix-result duel_id winner score reason` | Corrigir resultado (admin) |
| `/admin logs duel_id` | Histórico de ações admin |
| `/admin season status` | Info da season ativa (admin) |
| `/admin season end` | Encerrar season (admin) |
| `/admin season create [name] [duration]` | Criar nova season (admin) |
| `/admin season repair season_id` | Recalcular stats de uma season (admin) |
| `/admin search player @player` | Buscar duelos de um jogador (admin) |
| `/admin search status STATUS` | Buscar duelos por status (admin) |
| `/settings notifications on\|off` | Ativar/desativar DMs do bot |

### Notificações (DM + fallback canal)
| Evento | Destinatários |
|---|---|
| Duelo criado | Oponente + testemunha |
| Duelo aceito (ACCEPTED) | Ambos duelistas |
| Resultado enviado | Testemunha |
| Resultado confirmado | Ambos duelistas |
| Resultado rejeitado | Ambos duelistas |
| Duelo expirando (10 min) | Oponente + testemunha |
| Duelo expirado | Todos (3 participantes) |
| Admin cancelou duelo | Ambos duelistas |
| Admin reabriu duelo | Ambos duelistas |
| Admin forçou expiração | Ambos duelistas |
| Admin corrigiu resultado | Ambos duelistas |
| Season encerrando (24h) | Todos os jogadores ativos da season |

### Infraestrutura
- Validação de env vars no startup (`requireEnv`)
- Graceful shutdown (SIGTERM/SIGINT)
- Transação atômica na confirmação (`confirmAndApplyResult`)
- Handler HOF para botões (`createDuelButtonHandler`)
- NaN guard em todos os parsers de `customId`
- Antifarm com UTC correto + filtro por `updatedAt`
- Pagination com `deferUpdate` antes do guard + clamp de página
- Logging estruturado (JSON)
- `withRetry` com backoff exponencial (`lib/retry.ts`)
- Cooldown in-memory reutilizável (`lib/cooldown.ts`)
- `reconcileStaleEmbeds()` no startup
- Aviso de expiração com 10 min restantes
- Job health check in-memory (`lib/job-health.ts`) com warn automático
- Guard de season expirada no `/duel` (rejeita criação no gap de rotação)
- Anti-spam: cooldown por usuário por tipo de evento (`NOTIFICATION_COOLDOWN_MS`)
- Opt-out de DMs: campo `dmEnabled` no Player, fallback para canal se desativado
- Aviso de season encerrando 24h antes (flag `endingNotificationSent` na Season)
- Botões desabilitados somente após validação de permissão (não afeta embed para outros)
- `markJobSuccess` apenas em ciclos bem-sucedidos (health check não mascara falhas)
- Season ending: notificação enviada antes de marcar flag (retry automático se falhar)
- 55 arquivos de teste, 380 testes
- CI: GitHub Actions (`ci.yml`) — lint, typecheck, tests com cobertura (80% lines/functions, 70% branches)
- CI badge no README
- ESLint (`typescript-eslint` flat config) + Prettier
- Health server HTTP (`/health`) com status do bot, jobs e métricas de notificações
- Alertas ops via webhook Discord (`OPS_WEBHOOK_URL`) para falhas críticas de jobs
- Métricas de notificações in-memory (DM sent/failed, fallback, throttled)
- Correlação de logs por `requestId` (interaction ID) em todas as interações
- Log de comando/botão/modal recebido com requestId no entry point
- Sanitização de inputs de texto (`sanitizeText`) contra @everyone/@here injection
- Validação centralizada de placar por formato (`validateScore`)
- Transaction timeout explícito (10s) em todas as `$transaction`
- CHECK constraints no banco para integridade de placar e winnerId
- Índice único parcial em Season(active) para prevenir múltiplas seasons ativas
- `/admin season repair` — recalcula stats de PlayerSeason a partir dos duelos
- `as any` eliminados do código fonte (substituídos por tipos Discord.js)

---

## Fases de Evolução

### Fase 1 — Consolidação (dívida técnica + consistência) ✅

Objetivo: eliminar inconsistências, preparar base para features novas.

#### 1.1 Padronização de handlers
- [x] Extrair `validateDuelButton` helper compartilhado entre HOF e `submit-result.ts`
- [x] Remover `as any` desnecessários em `interactionCreate.ts`
- [x] Extrair `calcStartRank` duplicado entre `rank.ts` e `pagination.ts`

#### 1.2 Limpeza de build e deps
- [x] Mover `typescript` e `prisma` CLI para `devDependencies`
- [x] Multi-stage Dockerfile (build stage + runtime stage)
- [x] `DISCORD_GUILD_ID` tipagem corrigida para `string | undefined`

#### 1.3 Schema e tipos
- [x] `channelId` obrigatório no schema + migration incremental
- [x] `LeaderboardResult` tipo explícito exportado em `ranking.service.ts`

---

### Fase 2 — Resiliência (robustez em produção) ✅

Objetivo: bot mais confiável, menos edge cases silenciosos.

#### 2.1 Jobs mais robustos
- [x] `withRetry` helper com backoff exponencial reutilizável (`lib/retry.ts`)
- [x] Retry em ambos os jobs (`expire-duels`, `season-check`)
- [x] Log de métricas por ciclo (duelos processados, falhas de embed, duração)
- [x] Run imediato do expire-duels no startup (reconcilia duelos presos)

#### 2.2 Sincronização embed/banco
- [x] Log estruturado (warn) quando update de embed falha (duelId, channelId, messageId)
- [x] `reconcileStaleEmbeds()` no startup: limpa botões de duelos terminais das últimas 24h

#### 2.3 Rate limiting básico
- [x] `lib/cooldown.ts` — módulo de cooldown in-memory reutilizável
- [x] Cooldown de 30s por usuário no `/duel` (DUEL_COOLDOWN_MS)
- [x] Debounce de 5s em botões de ação via HOF (BUTTON_COOLDOWN_MS)

#### 2.4 Aviso de expiração
- [x] Notificação DM quando duelo está a 10 min de expirar (EXPIRY_WARNING_MS)
- [x] Flag `expiryWarned` no schema + migration incremental
- [x] `notifyDuelExpiringSoon()` com fallback para canal

---

### Fase 2.5 — Hardening (edge cases + saúde operacional) ✅

Objetivo: fechar brechas conhecidas antes de adicionar features novas.

#### 2.5.1 Guard de season expirada na criação de duelo
- [x] Validar `season.endDate <= now()` no comando `/duel` (após `getActiveSeason()`)
- [x] Retornar erro amigável se season estiver expirada mas job ainda não rodou
- [x] Teste unitário cobrindo o cenário

#### 2.5.2 Health check de jobs
- [x] `lib/job-health.ts` — registro in-memory de último ciclo bem-sucedido por job
- [x] Log `warn` se gap entre ciclos > 2x intervalo esperado
- [x] Registro no startup log dos jobs registrados (ready.ts)
- [x] Integração em `expire-duels` e `season-check` (register, check, mark)

---

### Fase 3 — Engajamento (features para a comunidade) ✅

Objetivo: mais motivos para jogadores interagirem com o sistema.

#### 3.1 `/h2h @a @b` ✅
- [x] Service: buscar duelos CONFIRMED entre dois jogadores na season
- [x] Cálculo: vitórias de cada lado, win rate do confronto
- [x] Embed: últimos duelos entre eles com placar
- [x] Comando: registrar slash command com 2 params user

#### 3.2 `/activity` ✅
- [x] Service: ranking por total de duelos jogados (wins + losses) na season
- [x] Embed: top 10 mais ativos com contagem
- [x] Comando: registrar slash command

#### 3.3 `/records` ✅
- [x] Service: queries para maior streak, melhor win rate (mín. 5 jogos), mais duelos
- [x] Embed: recordes da season com holders
- [x] Comando: registrar slash command

---

### Fase 3.5 — UX do fluxo de duelo ✅

Objetivo: simplificar o fluxo de duelo, eliminar fricção desnecessária.

#### 3.5.1 Remover aceite da testemunha ✅
- [x] `acceptOpponent` → quando oponente aceita, mover direto para ACCEPTED (sem esperar testemunha)
- [x] Remover botão "Aceitar Testemunha" do embed de PROPOSED
- [x] Remover `witnessAccepted` da lógica de `tryMoveToAccepted`
- [x] Testemunha só participa na validação do resultado (AWAITING_VALIDATION)
- [x] Atualizar `buildDuelComponents` para não mostrar botão de aceite de testemunha
- [x] Atualizar testes

#### 3.5.2 Substituir modal de resultado por botões ✅
- [x] Ao clicar "Enviar Resultado", mostrar mensagem efêmera: "Quem venceu?" com 2 botões (nome de cada jogador)
- [x] Ao clicar no vencedor, abrir modal menor pedindo apenas o placar (score vencedor / score perdedor)
- [x] Para MD1: pular modal de placar, já que é sempre 1-0 — submeter direto
- [x] Remover campo de ID do vencedor do modal
- [x] Atualizar `submit-result.ts`, `submit-score.ts` e testes

---

### Fase 4 — Admin completo ✅

Objetivo: ferramentas para moderação sem acesso direto ao banco.

#### 4.1 Infra de auditoria ✅
- [x] Criar tabela `AdminActionLog` (action, adminDiscordId, duelId, reason, previousStatus, newStatus, createdAt)
- [x] Migration SQL incremental + Prisma schema update
- [x] Service de audit: `logAdminAction()` e `getAdminLogs()` reutilizáveis
- [x] Migrar `/admin cancel` para usar audit log persistente (mantém log stdout também)

#### 4.2 Novos comandos admin ✅
- [x] `/admin reopen duel_id reason` — reabrir duelo para IN_PROGRESS (reverte stats se CONFIRMED)
- [x] `/admin fix-result duel_id winner score reason` — corrigir resultado com recálculo transacional
- [x] `/admin force-expire duel_id reason` — forçar expiração de duelo não-terminal
- [x] `/admin logs duel_id` — consultar histórico de ações admin

#### 4.3 Gestão de season (admin) ✅
- [x] `/admin season status` — ver season ativa (número, nome, datas, total de duelos, jogadores ativos)
- [x] `/admin season end` — encerrar season ativa manualmente, definir top 1/2/3 automaticamente pelo ranking
- [x] `/admin season create name duration` — criar nova season com nome e duração customizada
- [x] Adicionar coluna `name` (TEXT, nullable) na tabela Season + migration SQL
- [x] Encerrar season: marcar `active = false`, calcular e persistir campeão (top 1)
- [x] Embed de encerramento com pódio (top 3) enviado no canal

#### 4.4 Busca de duelos (admin) ✅
- [x] `/admin search player @player` — listar últimos 15 duelos de um jogador (como challenger, oponente ou testemunha)
- [x] `/admin search status STATUS` — listar últimos 15 duelos em um status específico (choices com todos os 7 status)

---

### Fase 4.5 — CI/CD e qualidade automatizada ✅

Objetivo: garantir que nenhum push quebre produção. Testes e lint rodando antes do deploy.

#### 4.5.1 Pipeline de CI (GitHub Actions) ✅
- [x] Workflow `ci.yml`: rodar `npm test` em todo push/PR para `main`
- [x] Rodar `tsc --noEmit` para checar tipos sem compilar
- [x] Cache de `node_modules` no CI para velocidade
- [x] Badge de status no README
- [x] Cobertura de testes no CI com thresholds (80% lines/functions, 70% branches)

#### 4.5.2 Lint e formatação ✅
- [x] ESLint com `typescript-eslint` (flat config, `eslint.config.mjs`)
- [x] Prettier com config único (`.prettierrc`)
- [x] `no-explicit-any` como warning (off em `*.test.ts`)
- [x] Step de lint no workflow de CI
- [x] Scripts: `npm run lint`, `npm run lint:fix`, `npm run format`, `npm run format:check`

#### 4.5.3 Proteção de branch ✅
- [x] Ruleset `main-protection` ativo no GitHub (repo público)
- [x] Restrict deletions, block force pushes
- [x] Require a pull request before merging (0 approvals, squash only)
- [x] Require status checks to pass (`Lint, Typecheck & Test`, branches up to date)
- [x] Bypass: Repository admin (emergência)

---

### Fase 5 — Melhorias de notificação ✅

Objetivo: notificações mais inteligentes, menos ruído, admin visível.

#### 5.1 Notificações de ações admin ✅
- [x] Notificar duelistas ao `/admin cancel` (mensagem com reason)
- [x] Notificar duelistas ao `/admin reopen` (mensagem com reason)
- [x] Notificar duelistas ao `/admin force-expire` (mensagem com reason)
- [x] Notificar duelistas ao `/admin fix-result` (mensagem com novo resultado e reason)
- [x] Testes para todas as notificações admin

#### 5.2 Anti-spam: deduplicação por evento + cooldown por usuário ✅
- [x] Cooldown de notificação por usuário por tipo de evento (reutilizar `lib/cooldown.ts`)
- [x] Constante `NOTIFICATION_COOLDOWN_MS` em `config.ts` (5 minutos)
- [x] Testes para deduplicação

#### 5.3 Opt-out de DMs por usuário ✅
- [x] Migration: adicionar coluna `dmEnabled` (Boolean, default true) no Player (campo simples, sem JSON de preferências — se precisar de mais preferências no futuro, adiciona colunas novas)
- [x] Check `dmEnabled` em `sendDmWithFallback` antes de enviar DM (fallback para canal se desativado)
- [x] Comando `/settings notifications on|off` para o usuário controlar
- [x] Testes para opt-out

#### 5.4 Notificação de season encerrando (24h antes) ✅
- [x] Migration: adicionar coluna `endingNotificationSent` (Boolean, default false) na Season
- [x] Função `notifySeasonEnding(client, season)` em `notifications.ts`
- [x] Constante `SEASON_ENDING_WARNING_MS` em `config.ts` (24 horas)
- [x] Check no job `season-check`: se `endDate - now() <= 24h` e flag false → enviar e marcar true
- [x] `markSeasonEndingNotified()` no `season.service.ts`
- [x] Testes para notificação de season encerrando

---

### Fase 5.5 — Correções e polish ✅

Objetivo: corrigir bugs funcionais e operacionais identificados na análise complementar.

#### 5.5.1 Botões desabilitados antes de validar permissão ✅
- [x] Mover `disableAllButtons(interaction)` para após `validateDuelButton` retornar sucesso
- [x] Garantir que usuário sem permissão recebe resposta efêmera sem afetar embed para outros

#### 5.5.2 Limpar lógica obsoleta de `witnessAccepted` ✅
- [x] Remover `witnessAccepted` da lógica de urgência em `pending.service.ts`
- [x] Atualizar testes de `/pending` (novo teste: testemunha em PROPOSED recebe urgency 4)
- Remoção do campo `witnessAccepted` do schema adiada para Fase 8.5 (migration incremental)

#### 5.5.3 Medalhas no ranking e MVP ✅
- [x] Corrigir arrays de medalhas em `embeds.ts` para emojis corretos (U+1F947, U+1F948, U+1F949)
- [x] Atualizar testes de embeds para validar medalhas

#### 5.5.4 Health check não mascarar falha de job ✅
- [x] Mover `markJobSuccess('expire-duels')` para dentro do `try` (após sucesso real), remover do `finally`
- [x] `season-check` já estava correto (`markJobSuccess` dentro do `try`); corrigido early return sem `markJobSuccess`
- [x] Teste: verificar que `markJobSuccess` não é chamado após falha

#### 5.5.5 Flag de season ending após envio (não antes) ✅
- [x] Inverter ordem: `await notifySeasonEnding()` primeiro, `await markSeasonEndingNotified()` somente após sucesso
- [x] Se notificação falha, flag não é marcada — próximo ciclo retenta
- [x] Teste: verificar ordem de chamada (notify antes de mark) e que falha de notify impede mark

---

### Fase 6 — Filtros avançados ✅

Objetivo: mais controle na consulta de dados.

- [x] `/history` com filtros `vs:@user`, `from:YYYY-MM-DD`, `to:YYYY-MM-DD`
- [x] `/history` com paginação por botões (10 duelos por página, botões Anterior/Próxima)
- [x] `/pending` com parâmetro `limit` (1-50) para limitar resultados
- [x] `/season` (público) — status da season atual: número, nome, datas, dias restantes, duelos, jogadores, top 3 parcial

---

### Fase 7 — Observabilidade e monitoramento ✅

Objetivo: saber o que está acontecendo em produção sem cavar logs manualmente.

#### 7.1 Monitoramento de saúde ✅
- [x] Endpoint HTTP `/health` básico (status do bot, último ciclo dos jobs, uptime, métricas de notificações)
- [x] Health check pronto para Railway (responde 200 ok / 503 degraded)
- [x] Dashboard descartado — `/health` + logs estruturados suficientes para a escala (< 200 jogadores)

#### 7.2 Alertas ✅
- [x] Webhook Discord para canal privado de ops (`OPS_WEBHOOK_URL`): alertas de erros críticos
- [x] Alerta quando gap de job health > threshold (ops alert com dedup — só envia uma vez até recuperar)
- [x] Alerta em falha de jobs (`expire-duels`, `season-check`) via ops webhook
- [x] Métricas de sucesso/falha de notificações (DM sent/failed, fallback sent/failed, throttled) — `notification-metrics.ts`

#### 7.3 Logging aprimorado ✅
- [x] Correlação de logs por `requestId` (interaction ID do Discord) em todas as interações
- [x] Log de entrada para cada comando, botão e modal recebido
- [x] Log de métricas agregadas por ciclo de job (já existente, mantido)
- [x] Rotação/retenção: Railway gerencia logs nativamente, sem configuração adicional necessária

---

### Fase 8 — Dívidas técnicas e hardening ✅

Objetivo: resolver custos compostos que acumulam complexidade silenciosamente.

#### 8.1 Validação de input ✅
- [x] Sanitizar inputs de texto em commands (`sanitizeText` — neutraliza @everyone/@here, limita tamanho)
- [x] Validar limites numéricos explícitos em scores (`validateScore` — MD1: 1-0, MD3: 2-0 ou 2-1)
- [x] Centralizar validação de formato de duelo em `lib/validation.ts` (usado em admin fix-result e submit-score)

#### 8.2 Tipagem e contratos ✅
- [x] Reduzir `as any` no código fonte — substituídos por `as TextChannel` e `as GuildMemberRoleManager`
- [x] ~~Corrigir `admin.ts:545` — trocar `status as any` por `status as DuelStatus`~~ (resolvido na Fase 5)
- [x] Corrigir `(season as any).name` — removido cast desnecessário (tipo já inclui `name`)
- [x] Tipar `duelWhere` em `history.service.ts` como `Prisma.DuelWhereInput` (era `any`)
- [x] Tipos discriminados para estados do duelo: avaliado e descartado (over-engineering para a escala atual)

#### 8.3 Resiliência de estado ✅
- [x] Cooldown in-memory: decisão documentada — aceita perda no restart (já estava nas Decisões de Produto)
- [x] Timeout de transações Prisma: `{ timeout: 10_000 }` em `confirmAndApplyResult` e admin `fix-result`; `{ timeout: 15_000 }` em `repairSeasonStats`
- [x] `PrismaClientKnownRequestError`: avaliado — erros genéricos são suficientes para a escala; Prisma já loga detalhes internamente

#### 8.4 Integridade no banco de dados ✅
- [x] `CHECK` constraint `Duel_score_format_check`: placar coerente com formato
- [x] `CHECK` constraint `Duel_winner_participant_check`: winnerId IN (challengerId, opponentId)
- [x] Índice único parcial `Season_single_active_idx`: previne múltiplas seasons ativas
- [x] `/admin season repair <id>` — recalcula `PlayerSeason` a partir dos duelos confirmados

#### 8.5 Manutenção de migrations ✅
- [x] Tornar `migration_phase5.sql` idempotente (`ADD COLUMN IF NOT EXISTS`)
- [x] Corrigir `witnessId` em `migration.sql` base (era nullable, agora NOT NULL + RESTRICT)
- [x] Migration `migration_phase8.sql`: drop witnessAccepted, CHECK constraints, índice parcial
- [x] Remover campo `witnessAccepted` do Prisma schema
- [x] Fluxo de migrations documentado: migration.sql → migration_phase5.sql → migration_phase8.sql

---

## Problemas Conhecidos

| # | Problema | Impacto | Status |
|---|---------|---------|--------|
| 1 | ~~Jobs sem retry — falha silenciosa~~ | ~~Duelos presos em PROPOSED~~ | Resolvido (Fase 2.1) |
| 2 | ~~Embed/botões dessincronizados~~ | ~~Botões de estado anterior~~ | Resolvido (Fase 2.2) |
| 3 | ~~Sem rate limiting~~ | ~~Spam de /duel~~ | Resolvido (Fase 2.3) |
| 4 | ~~Season check a cada 5 min — gap onde duelos podem ser criados na season expirada~~ | ~~Edge case raro~~ | Resolvido (Fase 2.5.1) |
| 5 | ~~Audit trail admin apenas em stdout~~ | ~~Sem accountability persistente~~ | Resolvido (Fase 4.1) |
| 6 | ~~`submit-result.ts` fora do padrão HOF~~ | ~~Inconsistência~~ | Resolvido (Fase 1.1) |
| 7 | ~~Jobs sem health check — falha silenciosa pós-retry não é detectada~~ | ~~Duelos presos~~ | Resolvido (Fase 2.5.2) |
| 8 | ~~Modal de resultado pede ID Discord do vencedor~~ | ~~UX ruim~~ | Resolvido (Fase 3.5.2) |
| 9 | ~~Testemunha precisa aceitar para duelo iniciar~~ | ~~Fricção desnecessária~~ | Resolvido (Fase 3.5.1) |
| 10 | ~~Sem gestão de season pelo Discord~~ | ~~Admin precisa acessar SQL Editor~~ | Resolvido (Fase 4.3) |
| 11 | ~~`notifyDuelExpiringSoon` só notificava oponente, testemunha ficava sem aviso~~ | ~~Testemunha sem ciência da expiração~~ | Resolvido (pré-Fase 5) |
| 12 | ~~`disableAllButtons` chamado antes de validar permissão/status~~ | ~~Botões apagados para todos~~ | Resolvido (Fase 5.5.1) |
| 13 | ~~`/pending` usava `witnessAccepted` na lógica de urgência~~ | ~~Pendências incorretas~~ | Resolvido (Fase 5.5.2) |
| 14 | ~~Medalhas vazias no top 3 do ranking/MVP~~ | ~~Regressão visual~~ | Resolvido (Fase 5.5.3) |
| 15 | ~~`markJobSuccess('expire-duels')` no `finally` mascarava falhas~~ | ~~Health check mentindo~~ | Resolvido (Fase 5.5.4) |
| 16 | ~~`markSeasonEndingNotified` chamado antes do envio~~ | ~~Notificação perdida~~ | Resolvido (Fase 5.5.5) |

---

## Decisões de Produto Registradas

- **Modo único:** Apenas ranqueado. Modo casual descartado.
- **Rejeição de resultado:** Volta para IN_PROGRESS (não cancela). Permite resubmissão.
- **Pontos negativos:** Permitidos. Sem floor em 0.
- **Anti-farm:** 1 duelo confirmado por par de jogadores por dia (UTC). Suficiente para o momento.
- **Season:** 30 dias, fechamento automático, campeão = mais pontos.
- **Notificações:** DM com fallback para canal. Fire-and-forget.
- **Admin:** Cargo via `ADMIN_ROLE_IDS` env var. Reason obrigatório.
- **Escopo:** 1-2 servidores Discord, < 200 jogadores ativos.
- **Infra:** Supabase free tier (suficiente para a escala), deploy automático na Railway (push → main → deploy).
- **CI/CD:** GitHub Actions para testes e lint antes do deploy. Railway faz deploy automático após merge na main.
- **Repositório:** Público no GitHub. Permite branch protection rules sem plano pago.
- **Branch protection:** Ruleset `main-protection` — PRs obrigatórios, CI deve passar, squash merge only, force push bloqueado.
- **Monetização:** Não planejada. Projeto comunitário.
- **Contribuidores:** Apenas os 2 sócios.
- **Cooldown in-memory:** Aceita perda no restart. Não justifica Redis na escala atual.
- **Testemunha:** Não precisa aceitar para o duelo iniciar. Só valida resultado. Escolha é de comum acordo.
- **Resultado:** Sem campo de ID. Botões com nomes dos jogadores ("Quem venceu?"). MD1 auto-submete 1-0.
- **Season admin:** Encerramento define top 3 automaticamente pelo ranking. Coluna `name` adicionada à Season.
- **Opt-out DMs:** Campo `dmEnabled` (Boolean) no Player. Sem JSON de preferências — se precisar de mais preferências no futuro, adiciona colunas novas.
- **Anti-spam notificações:** Cooldown de 5 min por usuário por tipo de evento. In-memory, aceita perda no restart.
- **Admin notifica:** Todas as ações admin (cancel, reopen, force-expire, fix-result) notificam os duelistas com reason.
- **Season ending:** Aviso 24h antes do encerramento. Flag `endingNotificationSent` na Season para dedup persistente.
- **Tipos discriminados de estados do duelo:** Descartado. Over-engineering para a escala. O enum DuelStatus + optimistic locking é suficiente.
- **PrismaClientKnownRequestError específico:** Descartado. Catch genérico é suficiente; Prisma loga detalhes internamente.
- **Persistência de cooldowns:** Decisão mantida — in-memory, aceita perda no restart. Redis não se justifica para < 200 jogadores.
- **Outbox de notificações:** Descartado. Over-engineering para o volume atual. Fire-and-forget é suficiente.
- **Hardening multi-instância:** Descartado. Bot roda em instância única no Railway. Sem justificativa para idempotência distribuída.
- **`/admin replay-notification`:** Descartado. Notificações são fire-and-forget; reenvio manual é edge case demais.
- **Dashboard de métricas:** Descartado (Grafana Cloud, etc). `/health` + logs estruturados são suficientes para < 200 jogadores.
- **Métricas de notificações:** In-memory, aceita perda no restart. Expostas no `/health`.
- **Rotação de logs:** Railway gerencia nativamente. Sem configuração adicional.
- **Alertas ops:** Webhook Discord para canal privado. Dedup automático (1 alerta por incidente até recovery).
