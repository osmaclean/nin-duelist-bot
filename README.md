# NinDuelist

![CI](https://github.com/osmaclean/nin-duelist-bot/actions/workflows/ci.yml/badge.svg?branch=main)

Bot Discord para sistema de duelos ranqueados do **Nin Online**. Gerencia desafios entre jogadores com testemunha obrigatoria, seasons automaticas, ranking e anti-farm.

---

## O que e o NinDuelist

Bot Discord para gerenciar duelos ranqueados no Nin Online. Jogadores usam slash commands para desafiar oponentes. Cada duelo exige uma testemunha obrigatoria que valida o resultado. A pontuacao e simples: +1 ponto por vitoria, -1 por derrota. Os duelos acontecem dentro de um embed unico atualizado continuamente com botoes dinamicos.

Nao existe comando de registro. Jogadores sao cadastrados automaticamente na primeira vez que participam de um duelo (como desafiante, oponente ou testemunha). O username do Discord e mantido atualizado a cada interacao.

---

## Features

### Core

| Feature | Descricao |
|---------|-----------|
| **Desafios 1v1** | Duelos no formato MD1 (Melhor de 1) ou MD3 (Melhor de 3) com testemunha obrigatoria |
| **Pontuacao** | +1 ponto por vitoria, -1 por derrota. Streak atual e peak streak rastreados |
| **Seasons automaticas** | Temporadas de 30 dias com criacao e fechamento automaticos. Campeao definido pelo ranking |
| **Testemunha obrigatoria** | Terceiro jogador que valida o resultado. Pode confirmar ou rejeitar com um clique |
| **Anti-farm** | Mesmo par de jogadores so pode ter 1 duelo confirmado por dia (UTC) |
| **Embed unico** | Cada duelo tem um embed persistente atualizado dinamicamente com botoes conforme o estado |

### Consulta e estatisticas

| Feature | Descricao |
|---------|-----------|
| **Ranking** | Ranking paginado com 20 jogadores por pagina |
| **Perfil** | Posicao no ranking, pontos, vitorias, derrotas, win rate, streaks, seasons jogadas |
| **Historico** | Duelos confirmados paginados com filtros (oponente, datas) |
| **Head-to-head** | Confronto direto entre dois jogadores na season atual |
| **Atividade** | Top 10 jogadores mais ativos por total de duelos |
| **Recordes** | Maior streak, melhor win rate (minimo 5 jogos), mais duelos |
| **MVP** | Top 3 jogadores da season com destaque para Peak Streak |
| **Season** | Status da season atual com top 3 parcial |

### Admin

| Feature | Descricao |
|---------|-----------|
| **Cancelar duelos** | Cancelamento forcado com motivo e notificacao |
| **Reabrir duelos** | Reabre duelo terminal para IN_PROGRESS (reverte stats se CONFIRMED) |
| **Forcar expiracao** | Expira duelo nao-terminal |
| **Corrigir resultado** | Corrige resultado com recalculo atomico de pontos |
| **Reparar season** | Recalcula stats de PlayerSeason a partir dos duelos confirmados |
| **Audit log** | Historico persistente de todas as acoes admin |
| **Busca** | Buscar duelos por jogador ou por status |
| **Gestao de season** | Criar, encerrar e consultar seasons |
| **Visibilidade** | Comandos admin ocultos para quem nao e admin |

### Notificacoes

DMs automaticas em eventos do ciclo de vida do duelo. Se a DM falhar ou o jogador tiver desativado DMs via `/settings`, faz fallback com mencao no canal do duelo. Notificacoes nunca bloqueiam o fluxo principal.

**Anti-spam:** Cooldown de 5 minutos por usuario por tipo de evento.

**Opt-out:** Jogadores podem desativar DMs com `/settings notifications off`.

| Evento | Quem recebe |
|--------|-------------|
| Duelo criado | Oponente + testemunha |
| Oponente aceitou (ACCEPTED) | Ambos duelistas |
| Resultado enviado | Testemunha |
| Resultado confirmado | Ambos duelistas |
| Resultado rejeitado | Ambos duelistas |
| Duelo expirando (10 min restantes) | Oponente + testemunha |
| Duelo expirado | Todos (3 participantes) |
| Admin cancelou duelo | Ambos duelistas |
| Admin reabriu duelo | Ambos duelistas |
| Admin forcou expiracao | Ambos duelistas |
| Admin corrigiu resultado | Ambos duelistas |
| Season encerrando (24h) | Todos os jogadores ativos da season |

---

## Comandos

### Comandos de usuario

#### `/duel @oponente formato @testemunha`

Desafia um jogador para um duelo ranqueado.

| Parametro | Tipo | Descricao |
|-----------|------|-----------|
| `opponent` | Usuario (obrigatorio) | Quem voce quer desafiar |
| `format` | Escolha (obrigatorio) | `MD1 (Melhor de 1)` ou `MD3 (Melhor de 3)` |
| `witness` | Usuario (obrigatorio) | Testemunha obrigatoria |

**Validacoes:**
- Deve existir uma season ativa
- Nao pode duelar contra si mesmo
- Oponente e testemunha nao podem ser bots
- Testemunha nao pode ser um dos duelistas
- Nenhum dos duelistas pode ter outro duelo ativo
- O mesmo par nao pode ter mais de 1 duelo confirmado no dia

**Resultado:** O bot posta um embed com o status do duelo e botoes de acao.

---

#### `/rank [page]`

Exibe o ranking da season atual com 20 jogadores por pagina.

| Parametro | Tipo | Descricao |
|-----------|------|-----------|
| `page` | Inteiro (opcional) | Pagina do ranking (padrao: 1) |

**Exibicao:**
```
1. @jogador1 — 15pts | 12V 3D | Streak: 4 (max 7)
2. @jogador2 — 10pts | 8V 2D | Streak: 2 (max 5)
3. @jogador3 — 8pts | 7V 1D | Streak: 1 (max 3)
4. @jogador4 — 5pts | 5V 0D | Streak: 5 (max 5)
```

Botoes **Anterior** / **Proxima** para navegar entre paginas.

---

#### `/mvp`

Exibe os 3 melhores jogadores da season atual com destaque para Peak Streak.

---

#### `/pending [limit]`

Mostra duelos que precisam de acao sua. Resposta ephemeral (so voce ve).

| Parametro | Tipo | Descricao |
|-----------|------|-----------|
| `limit` | Inteiro (opcional) | Maximo de duelos a exibir (1-50) |

**Exibicao:**
- Duelos ordenados por urgencia:
  1. Perto de expirar
  2. Aguardando sua validacao (testemunha)
  3. Aguardando sua aceitacao
  4. Prontos para iniciar
  5. Em andamento
- Para cada duelo: `#id`, adversario, status, tempo restante (quando aplicavel)

---

#### `/history [@jogador] [vs] [from] [to] [page]`

Exibe historico de duelos e estatisticas na season atual, com filtros opcionais e paginacao.

| Parametro | Tipo | Descricao |
|-----------|------|-----------|
| `player` | Usuario (opcional) | Jogador para consultar (padrao: voce) |
| `vs` | Usuario (opcional) | Filtrar duelos contra este oponente |
| `from` | Texto (opcional) | Data inicial no formato `YYYY-MM-DD` |
| `to` | Texto (opcional) | Data final no formato `YYYY-MM-DD` |
| `page` | Inteiro (opcional) | Pagina do historico (10 duelos por pagina) |

**Exibicao:**
- Estatisticas: pontos, vitorias, derrotas, win rate, streak atual, melhor streak
- Duelos confirmados paginados (10 por pagina): resultado (V/D), placar, data, oponente
- Filtros ativos exibidos no embed
- Botoes **Anterior** / **Proxima** para navegar entre paginas

---

#### `/profile [@jogador]`

Exibe o perfil compacto de um jogador com ranking.

| Parametro | Tipo | Descricao |
|-----------|------|-----------|
| `player` | Usuario (opcional) | Jogador para consultar (padrao: voce) |

**Exibicao:**
- Posicao no ranking (com medalha para top 3)
- Pontos, vitorias, derrotas, win rate
- Streak atual e melhor streak
- Numero de seasons jogadas

---

#### `/h2h @player_a @player_b`

Exibe o confronto direto entre dois jogadores na season atual.

| Parametro | Tipo | Descricao |
|-----------|------|-----------|
| `player_a` | Usuario (obrigatorio) | Primeiro jogador |
| `player_b` | Usuario (obrigatorio) | Segundo jogador |

**Exibicao:**
- Total de duelos entre eles, vitorias e win rate de cada lado
- Ultimos 10 duelos do confronto com placar

---

#### `/activity`

Exibe os 10 jogadores mais ativos da season atual (por total de duelos jogados). Medalhas para top 3.

---

#### `/records`

Exibe os recordes da season atual:
- **Maior Streak** — Jogador com maior sequencia de vitorias consecutivas
- **Melhor Win Rate** — Jogador com maior taxa de vitoria (minimo 5 jogos)
- **Mais Duelos** — Jogador com mais duelos jogados

---

#### `/season`

Exibe o status da season atual. Resposta ephemeral.

**Exibicao:**
- Nome e numero da season, datas de inicio/termino, dias restantes
- Total de duelos e jogadores ativos
- Top 3 parcial com pontos e V/D

---

#### `/settings notifications on|off`

Configura suas preferencias de notificacao.

| Parametro | Tipo | Descricao |
|-----------|------|-----------|
| `notifications` | Escolha (obrigatorio) | `Ativar DMs` ou `Desativar DMs` |

- `on`: Voce recebe notificacoes por DM (padrao)
- `off`: DMs desativadas. Notificacoes sao enviadas como mencao no canal do duelo

---

### Comandos admin

Todos os comandos admin requerem cargo de administrador. Todas as acoes sao registradas no audit log persistente. O embed original do duelo e atualizado automaticamente quando possivel.

Comandos admin sao **ocultos** para quem nao tem permissao de Administrador no Discord.

---

#### `/admin cancel duel_id reason`

Cancela um duelo forcadamente. Nao pode ser usado em duelos terminais (`CONFIRMED`, `CANCELLED`, `EXPIRED`).

| Parametro | Tipo | Descricao |
|-----------|------|-----------|
| `duel_id` | Inteiro (obrigatorio) | ID do duelo a cancelar |
| `reason` | Texto (obrigatorio) | Motivo do cancelamento |

---

#### `/admin reopen duel_id reason`

Reabre um duelo em estado terminal para `IN_PROGRESS`. Se o duelo estava `CONFIRMED`, reverte pontos/wins/losses dos jogadores. Limpa resultado ao reabrir.

| Parametro | Tipo | Descricao |
|-----------|------|-----------|
| `duel_id` | Inteiro (obrigatorio) | ID do duelo a reabrir |
| `reason` | Texto (obrigatorio) | Motivo da reabertura |

---

#### `/admin force-expire duel_id reason`

Forca a expiracao de um duelo nao-terminal.

| Parametro | Tipo | Descricao |
|-----------|------|-----------|
| `duel_id` | Inteiro (obrigatorio) | ID do duelo a expirar |
| `reason` | Texto (obrigatorio) | Motivo da expiracao forcada |

---

#### `/admin fix-result duel_id winner score reason`

Corrige o resultado de um duelo ja confirmado. Reverte os pontos do resultado antigo e aplica os novos atomicamente. O duelo permanece em `CONFIRMED`.

| Parametro | Tipo | Descricao |
|-----------|------|-----------|
| `duel_id` | Inteiro (obrigatorio) | ID do duelo a corrigir |
| `winner` | Usuario (obrigatorio) | Novo vencedor (deve ser participante do duelo) |
| `score` | Texto (obrigatorio) | Novo placar no formato `W-L` (ex: `2-1`) |
| `reason` | Texto (obrigatorio) | Motivo da correcao |

---

#### `/admin logs duel_id`

Exibe o historico de acoes admin em um duelo.

| Parametro | Tipo | Descricao |
|-----------|------|-----------|
| `duel_id` | Inteiro (obrigatorio) | ID do duelo |

**Exibicao:** Data, acao, transicao de status, admin responsavel e motivo.

---

#### `/admin season status`

Exibe informacoes da season ativa: numero, nome, datas, dias restantes, total de duelos, jogadores ativos.

---

#### `/admin season end`

Encerra a season ativa manualmente. Cancela duelos nao-finalizados, calcula podio (top 3), define campeao, envia embed publico.

---

#### `/admin season create [name] [duration]`

Cria uma nova season. Nao pode haver outra season ativa.

| Parametro | Tipo | Descricao |
|-----------|------|-----------|
| `name` | Texto (opcional) | Nome da season |
| `duration` | Inteiro (opcional) | Duracao em dias (padrao: 30, max: 365) |

---

#### `/admin season repair season_id`

Recalcula todos os stats de PlayerSeason (pontos, V/D, streak, peakStreak) a partir dos duelos confirmados. Uso: recuperacao de dados apos inconsistencia.

| Parametro | Tipo | Descricao |
|-----------|------|-----------|
| `season_id` | Inteiro (obrigatorio) | ID da season a reparar |

---

#### `/admin search player @player`

Busca os ultimos 15 duelos de um jogador (como desafiante, oponente ou testemunha).

| Parametro | Tipo | Descricao |
|-----------|------|-----------|
| `player` | Usuario (obrigatorio) | Jogador para buscar |

---

#### `/admin search status STATUS`

Busca os ultimos 15 duelos em um status especifico.

| Parametro | Tipo | Descricao |
|-----------|------|-----------|
| `status` | Escolha (obrigatorio) | PROPOSED, ACCEPTED, IN_PROGRESS, AWAITING_VALIDATION, CONFIRMED, CANCELLED, EXPIRED |

---

## Fluxo do Duelo

Um duelo passa por 5 fases. Tudo acontece dentro de um unico embed que e atualizado in-place no Discord.

### Fase 1 — Proposta (`PROPOSED`)

```
Jogador A usa /duel @JogadorB MD1 @Testemunha
```

O bot posta um embed amarelo com:
- Informacoes do duelo (desafiante, oponente, formato, testemunha)
- Status de aceitacao: `Oponente: Pendente`
- Botoes: **Aceitar Duelo** (oponente) | **Cancelar**

O oponente precisa aceitar para o duelo iniciar. A testemunha nao precisa aceitar — ela so participa na validacao do resultado. Se o oponente nao aceitar em **30 minutos**, o duelo expira automaticamente. Um aviso e enviado quando faltam **10 minutos**.

### Fase 2 — Aceito (`ACCEPTED`)

Quando o oponente aceita, o embed fica azul:
- Botoes: **Iniciar Duelo** | **Cancelar**
- Qualquer um dos duelistas pode iniciar

### Fase 3 — Em Andamento (`IN_PROGRESS`)

Apos iniciar, o embed fica laranja:
- Botoes: **Enviar Resultado** | **Cancelar**
- Qualquer duelista pode enviar o resultado

Ao clicar em **Enviar Resultado**, o bot mostra uma mensagem efemera com 2 botoes: os nomes dos jogadores. Clique em quem venceu.

- **MD1:** O resultado e enviado automaticamente (1-0), sem necessidade de digitar placar.
- **MD3:** Abre um modal pedindo apenas o placar (pontos do vencedor e perdedor). Placares validos: 2-0 ou 2-1.

### Fase 4 — Aguardando Validacao (`AWAITING_VALIDATION`)

Apos enviar o resultado, o embed fica roxo:
- Mostra o placar enviado
- Botoes: **Confirmar Resultado** | **Rejeitar Resultado**
- **Somente a testemunha** pode interagir

**Se a testemunha confirma:** O duelo e finalizado atomicamente — status, pontos e streak dos dois jogadores sao atualizados numa unica transacao.

**Se a testemunha rejeita:** O duelo volta para `IN_PROGRESS` e o resultado e apagado. Os duelistas podem enviar um novo resultado.

### Fase 5 — Confirmado (`CONFIRMED`)

Embed fica verde, sem botoes:
- Mostra o placar final: `@vencedor venceu 2-1`
- Footer: `Duelo #N`

**Pontuacao aplicada:**

| | Vencedor | Perdedor |
|---|----------|----------|
| Pontos | +1 | -1 |
| Vitorias/Derrotas | +1 vitoria | +1 derrota |
| Streak | +1 (acumula) | Reset para 0 |
| Peak Streak | `MAX(atual, streak)` | Mantem |

### Cancelamento

Qualquer participante (desafiante, oponente ou testemunha) pode cancelar o duelo nas fases `PROPOSED`, `ACCEPTED` ou `IN_PROGRESS`. Nenhuma pontuacao e aplicada.

### Diagrama de Estados

```
                    +--------------------------------------+
                    |                                      |
                    v                                      |
PROPOSED --> ACCEPTED --> IN_PROGRESS --> AWAITING_VALIDATION --> CONFIRMED
    |            |              |                |
    |            |              |                |
    |            +--------------+                |
    |                   |              (rejeicao volta
    |                   |               para IN_PROGRESS)
    |                   v
    |              CANCELLED
    |
    v
  EXPIRED
  (30 min sem aceitar)
```

---

## Seasons

As seasons sao gerenciadas automaticamente:

1. **Criacao** — Na primeira inicializacao do bot ou quando nao existe season ativa, uma nova e criada (Season 1, 2, 3...) com duracao de 30 dias.
2. **Fechamento** — A cada 5 minutos, o bot verifica se a season ativa expirou. Se sim:
   - Todos os duelos nao-finalizados sao cancelados
   - O jogador com mais pontos e registrado como campeao
   - A season e desativada
   - Uma nova season comeca imediatamente
3. **Ranking** — Cada jogador tem stats independentes por season. Nova season = placar zerado para todos.
4. **Aviso** — 24 horas antes do encerramento, todos os jogadores ativos recebem notificacao.

---

## Anti-Farm

Para evitar abuso de pontuacao: **o mesmo par de jogadores so pode ter 1 duelo confirmado por dia (UTC)**. Se Jogador A e Jogador B ja tiveram um duelo confirmado hoje, qualquer novo desafio entre eles (em qualquer direcao) sera bloqueado. Reset a 00:00 UTC.

---

## Documentacao

| Documento | Descricao |
|-----------|-----------|
| [Setup](docs/SETUP.md) | Guia de instalacao, configuracao e deploy |
| [Arquitetura](docs/ARCHITECTURE.md) | Stack, estrutura, decisoes tecnicas, CI/CD, hardening |
| [Historico](docs/HISTORY.md) | Registro completo das fases de desenvolvimento |
| [Roadmap](docs/ROADMAP.md) | Ideias futuras e possiveis melhorias |

---

## Acesso

Bot de uso privado para servidores do **Nin Online**. Para solicitar acesso ao bot no seu servidor, entre em contato por e-mail:

**contatolucasmaclean@gmail.com**

---

## Licenca

Uso privado — Nin Online.
