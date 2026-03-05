# NinDuelist

Bot Discord para sistema de duelos ranqueados do **Nin Online**. Gerencia desafios entre jogadores com testemunha obrigatória, seasons automáticas, ranking e anti-farm.

---

## Stack

| Tecnologia | Uso |
|---|---|
| **Node.js 20** | Runtime |
| **TypeScript** | Linguagem (strict mode) |
| **Discord.js 14** | Integração Discord |
| **Prisma** | ORM + migrations |
| **PostgreSQL** | Banco de dados (Supabase) |
| **Vitest** | Testes unitários |
| **Docker** | Deploy (Alpine) |

---

## Setup

### 1. Clonar e instalar

```bash
git clone <repo-url>
cd NinDuelist
npm install
```

### 2. Configurar variáveis de ambiente

Copie o `.env.example` e preencha:

```bash
cp .env.example .env
```

| Variável | Obrigatória | Descrição |
|---|---|---|
| `DISCORD_TOKEN` | Sim | Token do bot Discord |
| `DISCORD_CLIENT_ID` | Sim | Application ID do bot |
| `DISCORD_GUILD_ID` | Nao | Restringe commands a uma guild (dev) |
| `DATABASE_URL` | Sim | Connection string PostgreSQL |
| `ADMIN_ROLE_IDS` | Não | IDs de cargos admin separados por vírgula |

O bot valida todas as variáveis obrigatórias no startup e falha com mensagem clara se alguma estiver faltando.

### 3. Banco de dados

```bash
# Gerar o client Prisma
npm run generate

# Aplicar migrations (dev local)
npm run migrate
```

Para Supabase com PgBouncer, rode o SQL de `prisma/migration.sql` diretamente no SQL Editor.

### 4. Registrar slash commands

```bash
npm run deploy-commands
```

Se `DISCORD_GUILD_ID` estiver definido, registra na guild (instantâneo). Senão, registra globalmente (pode levar até 1h para propagar).

### 5. Rodar

```bash
# Desenvolvimento
npm run dev

# Produção
npm run build
npm start
```

### 6. Docker

```bash
docker build -t ninduelist .
docker run --env-file .env ninduelist
```

---

## Testes

```bash
# Rodar todos os testes
npm test

# Modo watch
npm run test:watch
```

50 arquivos de teste, 339 testes. Co-localizados com o código fonte (`*.test.ts`), usando mocks do Vitest. Nenhuma dependência de banco real nos testes.

### Lint e formatação

```bash
# Lint (ESLint com typescript-eslint)
npm run lint
npm run lint:fix

# Formatação (Prettier)
npm run format
npm run format:check
```

### CI/CD

- **GitHub Actions** (`ci.yml`) — Roda lint, typecheck (`tsc --noEmit`) e testes em todo push/PR para `main`
- **Branch protection** — PRs obrigatórios, CI deve passar, squash merge only, force push bloqueado
- **Deploy** — Railway faz deploy automático após merge na `main`

---

## Tutorial Completo

### Conceitos

- **Season** — Temporada de 30 dias. Criada e fechada automaticamente. Ao fechar, o jogador com mais pontos vira campeão e uma nova season começa imediatamente.
- **Duelo** — Partida entre dois jogadores com uma testemunha obrigatória. Passa por uma máquina de estados até ser confirmado.
- **Testemunha** — Terceiro jogador que valida o resultado. Obrigatória em todos os duelos.
- **Ranking** — Placar da season atual. +1 ponto por vitória, -1 por derrota.
- **Anti-farm** — O mesmo par de jogadores só pode ter 1 duelo confirmado por dia (UTC).

---

### Comandos

#### `/pending`

Mostra duelos que precisam de ação sua. Resposta ephemeral (só você vê).

**Exibição:**
- Duelos ordenados por urgência:
  1. Perto de expirar
  2. Aguardando sua validação (testemunha)
  3. Aguardando sua aceitação
  4. Prontos para iniciar
  5. Em andamento
- Para cada duelo: `#id`, adversário, status, tempo restante (quando aplicável)

---

#### `/history [@jogador]`

Exibe histórico de duelos e estatísticas na season atual.

**Parâmetros:**
| Parâmetro | Tipo | Descrição |
|---|---|---|
| `player` | Usuário (opcional) | Jogador para consultar (padrão: você) |

**Exibição:**
- Estatísticas: pontos, vitórias, derrotas, win rate, streak atual, melhor streak
- Últimos 10 duelos confirmados: resultado (V/D), placar, data, oponente

---

#### `/profile [@jogador]`

Exibe o perfil compacto de um jogador com ranking.

**Parâmetros:**
| Parâmetro | Tipo | Descrição |
|---|---|---|
| `player` | Usuário (opcional) | Jogador para consultar (padrão: você) |

**Exibição:**
- Posição no ranking (com medalha para top 3)
- Pontos, vitórias, derrotas, win rate
- Streak atual e melhor streak
- Número de seasons jogadas

---

#### `/h2h @player_a @player_b`

Exibe o confronto direto entre dois jogadores na season atual.

**Parâmetros:**
| Parâmetro | Tipo | Descrição |
|---|---|---|
| `player_a` | Usuário | Primeiro jogador |
| `player_b` | Usuário | Segundo jogador |

**Exibição:**
- Total de duelos entre eles, vitórias e win rate de cada lado
- Últimos 10 duelos do confronto com placar

---

#### `/activity`

Exibe os 10 jogadores mais ativos da season atual (por total de duelos jogados).

**Exibição:**
- Ranking por total de duelos (wins + losses)
- Medalhas para top 3

---

#### `/records`

Exibe os recordes da season atual.

**Exibição:**
- **Maior Streak** — Jogador com maior sequência de vitórias consecutivas
- **Melhor Win Rate** — Jogador com maior taxa de vitória (mínimo 5 jogos)
- **Mais Duelos** — Jogador com mais duelos jogados

---

#### `/settings notifications on|off`

Configura suas preferências de notificação.

**Parâmetros:**
| Parâmetro | Tipo | Descrição |
|---|---|---|
| `notifications` | Escolha | `Ativar DMs` ou `Desativar DMs` |

**Comportamento:**
- `on`: Você recebe notificações por DM (padrão).
- `off`: DMs desativadas. Notificações são enviadas como menção no canal do duelo.

---

#### `/admin cancel duel_id reason`

Cancela um duelo forçadamente (apenas para cargos admin).

**Parâmetros:**
| Parâmetro | Tipo | Descrição |
|---|---|---|
| `duel_id` | Inteiro | ID do duelo a cancelar |
| `reason` | Texto | Motivo do cancelamento |

**Requisitos:**
- Duelo não pode estar em estado terminal (`CONFIRMED`, `CANCELLED`, `EXPIRED`)

---

#### `/admin reopen duel_id reason`

Reabre um duelo em estado terminal para `IN_PROGRESS`.

**Parâmetros:**
| Parâmetro | Tipo | Descrição |
|---|---|---|
| `duel_id` | Inteiro | ID do duelo a reabrir |
| `reason` | Texto | Motivo da reabertura |

**Comportamento:**
- Se o duelo estava `CONFIRMED`, reverte os pontos/wins/losses dos jogadores
- Limpa resultado (winnerId, score) ao reabrir
- Duelo volta para `IN_PROGRESS`, permitindo novo envio de resultado

---

#### `/admin force-expire duel_id reason`

Força a expiração de um duelo não-terminal.

**Parâmetros:**
| Parâmetro | Tipo | Descrição |
|---|---|---|
| `duel_id` | Inteiro | ID do duelo a expirar |
| `reason` | Texto | Motivo da expiração forçada |

---

#### `/admin fix-result duel_id winner score reason`

Corrige o resultado de um duelo já confirmado, recalculando pontos automaticamente.

**Parâmetros:**
| Parâmetro | Tipo | Descrição |
|---|---|---|
| `duel_id` | Inteiro | ID do duelo a corrigir |
| `winner` | Usuário | Novo vencedor (deve ser participante do duelo) |
| `score` | Texto | Novo placar no formato `W-L` (ex: `2-1`) |
| `reason` | Texto | Motivo da correção |

**Comportamento:**
- Reverte os pontos do resultado antigo e aplica os novos, tudo em uma transação atômica
- O duelo permanece em `CONFIRMED`

---

#### `/admin logs duel_id`

Exibe o histórico de ações admin em um duelo.

**Parâmetros:**
| Parâmetro | Tipo | Descrição |
|---|---|---|
| `duel_id` | Inteiro | ID do duelo |

**Exibição:**
- Data, ação, transição de status, admin responsável e motivo

---

#### `/admin season status`

Exibe informações da season ativa.

**Exibição:**
- Número e nome da season, datas de início/término, dias restantes
- Total de duelos e jogadores ativos

---

#### `/admin season end`

Encerra a season ativa manualmente.

**Comportamento:**
- Cancela todos os duelos não-finalizados
- Calcula automaticamente o pódio (top 3) pelo ranking
- Define o campeão (top 1) na season
- Envia embed público com pódio no canal

---

#### `/admin season create [name] [duration]`

Cria uma nova season.

**Parâmetros:**
| Parâmetro | Tipo | Descrição |
|---|---|---|
| `name` | Texto (opcional) | Nome da season |
| `duration` | Inteiro (opcional) | Duração em dias (padrão: 30, máx: 365) |

**Requisitos:**
- Não pode haver outra season ativa (encerre a anterior primeiro)

---

#### `/admin search player @player`

Busca os últimos 15 duelos de um jogador (como desafiante, oponente ou testemunha).

**Parâmetros:**
| Parâmetro | Tipo | Descrição |
|---|---|---|
| `player` | Usuário | Jogador para buscar |

---

#### `/admin search status STATUS`

Busca os últimos 15 duelos em um status específico.

**Parâmetros:**
| Parâmetro | Tipo | Descrição |
|---|---|---|
| `status` | Escolha | Status do duelo (PROPOSED, ACCEPTED, IN_PROGRESS, AWAITING_VALIDATION, CONFIRMED, CANCELLED, EXPIRED) |

---

**Requisitos comuns a todos os comandos admin:**
- Usuário deve possuir um dos cargos listados em `ADMIN_ROLE_IDS`
- Todas as ações são registradas no audit log persistente (`AdminActionLog`)
- O embed original do duelo é atualizado automaticamente quando possível

---

#### `/duel @oponente formato @testemunha`

Desafia um jogador para um duelo.

**Parâmetros:**
| Parâmetro | Tipo | Descrição |
|---|---|---|
| `opponent` | Usuário | Quem você quer desafiar |
| `format` | Escolha | `MD1 (Melhor de 1)` ou `MD3 (Melhor de 3)` |
| `witness` | Usuário | Testemunha obrigatória |

**Validações:**
- Deve existir uma season ativa
- Não pode duelar contra si mesmo
- Oponente e testemunha não podem ser bots
- Testemunha não pode ser um dos duelistas
- Nenhum dos duelistas pode ter outro duelo ativo
- O mesmo par não pode ter mais de 1 duelo confirmado no dia

**Resultado:** O bot posta um embed com o status do duelo e botões de ação.

---

#### `/rank [page]`

Exibe o ranking da season atual.

**Parâmetros:**
| Parâmetro | Tipo | Descrição |
|---|---|---|
| `page` | Inteiro (opcional) | Página do ranking (20 jogadores por página) |

**Exibição:**
```
🥇 @jogador1 — 15pts | 12V 3D | Streak: 4 (max 7)
🥈 @jogador2 — 10pts | 8V 2D | Streak: 2 (max 5)
🥉 @jogador3 — 8pts | 7V 1D | Streak: 1 (max 3)
4. @jogador4 — 5pts | 5V 0D | Streak: 5 (max 5)
```

Botões de **Anterior** / **Próxima** para navegar entre páginas.

---

#### `/mvp`

Exibe os 3 melhores jogadores da season atual.

Mesmo formato do ranking, mas limitado ao top 3 (pódio) e destacando o **Peak Streak** (maior sequência de vitórias).

---

### Fluxo Completo de um Duelo

Um duelo passa por 5 fases. Tudo acontece dentro de um único embed que é atualizado in-place no Discord:

#### Fase 1 — Proposta (`PROPOSED`)

```
Jogador A usa /duel @JogadorB MD1 @Testemunha
```

O bot posta um embed amarelo com:
- Informações do duelo (desafiante, oponente, formato, testemunha)
- Status de aceitação: `Oponente: Pendente`
- Botões: **Aceitar Duelo** (oponente) | **Cancelar**

O oponente precisa aceitar para o duelo iniciar. A testemunha não precisa aceitar — ela só participa na validação do resultado. Se o oponente não aceitar em **30 minutos**, o duelo expira automaticamente.

---

#### Fase 2 — Aceito (`ACCEPTED`)

Quando o oponente aceita, o embed fica azul:
- Botões: **Iniciar Duelo** | **Cancelar**
- Qualquer um dos duelistas (desafiante ou oponente) pode iniciar

---

#### Fase 3 — Em Andamento (`IN_PROGRESS`)

Após iniciar, o embed fica laranja:
- Botões: **Enviar Resultado** | **Cancelar**
- Qualquer duelista pode enviar o resultado

Ao clicar em **Enviar Resultado**, o bot mostra uma mensagem efêmera com 2 botões: os nomes dos jogadores. Clique em quem venceu.

- **MD1:** O resultado é enviado automaticamente (1-0), sem necessidade de digitar placar.
- **MD3:** Abre um modal pedindo apenas o placar (pontos do vencedor e perdedor). Placares válidos: 2-0 ou 2-1.

---

#### Fase 4 — Aguardando Validação (`AWAITING_VALIDATION`)

Após enviar o resultado, o embed fica roxo:
- Mostra o placar enviado
- Botões: **Confirmar Resultado** | **Rejeitar Resultado**
- **Somente a testemunha** pode interagir

**Se a testemunha confirma:** O duelo é finalizado atomicamente — status, pontos e streak dos dois jogadores são atualizados numa única transação.

**Se a testemunha rejeita:** O duelo volta para `IN_PROGRESS` e o resultado é apagado. Os duelistas podem enviar um novo resultado.

---

#### Fase 5 — Confirmado (`CONFIRMED`)

Embed fica verde, sem botões:
- Mostra o placar final: `@vencedor venceu 2-1`
- Footer: `Duelo #N`

**Pontuação aplicada:**
| | Vencedor | Perdedor |
|---|---|---|
| Pontos | +1 | -1 |
| Vitórias/Derrotas | +1 vitória | +1 derrota |
| Streak | +1 (acumula) | Reset para 0 |
| Peak Streak | `MAX(atual, streak)` | Mantém |

---

#### Cancelamento

Qualquer participante (desafiante, oponente ou testemunha) pode cancelar o duelo nas fases `PROPOSED`, `ACCEPTED` ou `IN_PROGRESS`. Nenhuma pontuação é aplicada.

---

### Diagrama de Estados

```
                    ┌──────────────────────────────────────┐
                    │                                      │
                    v                                      │
PROPOSED ──→ ACCEPTED ──→ IN_PROGRESS ──→ AWAITING_VALIDATION ──→ CONFIRMED
    │            │              │                │
    │            │              │                │
    │            └──────────────┘                │
    │                   │              (rejeição volta
    │                   │               para IN_PROGRESS)
    │                   v
    │              CANCELLED
    │
    v
  EXPIRED
  (30 min sem aceitar)
```

---

### Seasons

As seasons são gerenciadas automaticamente:

1. **Criação** — Na primeira inicialização do bot ou quando não existe season ativa, uma nova é criada (Season 1, 2, 3...) com duração de 30 dias.
2. **Fechamento** — A cada 5 minutos, o bot verifica se a season ativa expirou. Se sim:
   - Todos os duelos não-finalizados são cancelados
   - O jogador com mais pontos é registrado como campeão
   - A season é desativada
   - Uma nova season começa imediatamente
3. **Ranking** — Cada jogador tem stats independentes por season (`PlayerSeason`). Nova season = placar zerado para todos.

---

### Registro de Jogadores

Nao existe comando de registro. Jogadores sao cadastrados automaticamente na primeira vez que participam de um duelo (como desafiante, oponente ou testemunha). O username do Discord e mantido atualizado a cada interação.

---

### Anti-Farm

Para evitar abuso de pontuação, existe uma regra simples: **o mesmo par de jogadores so pode ter 1 duelo confirmado por dia (UTC)**. Se Jogador A e Jogador B ja tiveram um duelo confirmado hoje, qualquer novo desafio entre eles (em qualquer direção) sera bloqueado.

---

### Notificações

O bot envia DMs automáticas nos eventos importantes do duelo. Se a DM falhar (privacidade desativada) ou o jogador tiver desativado DMs via `/settings`, faz fallback com menção no canal do duelo.

**Anti-spam:** Cada notificação tem cooldown de 5 minutos por usuário por tipo de evento. Notificações repetidas dentro desse período são suprimidas.

**Opt-out:** Jogadores podem desativar DMs com `/settings notifications off`. Todas as notificações passam a ser enviadas como menção no canal.

| Evento | Quem recebe |
|---|---|
| Duelo criado | Oponente + testemunha |
| Oponente aceitou (ACCEPTED) | Ambos duelistas |
| Resultado enviado | Testemunha |
| Resultado confirmado | Ambos duelistas |
| Resultado rejeitado | Ambos duelistas |
| Duelo expirando (10 min restantes) | Oponente + testemunha |
| Duelo expirado | Todos (3 participantes) |
| Admin cancelou duelo | Ambos duelistas |
| Admin reabriu duelo | Ambos duelistas |
| Admin forçou expiração | Ambos duelistas |
| Admin corrigiu resultado | Ambos duelistas |
| Season encerrando (24h) | Todos os jogadores ativos da season |

---

## Arquitetura

```
src/
├── commands/          # Slash commands (/duel, /rank, /mvp, /pending, /history, /profile, /h2h, /activity, /records, /settings, /admin)
│   └── index.ts       # Barrel — mapa command → handler
├── buttons/           # Button handlers (aceitar, iniciar, cancelar, etc.)
│   ├── handler.ts     # HOF que elimina boilerplate dos handlers
│   └── index.ts       # Barrel — mapa action → handler
├── modals/            # Modal handlers (submit-score)
│   └── index.ts       # Barrel — mapa action → handler
├── services/          # Logica de negocio (duel, player, ranking, season, antifarm, pending, history, profile, h2h, activity, records, audit, search)
├── lib/               # Utilitarios (embeds, components, logger, prisma, pagination, notifications, cooldown, retry, job-health)
├── events/            # Event handlers Discord (ready, interactionCreate)
├── jobs/              # Background jobs (expire-duels, season-check)
├── config.ts          # Constantes e validação de env vars
├── index.ts           # Bootstrap do client Discord + graceful shutdown
└── deploy-commands.ts # Script de registro de slash commands
```

### Decisões Arquiteturais

- **Optimistic locking** — Todas as transições de estado usam `updateMany` com filtro de status. Se o status ja mudou (race condition), retorna null e mostra erro amigável.
- **Transação atômica na confirmação** — `confirmAndApplyResult` encapsula `confirmResult` + `applyResult` dentro de `prisma.$transaction()` no service layer, garantindo consistência entre status do duelo e stats dos jogadores.
- **Notificações fire-and-forget** — DM com fallback para menção no canal em todos os eventos do ciclo de vida do duelo (criação, aceitação, resultado, confirmação, rejeição, expiração). Nunca bloqueiam o fluxo principal.
- **Graceful shutdown** — `SIGTERM`/`SIGINT` desconectam o client Discord e o Prisma antes de encerrar o processo.
- **Embed único editado in-place** — Cada duelo tem um embed persistente que é atualizado via `channelId` + `messageId`. Botões mudam dinamicamente conforme o estado.
- **Auto-discovery de handlers** — Barrel files (`index.ts`) exportam mapas `Record<string, handler>`. O roteador em `interactionCreate.ts` faz lookup direto sem `switch/case`.
- **Jobs com setTimeout recursivo** — Evita execução concorrente (ao contrário de `setInterval`). Cada ciclo agenda o próximo só após terminar.
- **Retry com backoff exponencial** — `withRetry` genérico (1s → 2s → 4s) aplicado nos jobs de expiração e season. Falha final é logada e o próximo ciclo tenta novamente.
- **Cooldown in-memory** — Map genérico key-based para rate limiting. Usado no `/duel` (30s) e nos botões (5s). Aceita perda no restart.
- **Job health check** — Registro in-memory do último ciclo bem-sucedido por job. Log de warning se gap entre ciclos excede 2x o intervalo esperado.
- **Reconcile de embeds no startup** — `reconcileStaleEmbeds()` limpa botões de duelos terminais das últimas 24h ao iniciar, evitando embeds desatualizados.
- **Logging estruturado** — JSON com timestamp, level e context. Sem dependência externa.

---

## Configuração

Constantes configuráveis em `src/config.ts`:

| Constante | Valor | Descrição |
|---|---|---|
| `SEASON_DURATION_DAYS` | 30 | Duração de uma season em dias |
| `DUEL_EXPIRY_MS` | 30 min | Tempo para aceitar antes de expirar |
| `EXPIRY_WARNING_MS` | 10 min | Tempo antes da expiração para enviar aviso |
| `EXPIRE_CHECK_INTERVAL_MS` | 1 min | Intervalo do job de expiração |
| `SEASON_CHECK_INTERVAL_MS` | 5 min | Intervalo do job de verificação de season |
| `RANK_PAGE_SIZE` | 20 | Jogadores por página no ranking |
| `DUEL_COOLDOWN_MS` | 30 seg | Cooldown entre criações de duelo por usuário |
| `BUTTON_COOLDOWN_MS` | 5 seg | Debounce em botões de ação |
| `NOTIFICATION_COOLDOWN_MS` | 5 min | Cooldown de notificação por usuário por evento |
| `SEASON_ENDING_WARNING_MS` | 24h | Tempo antes do fim da season para enviar aviso |
| `POINTS_WIN` | +1 | Pontos por vitória |
| `POINTS_LOSS` | -1 | Pontos por derrota |

---

## Roadmap

Veja [`docs/ROADMAP.md`](docs/ROADMAP.md) para próximos passos e decisões de produto.

---

## Licenca

Uso privado — Nin Online.
