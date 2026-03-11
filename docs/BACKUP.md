# NinDuelist — Backup e Restore

Backup diário automatizado do banco de dados PostgreSQL (Supabase).

---

## Como funciona

- **Workflow:** `.github/workflows/backup.yml`
- **Frequência:** Diário às 03:00 UTC (00:00 BRT)
- **Trigger manual:** Disponível via GitHub Actions → "Run workflow"
- **Processo:** `pg_dump` → `gzip` → criptografia AES-256 → GitHub Artifact
- **Retenção:** 90 dias (rotação automática pelo GitHub)
- **Segurança:** Backup criptografado com `openssl aes-256-cbc` (repo é público)

---

## Secrets necessários no GitHub

| Secret | Descrição |
|--------|-----------|
| `DATABASE_URL_BACKUP` | Connection string do Supabase (mesma usada em produção). Usar a conexão **direta** (porta 5432), não a do PgBouncer (porta 6543) |
| `BACKUP_PASSPHRASE` | Passphrase para criptografia/descriptografia do dump. Escolha uma senha forte e guarde em local seguro |

### Configurar os secrets

```
GitHub → Settings → Secrets and variables → Actions → New repository secret
```

---

## Restore

### 1. Baixar o backup

Vá em **GitHub → Actions → Backup → Run mais recente** e baixe o artifact.

Ou via CLI:

```bash
# Listar workflow runs
gh run list --workflow=backup.yml

# Baixar artifact de um run específico
gh run download <RUN_ID>
```

### 2. Descriptografar e descompactar

```bash
openssl enc -aes-256-cbc -d -salt -pbkdf2 \
  -pass pass:"SUA_PASSPHRASE" \
  -in ninduelist_YYYYMMDD_HHMMSS.sql.gz.enc \
  | gunzip > restore.sql
```

### 3. Aplicar no banco

```bash
# Restore no banco local
psql "$DATABASE_URL" < restore.sql

# Ou direto no Supabase (conexão direta, não PgBouncer)
psql "postgresql://postgres:SENHA@HOST:5432/postgres" < restore.sql
```

---

## Verificação

Para verificar que o backup está funcionando:

1. Acesse **GitHub → Actions → Backup**
2. Verifique se o último run foi bem-sucedido (badge verde)
3. O tamanho do arquivo aparece nos logs do step "Run pg_dump"

### Teste de restore (recomendado periodicamente)

```bash
# Criar banco local temporário para teste
createdb ninduelist_test_restore

# Restore no banco de teste
psql "postgresql://localhost:5432/ninduelist_test_restore" < restore.sql

# Verificar dados
psql "postgresql://localhost:5432/ninduelist_test_restore" -c "SELECT count(*) FROM \"Duel\";"

# Limpar
dropdb ninduelist_test_restore
```

---

## Notas

- O `pg_dump` usa `--clean --if-exists` para que o restore possa ser aplicado em banco existente (dropa e recria)
- `--no-owner --no-privileges` evita problemas de permissão entre ambientes diferentes
- O backup é do **schema completo + dados** (não é incremental)
- Se o banco crescer significativamente, considerar upgrade para Supabase Pro ($25/mês) que inclui backups nativos
