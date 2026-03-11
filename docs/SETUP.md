# NinDuelist — Setup

Guia completo para configurar o ambiente de desenvolvimento e deploy.

---

## Pre-requisitos

- **Node.js 20** ou superior
- **PostgreSQL** (recomendado: Supabase)
- **Aplicacao Discord** criada no [Developer Portal](https://discord.com/developers/applications)
- **Git**

---

## 1. Clonar e instalar

```bash
git clone <repo-url>
cd nin-duelist-bot
npm install
```

---

## 2. Configurar variaveis de ambiente

```bash
cp .env.example .env
```

Preencha as variaveis conforme a tabela abaixo. O bot valida todas as obrigatorias no startup e falha com mensagem clara se alguma estiver faltando.

### Variaveis de ambiente

| Variavel | Obrigatoria | Descricao |
|----------|-------------|-----------|
| `DISCORD_TOKEN` | Sim | Token do bot Discord |
| `DISCORD_CLIENT_ID` | Sim | Application ID do bot |
| `DISCORD_GUILD_ID` | Producao | ID do servidor Discord (restringe commands a uma guild). Obrigatorio em producao, opcional em dev |
| `DATABASE_URL` | Sim | Connection string PostgreSQL |
| `ADMIN_ROLE_IDS` | Nao | IDs de cargos admin separados por virgula |
| `OPS_WEBHOOK_URL` | Nao | Webhook Discord para alertas de ops (canal privado) |
| `HEALTH_PORT` | Nao | Porta do health server HTTP (padrao: 8080) |

### Constantes (`src/config.ts`)

Valores fixos no codigo. Nao sao configurados via env var.

| Constante | Valor | Descricao |
|-----------|-------|-----------|
| `SEASON_DURATION_DAYS` | 30 | Duracao de uma season em dias |
| `DUEL_EXPIRY_MS` | 30 min | Tempo para aceitar antes de expirar |
| `EXPIRY_WARNING_MS` | 10 min | Tempo antes da expiracao para enviar aviso |
| `EXPIRE_CHECK_INTERVAL_MS` | 1 min | Intervalo do job de expiracao |
| `SEASON_CHECK_INTERVAL_MS` | 5 min | Intervalo do job de verificacao de season |
| `RANK_PAGE_SIZE` | 20 | Jogadores por pagina no ranking |
| `HISTORY_PAGE_SIZE` | 10 | Duelos por pagina no historico |
| `DUEL_COOLDOWN_MS` | 30 seg | Cooldown entre criacoes de duelo por usuario |
| `BUTTON_COOLDOWN_MS` | 5 seg | Debounce em botoes de acao |
| `NOTIFICATION_COOLDOWN_MS` | 5 min | Cooldown de notificacao por usuario por evento |
| `SEASON_ENDING_WARNING_MS` | 24h | Tempo antes do fim da season para enviar aviso |
| `POINTS_WIN` | +1 | Pontos por vitoria |
| `POINTS_LOSS` | -1 | Pontos por derrota |

---

## 3. Banco de dados

### Desenvolvimento local

```bash
npm run generate   # Gera o client Prisma
npm run migrate    # Aplica migrations
```

### Supabase com PgBouncer

Rode o schema completo no SQL Editor do Supabase (uma unica vez):

1. `prisma/migration.sql` — schema completo e atualizado (todas as tabelas, constraints e indices)

---

## 4. Registrar slash commands

```bash
npm run deploy-commands
```

Se `DISCORD_GUILD_ID` estiver definido, registra na guild (instantaneo). Senao, registra globalmente (pode levar ate 1h para propagar).

---

## 5. Rodar

```bash
# Desenvolvimento
npm run dev

# Producao
npm run build
npm start
```

---

## 6. Docker

```bash
docker build -t ninduelist .
docker run --env-file .env ninduelist
```

Dockerfile multi-stage: build com `node:20-alpine` (compila TypeScript + gera Prisma Client), runtime com `node:20-alpine` (apenas deps de producao). Imagem final ~172 MB.

---

## 7. Testes

```bash
# Rodar todos os testes
npm test

# Modo watch
npm run test:watch
```

56 arquivos de teste, 407 testes. Co-localizados com o codigo fonte (`*.test.ts`), usando mocks do Vitest. Nenhuma dependencia de banco real nos testes.

### Lint e formatacao

```bash
# Lint (ESLint com typescript-eslint)
npm run lint
npm run lint:fix

# Formatacao (Prettier)
npm run format
npm run format:check
```

---

## 8. Deploy (Fly.io)

O deploy em producao e automatico via GitHub Actions. Ao fazer merge de um PR na `main`:

1. CI roda (lint + typecheck + testes com cobertura)
2. Se CI passa, workflow `deploy.yml` dispara automaticamente
3. Fly.io faz o build remoto e substitui o container

### Secrets de producao

Secrets sao gerenciados exclusivamente via `fly secrets set`. Nunca no codigo, nunca no `fly.toml`.

### Deploy manual (emergencia)

```bash
fly deploy --remote-only
```

### Logs e monitoramento

```bash
fly logs              # Logs em tempo real
fly status            # Estado das machines
fly releases          # Historico de releases (rollback)
```
