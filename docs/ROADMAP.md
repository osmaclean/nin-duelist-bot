# NinDuelist — Roadmap

Ideias futuras e possiveis melhorias. Nenhuma tem compromisso de prazo.

Para o historico completo de todas as fases implementadas (1-8), veja [`HISTORY.md`](HISTORY.md).

---

## Possiveis melhorias

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
