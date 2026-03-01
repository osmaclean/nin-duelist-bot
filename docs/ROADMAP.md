# NinDuelist — Roadmap

Estado atual do projeto e próximos passos.

---

## Implementado

### Comandos
| Comando | Descrição |
|---|---|
| `/duel @oponente formato @testemunha` | Criar duelo ranqueado |
| `/rank [page]` | Ranking paginado da season |
| `/mvp` | Top 5 da season |
| `/pending` | Duelos que precisam de ação sua |
| `/history [@player]` | Estatísticas + últimos 10 duelos |
| `/profile [@player]` | Perfil compacto com ranking |
| `/admin cancel duel_id reason` | Cancelar duelo (admin) |

### Notificações (DM + fallback canal)
| Evento | Destinatários |
|---|---|
| Duelo criado | Oponente + testemunha |
| Duelo aceito (ACCEPTED) | Ambos duelistas |
| Resultado enviado | Testemunha |
| Resultado confirmado | Ambos duelistas |
| Resultado rejeitado | Ambos duelistas |
| Duelo expirado | Todos (3 participantes) |

### Infraestrutura
- Validação de env vars no startup (`requireEnv`)
- Graceful shutdown (SIGTERM/SIGINT)
- Transação atômica na confirmação (`confirmAndApplyResult`)
- Handler HOF para botões (`createDuelButtonHandler`)
- NaN guard em todos os parsers de `customId`
- Antifarm com UTC correto + filtro por `updatedAt`
- Pagination com `deferUpdate` antes do guard + clamp de página
- Logging estruturado (JSON)
- 36 arquivos de teste, 234 testes

---

## Próximos Passos — Features

### Prioridade 1: Engajamento

#### `/h2h @a @b`
Confronto direto entre dois jogadores na season atual.
- Vitórias/derrotas de cada um contra o outro
- Últimos duelos entre eles com placar
- Win rate do confronto

#### `/activity`
Jogadores mais ativos da season.
- Ranking por número de duelos jogados
- Útil para identificar engajamento

#### `/records`
Recordes da season atual.
- Maior streak
- Melhor win rate (com mínimo de jogos)
- Mais duelos jogados

### Prioridade 2: Admin completo

#### `/admin reopen duel_id reason`
Reabre duelo travado para `IN_PROGRESS`.

#### `/admin fix-result duel_id winner score reason`
Corrige resultado confirmado com recálculo transacional de pontos/streak.

#### `/admin force-expire duel_id reason`
Força expiração de duelo.

#### Infra de auditoria
- Tabela `AdminActionLog` com snapshots antes/depois
- `/admin logs duel_id` para consultar histórico de ações
- Toda ação admin grava reason + admin ID + timestamps

### Prioridade 3: Melhorias de notificação
- Aviso de duelo perto de expirar (10 min antes)
- Anti-spam: deduplicação por evento + cooldown por usuário
- Opção de desativar DMs por usuário (futuro)

### Prioridade 4: Filtros avançados
- `/history` com filtros `vs:@user`, `from:date`, `to:date`
- `/history` com paginação por botões para mais de 10 duelos
- `/pending` com filtro `season: current|all` e `limit`

---

## Dívida Técnica (baixa prioridade)

| # | Item | Esforço |
|---|------|---------|
| 12 | `DISCORD_GUILD_ID` tipagem — funcional mas semântica poderia ser `string \| undefined` | Trivial |
| 13 | `channelId` nullable no schema mas sempre populado no `createDuel` | Baixo |
| 14 | Pontos podem ficar negativos — **decisão de produto: permitido** | N/A |
| 15 | `typescript` em `dependencies` — mover para `devDependencies` + multi-stage Dockerfile | Trivial |
| 16 | `as any` desnecessários em `interactionCreate.ts` após `in` check | Trivial |
| 17 | Cálculo `startRank` duplicado em `rank.ts` e `pagination.ts` | Trivial |
| 18 | `submit-result.ts` não usa `createDuelButtonHandler` HOF | Médio |

---

## Decisões de Produto Registradas

- **Pontos negativos:** Permitidos. Sem floor em 0.
- **Anti-farm:** 1 duelo confirmado por par de jogadores por dia (UTC).
- **Season:** 30 dias, fechamento automático, campeão = mais pontos.
- **Notificações:** DM com fallback para canal. Fire-and-forget.
- **Admin:** Cargo via `ADMIN_ROLE_IDS` env var. Reason obrigatório.
