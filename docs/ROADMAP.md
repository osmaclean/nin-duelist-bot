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

### 11.6 — Backup do banco de dados (Prioridade: Alta)
- [ ] **Status atual: SEM BACKUP.** Supabase Free Plan nao inclui backups.
- [ ] Criar script de `pg_dump` agendado (diario) para exportar o banco
- [ ] Configurar destino do dump (ex: S3, Google Drive, ou storage gratuito)
- [ ] Automatizar execucao (cron job, GitHub Action agendada, ou similar)
- [ ] Testar restore a partir do dump para garantir que funciona
- [ ] Documentar processo de backup e restore no README ou doc separada
- [ ] Alternativa futura: upgrade para Supabase Pro ($25/mes) se o projeto justificar

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
