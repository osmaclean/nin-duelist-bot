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

Testes co-localizados com o código fonte (`*.test.ts`), usando mocks do Vitest. Nenhuma dependência de banco real nos testes.

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

#### `/admin cancel duel_id reason`

Cancela um duelo forçadamente (apenas para cargos admin).

**Parâmetros:**
| Parâmetro | Tipo | Descrição |
|---|---|---|
| `duel_id` | Inteiro | ID do duelo a cancelar |
| `reason` | Texto | Motivo do cancelamento |

**Requisitos:**
- Usuário deve possuir um dos cargos listados em `ADMIN_ROLE_IDS`
- Duelo não pode estar em estado terminal (`CONFIRMED`, `CANCELLED`, `EXPIRED`)
- Ação é logada com ID do admin, motivo e status anterior

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

Exibe os 5 melhores jogadores da season atual.

Mesmo formato do ranking, mas limitado ao top 5 e destacando o **Peak Streak** (maior sequência de vitórias).

---

### Fluxo Completo de um Duelo

Um duelo passa por 5 fases. Tudo acontece dentro de um único embed que é atualizado in-place no Discord:

#### Fase 1 — Proposta (`PROPOSED`)

```
Jogador A usa /duel @JogadorB MD1 @Testemunha
```

O bot posta um embed amarelo com:
- Informações do duelo (desafiante, oponente, formato, testemunha)
- Status de aceitação: `Oponente: Pendente` / `Testemunha: Pendente`
- Botões: **Aceitar Duelo** (oponente) | **Aceitar (Testemunha)** | **Cancelar**

Tanto o oponente quanto a testemunha precisam aceitar independentemente. Se ninguém aceitar em **30 minutos**, o duelo expira automaticamente.

---

#### Fase 2 — Aceito (`ACCEPTED`)

Quando ambos aceitam, o embed fica azul:
- Botões: **Iniciar Duelo** | **Cancelar**
- Qualquer um dos duelistas (desafiante ou oponente) pode iniciar

---

#### Fase 3 — Em Andamento (`IN_PROGRESS`)

Após iniciar, o embed fica laranja:
- Botões: **Enviar Resultado** | **Cancelar**
- Qualquer duelista pode enviar o resultado

Ao clicar em **Enviar Resultado**, abre um modal do Discord com 3 campos:
1. **Quem venceu?** — ID Discord ou @menção do vencedor
2. **Pontos do vencedor** — MD1: `1` | MD3: `2`
3. **Pontos do perdedor** — MD1: `0` | MD3: `0` ou `1`

Placares válidos:
| Formato | Placares aceitos |
|---|---|
| MD1 | 1-0 |
| MD3 | 2-0, 2-1 |

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

## Arquitetura

```
src/
├── commands/          # Slash commands (/duel, /rank, /mvp, /pending, /history, /profile, /admin)
│   └── index.ts       # Barrel — mapa command → handler
├── buttons/           # Button handlers (aceitar, iniciar, cancelar, etc.)
│   ├── handler.ts     # HOF que elimina boilerplate dos handlers
│   └── index.ts       # Barrel — mapa action → handler
├── modals/            # Modal handlers (submit-score)
│   └── index.ts       # Barrel — mapa action → handler
├── services/          # Logica de negocio (duel, player, ranking, season, antifarm, pending, history, profile)
├── lib/               # Utilitarios (embeds, components, logger, prisma, pagination, notifications)
├── events/            # Event handlers Discord (ready, interactionCreate)
├── jobs/              # Background jobs (expire-duels, season-check)
├── config.ts          # Constantes e validação de env vars
├── index.ts           # Bootstrap do client Discord + graceful shutdown
└── deploy-commands.ts # Script de registro de slash commands
```

### Decisões Arquiteturais

- **Optimistic locking** — Todas as transições de estado usam `updateMany` com filtro de status. Se o status ja mudou (race condition), retorna null e mostra erro amigável.
- **Transação atômica na confirmação** — `confirmAndApplyResult` encapsula `confirmResult` + `applyResult` dentro de `prisma.$transaction()` no service layer, garantindo consistência entre status do duelo e stats dos jogadores.
- **Notificação fire-and-forget** — DM para testemunha ao receber resultado, com fallback para menção no canal. Nunca bloqueia o fluxo principal.
- **Graceful shutdown** — `SIGTERM`/`SIGINT` desconectam o client Discord e o Prisma antes de encerrar o processo.
- **Embed único editado in-place** — Cada duelo tem um embed persistente que é atualizado via `channelId` + `messageId`. Botões mudam dinamicamente conforme o estado.
- **Auto-discovery de handlers** — Barrel files (`index.ts`) exportam mapas `Record<string, handler>`. O roteador em `interactionCreate.ts` faz lookup direto sem `switch/case`.
- **Jobs com setTimeout recursivo** — Evita execução concorrente (ao contrário de `setInterval`). Cada ciclo agenda o próximo só após terminar.
- **Logging estruturado** — JSON com timestamp, level e context. Sem dependência externa.

---

## Configuração

Constantes configuráveis em `src/config.ts`:

| Constante | Valor | Descrição |
|---|---|---|
| `SEASON_DURATION_DAYS` | 30 | Duração de uma season em dias |
| `DUEL_EXPIRY_MS` | 30 min | Tempo para aceitar antes de expirar |
| `EXPIRE_CHECK_INTERVAL_MS` | 1 min | Intervalo do job de expiração |
| `SEASON_CHECK_INTERVAL_MS` | 5 min | Intervalo do job de verificação de season |
| `RANK_PAGE_SIZE` | 20 | Jogadores por página no ranking |
| `POINTS_WIN` | +1 | Pontos por vitória |
| `POINTS_LOSS` | -1 | Pontos por derrota |

---

## Licenca

Uso privado — Nin Online.
