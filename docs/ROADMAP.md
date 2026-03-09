# NinDuelist — Roadmap

Ideias futuras e possiveis melhorias. Nenhuma tem compromisso de prazo.

Para o historico completo de todas as fases implementadas (1-9), veja [`HISTORY.md`](HISTORY.md).

---

## Fase 9 — Migracao para Fly.io

Objetivo: migrar deploy do Railway para Fly.io com seguranca rigida e deploy automatico.

### 9.1 Setup local e criacao do app ✅

- Instalar `flyctl` CLI (v0.4.19)
- Autenticar com `fly auth login`
- Criar app com `fly apps create ninduelist` (regiao `gru` — Sao Paulo)
- Verificar que o app aparece no dashboard Fly.io

### 9.2 Configuracao do fly.toml ✅

- Criar `fly.toml` na raiz do projeto
- Health check via `internal_port` (8080) com endpoint `/health` existente
  - Tipo: `http`, intervalo 30s, timeout 5s, grace period 30s
- Recursos: `shared-cpu-1x`, 256MB RAM (free tier)
- Configurar `auto_stop_machines = false` (bot deve rodar 24/7, nao pode hibernar)
- Configurar `auto_start_machines = false` (sem wake-on-request — nao e HTTP app)
- Configurar `max_machines_running = 1` (bot Discord nao pode ter multiplas instancias)
- Build: usar Dockerfile existente (multi-stage Alpine)

### 9.3 Secrets (variaveis de ambiente) ✅

- Configurar via `fly secrets set` (nunca no fly.toml, nunca no repo):
  - `DISCORD_TOKEN` (obrigatorio)
  - `DISCORD_CLIENT_ID` (obrigatorio)
  - `DATABASE_URL` (obrigatorio — Supabase connection string)
  - `DISCORD_GUILD_ID` (restrito a guild especifica — acesso sob contato)
  - `ADMIN_ROLE_IDS` (configurado)
  - `OPS_WEBHOOK_URL` (configurado)
- 6 secrets staged e aplicados no deploy
- Nenhum secret exposto em logs ou config versionada
- `fly.toml` versionado no repo (nao contem secrets)

### 9.4 Deploy manual e validacao ✅

- `fly deploy --remote-only` executado com sucesso
- Imagem: 172 MB (multi-stage Alpine)
- Logs validados:
  - Health server iniciado na porta 8080
  - Bot online (`BOT Nin Duelist#0978`)
  - Season ativa encontrada (Season 1)
  - Jobs registrados (expire-duels, season-check)
  - Health check passando
- Machine duplicada destruida (Fly criou 2 por padrao, corrigido para 1)
- Comandos testados no Discord — bot respondendo via Fly.io

### 9.5 Deploy automatico via GitHub Actions ✅

- Workflow `.github/workflows/deploy.yml` criado (separado do CI)
- Trigger: `workflow_run` — dispara quando CI completa com sucesso na `main`
- Seguranca rigida:
  - `FLY_API_TOKEN` (escopo deploy-only, validade 1 ano) como secret do repositorio GitHub
  - Deploy so acontece apos CI verde (lint + typecheck + tests)
  - Action oficial `superfly/flyctl-actions/setup-flyctl@master`
  - Build remoto: `fly deploy --remote-only`
- PRs so rodam CI — deploy nunca acontece em PR ou dev
- Validado em producao: PR merged → CI passou → deploy disparou com sucesso

### 9.6 Descomissionar Railway ✅

- Projeto deletado do Railway (incidente ativo no momento da migracao)
- Bot validado no Fly.io: comandos respondendo no Discord
- README.md e HISTORY.md atualizados com referencias ao Fly.io

### Criterios de seguranca (nao-negociaveis)

- Nenhum secret no codigo fonte, fly.toml, logs ou output de CI
- `FLY_API_TOKEN` com escopo minimo (deploy only)
- Deploy so acontece apos CI verde (testes + lint + typecheck)
- Deploy so acontece na branch `main` (nunca em PR ou dev)
- Health check ativo — Fly.io reinicia o container se `/health` falhar
- Rollback disponivel via `fly releases` + `fly deploy --image`

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
