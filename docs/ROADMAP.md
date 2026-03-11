# NinDuelist — Roadmap

Ideias futuras e possiveis melhorias. Nenhuma tem compromisso de prazo.

Para o historico completo de todas as fases implementadas (1-10), veja [`HISTORY.md`](HISTORY.md).

---

## Fase 11 — Saude tecnica e dividas

Correcoes de integridade, limpeza de codigo e higiene tecnica identificadas na revisao arquitetural.

### 11.1 — Fix: reverseResult fora de transacao no admin reopen (Prioridade: Alta) ✅
- [x] Envolver `reverseResult` + `reopenDuel` numa unica `$transaction` em `admin.ts`
- [x] Hoje se o reverse funciona mas o reopen falha, os pontos sao revertidos mas o duelo continua CONFIRMED — stats inconsistentes
- [x] Atualizar testes do admin reopen para cobrir cenario transacional

### 11.2 — Unificar closeSeason e adminEndSeason (Prioridade: Media) ✅
- [x] Extrair logica duplicada para uma unica funcao `closeSeason(seasonId, trigger: 'auto' | 'admin')`
- [x] Remover `adminEndSeason` do service
- [x] Atualizar chamadas em `admin.ts` e `season-check.ts`
- [x] Atualizar testes de season.service

### 11.3 — Cooldown cleanup periodico (Prioridade: Baixa) ✅
- [x] Adicionar funcao `cleanupExpiredEntries()` que remove entradas com mais de 1h
- [x] Iniciar cleanup periodico (ex: a cada 10 min) no startup do bot
- [x] Atualizar testes de cooldown
- [x] Previne crescimento ilimitado do Map em memoria

### 11.4 — Proteger jobs contra execucao sobreposta (Prioridade: Baixa) ✅
- [x] Jobs `expire-duels` e `season-check` usam `setTimeout` recursivo sem trava
- [x] Se um ciclo demorar mais que o intervalo, dois ciclos podem rodar simultaneamente
- [x] Adicionar flag `isRunning` ou usar `setTimeout` somente apos o ciclo anterior finalizar
- [x] Atualizar testes dos jobs

### 11.5 — Substituir casting `as TextChannel` por type guard (Prioridade: Baixa) ✅
- [x] Casting `as TextChannel` esta espalhado em `admin.ts`, `expire-duels.ts`, `notifications.ts`
- [x] Se o bot for usado em thread ou forum channel, pode falhar silenciosamente
- [x] Criar type guard ou helper `isTextChannel()` e usar nos pontos afetados
- [x] Atualizar testes relacionados

### 11.6 — Backup do banco de dados (Prioridade: Alta) ✅
- [x] **Status anterior: SEM BACKUP.** Supabase Free Plan nao inclui backups.
- [x] Criar workflow GitHub Actions com `pg_dump` agendado (diario, 03:00 UTC)
- [x] Destino: GitHub Artifacts com retencao de 90 dias
- [x] Criptografia AES-256 (repo publico — backup protegido por passphrase)
- [x] Documentar processo de backup e restore em `docs/BACKUP.md`
- [x] Trigger manual disponivel via `workflow_dispatch`
- [x] Alternativa futura: upgrade para Supabase Pro ($25/mes) se o projeto justificar

---

## Fase 12 — Correcao do fluxo de duelos (CRITICO)

Fluxo de duelos esta quebrado em producao. Botoes aparecem para as pessoas erradas, permissoes ausentes em handlers criticos, admin cancel falha em AWAITING_VALIDATION. Testado manualmente e confirmado.

**Contexto importante:** Discord nao permite botoes diferentes por usuario no mesmo embed. Botoes ficam visiveis para todos, mas os handlers devem rejeitar com mensagem clara quem nao tem permissao.

### 12.1 — Fix: admin cancel nao funciona em AWAITING_VALIDATION (Prioridade: Critica) ✅
- [x] Bug: `cancelDuel()` so aceita PROPOSED/ACCEPTED/IN_PROGRESS
- [x] Admin check passa (nao e terminal), mas `transitionDuel` falha porque AWAITING_VALIDATION nao esta na lista
- [x] Resultado: "Erro ao cancelar duelo #N" sem explicacao
- [x] Fix: adicionar AWAITING_VALIDATION na lista de status canceaveis do `cancelDuel()`
- [x] Atualizar testes

### 12.2 — Permissoes nos handlers de resultado (Prioridade: Critica) ✅
- [x] `pick-winner.ts` nao verifica quem clicou — qualquer usuario pode submeter resultado
- [x] `submit-score.ts` (modal) nao verifica quem submeteu
- [x] Adicionar check: apenas a testemunha pode reportar resultado (novo fluxo)
- [x] Rejeitar com mensagem ephemeral clara: "Apenas a testemunha pode reportar o resultado"
- [x] Atualizar testes

### 12.3 — Novo fluxo: testemunha reporta resultado (Prioridade: Alta) ✅
- [x] Hoje: qualquer jogador clica "Enviar Resultado" e escolhe vencedor/placar
- [x] Novo: apenas a testemunha reporta o resultado — jogadores so jogam
- [x] `submit-result.ts`: rejeitar se nao for a testemunha
- [x] Mensagem de rejeicao para jogadores: "Apenas a testemunha pode reportar o resultado do duelo."
- [x] `notifyDuelStarted()`: notifica testemunha que deve reportar + jogadores que devem aguardar
- [x] `start-duel.ts`: chama `notifyDuelStarted` apos transicao para IN_PROGRESS
- [x] Atualizar testes

### 12.4 — Restringir botao cancelar por status e papel (Prioridade: Alta) ✅
- [x] PROPOSED: challenger e oponente podem cancelar
- [x] ACCEPTED: challenger e oponente podem cancelar
- [x] IN_PROGRESS: apenas testemunha pode cancelar (jogadores nao podem mais)
- [x] AWAITING_VALIDATION: apenas testemunha pode cancelar
- [x] Adicionar checks no handler `cancel-duel.ts`
- [x] Mensagem de rejeicao por fase: "Apenas os duelistas podem cancelar nesta fase" / "Apenas a testemunha pode cancelar duelos em andamento"
- [x] Atualizar testes

### 12.5 — Botoes corretos por status no embed (Prioridade: Alta) ✅
- [x] PROPOSED: "Aceitar Duelo" + "Cancelar" (handler ja valida quem clica)
- [x] ACCEPTED: "Iniciar Duelo" + "Cancelar" (handler ja valida)
- [x] IN_PROGRESS: "Reportar Resultado" + "Cancelar" (handler restringe a testemunha)
- [x] AWAITING_VALIDATION: "Confirmar Resultado" + "Rejeitar Resultado" + "Cancelar" (handler restringe a testemunha)
- [x] CONFIRMED/CANCELLED/EXPIRED: nenhum botao (ja funciona)
- [x] Revisar `buildDuelComponents()` para garantir botoes corretos por status
- [x] Atualizar testes de components

### 12.6 — Notificacoes DM ajustadas ao novo fluxo (Prioridade: Media) ✅
- [x] IN_PROGRESS: notificar testemunha que ela deve reportar o resultado (feito em 12.3)
- [x] IN_PROGRESS: notificar jogadores que devem aguardar a testemunha (feito em 12.3)
- [x] AWAITING_VALIDATION: notificar jogadores que resultado foi reportado e esta em validacao
- [x] Corrigir mensagem de resultado rejeitado (referencia testemunha, nao duelistas)
- [x] Corrigir mensagem de admin reopen (referencia testemunha, nao duelistas)
- [x] Garantir que cada transicao de status notifica as partes corretas
- [x] Atualizar testes de notifications

### 12.7 — Mensagens de rejeicao claras em todos os handlers (Prioridade: Media) ✅
- [x] Cada handler que rejeita um clique deve explicar POR QUE
- [x] Mensagem de cancelamento diferenciada: IN_PROGRESS vs AWAITING_VALIDATION
- [x] Padronizar mensagens de erro ephemeral em todos os handlers
- [x] Atualizar testes

---

## Possiveis melhorias futuras

### Experiencia do jogador
- Dashboard web com estatisticas e historico visual
- Leaderboard global cross-season (hall of fame)
- Conquistas / badges (ex: "10 vitorias seguidas", "100 duelos")
- Perfil com avatar customizado e titulo

### Competicao
- Sistema de clans/equipes
- Duelos em equipe (2v2, 3v3)
- Torneios com chaveamento automatico
- Seasons tematicas com regras especiais

### Integracao
- Integracao com API do Nin Online (verificar se jogadores existem no jogo)
- Webhook de eventos para sistemas externos
- Bot commands em ingles (i18n)

### Tecnico
- Rate limiting persistente (Redis) se escala crescer
- Metricas com Prometheus/Grafana se necessario
- Notificacoes com outbox pattern se volume justificar
- Multi-guild support (bot em varios servidores com dados separados)

---

## Como decidimos o que implementar

1. **Dor real** — O problema ja aconteceu ou esta atrapalhando jogadores?
2. **Escala justifica** — A complexidade compensa para < 200 jogadores?
3. **Custo de manutencao** — Quanto codigo novo e quanto teste adicional?

Se a resposta for "nao" para qualquer um, a ideia fica aqui como referencia futura.
