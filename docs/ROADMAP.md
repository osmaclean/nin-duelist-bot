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
| `/pending` | Duelos que precisam de ação sua |
| `/history [@player]` | Estatísticas + últimos 10 duelos |
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
- 50 arquivos de teste, 339 testes
- CI: GitHub Actions (`ci.yml`) — lint, typecheck, tests em push/PR
- ESLint (`typescript-eslint` flat config) + Prettier

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
- [ ] Badge de status no README

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

### Fase 6 — Filtros avançados

Objetivo: mais controle na consulta de dados.

- [ ] `/history` com filtros `vs:@user`, `from:date`, `to:date`
- [ ] `/history` com paginação por botões para mais de 10 duelos
- [ ] `/pending` com filtro `season: current|all` e `limit`

---

### Fase 7 — Observabilidade e monitoramento

Objetivo: saber o que está acontecendo em produção sem cavar logs manualmente.

#### 7.1 Monitoramento de saúde
- [ ] Endpoint HTTP `/health` básico (status do bot, último ciclo dos jobs, uptime)
- [ ] Health check configurado no Railway para auto-restart em falha
- [ ] Dashboard simples de métricas (duelos/dia, jogadores ativos, erros) — avaliar Grafana Cloud free ou alternativa leve

#### 7.2 Alertas
- [ ] Webhook Discord para canal privado de ops: alertas de erros críticos (job falhou após retries, DB inacessível)
- [ ] Alerta quando gap de job health > threshold (já detectado pelo `job-health.ts`, falta notificar)
- [ ] Alerta de season não rotacionada (endDate passou + 30min sem nova season)
- [ ] Métricas de sucesso/falha de notificações (DM enviadas, fallbacks acionados, falhas silenciosas)

#### 7.3 Logging aprimorado
- [ ] Correlação de logs por `duelId` e `requestId` (trace distribuído simples)
- [ ] Log de métricas agregadas por ciclo de job (já parcial, expandir)
- [ ] Rotação/retenção de logs no Railway (avaliar custo vs necessidade)

---

### Fase 8 — Dívidas técnicas e hardening

Objetivo: resolver custos compostos que acumulam complexidade silenciosamente.

#### 8.1 Validação de input
- [ ] Sanitizar inputs de texto em commands (reason no admin, nomes em embeds) contra injection em embeds Discord
- [ ] Validar limites numéricos explícitos em scores (ex: scoreWinner <= 3 para MD3)
- [ ] Centralizar validação de formato de duelo (`MD1`/`MD3`) em helper reutilizável

#### 8.2 Tipagem e contratos
- [ ] Reduzir `as any` no código fonte (13 warnings restantes do ESLint)
- [x] ~~Corrigir `admin.ts:545` — trocar `status as any` por `status as DuelStatus`~~ (resolvido na Fase 5)
- [ ] Tipar retornos de services que retornam `any` implícito
- [ ] Criar tipos discriminados para estados do duelo (DuelProposed, DuelAccepted, etc.) para type safety na máquina de estados

#### 8.3 Resiliência de estado
- [ ] Avaliar persistir cooldowns em memória vs aceitar perda no restart (decisão documentada, manter se aceitável)
- [ ] Timeout de transações Prisma (`$transaction` com `timeout` explícito) para evitar lock infinito
- [ ] Tratamento de `PrismaClientKnownRequestError` específico (unique constraint, not found) vs erro genérico

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
