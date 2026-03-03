-- =============================================
-- NinDuelist — Migration SQL para Supabase
-- Rodar no SQL Editor do Supabase (uma única vez)
-- =============================================

-- 1. Enums
CREATE TYPE "DuelStatus" AS ENUM (
  'PROPOSED',
  'ACCEPTED',
  'IN_PROGRESS',
  'AWAITING_VALIDATION',
  'CONFIRMED',
  'CANCELLED',
  'EXPIRED'
);

CREATE TYPE "DuelFormat" AS ENUM ('MD1', 'MD3');

-- 2. Tabela Player
CREATE TABLE "Player" (
  "id" SERIAL PRIMARY KEY,
  "discordId" TEXT NOT NULL,
  "username" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Player_discordId_key" UNIQUE ("discordId")
);

-- 3. Tabela Season
CREATE TABLE "Season" (
  "id" SERIAL PRIMARY KEY,
  "number" INTEGER NOT NULL,
  "startDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "endDate" TIMESTAMP(3) NOT NULL,
  "active" BOOLEAN NOT NULL DEFAULT true,
  "championId" INTEGER,
  CONSTRAINT "Season_number_key" UNIQUE ("number"),
  CONSTRAINT "Season_championId_fkey" FOREIGN KEY ("championId") REFERENCES "Player"("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- 4. Tabela PlayerSeason
CREATE TABLE "PlayerSeason" (
  "id" SERIAL PRIMARY KEY,
  "playerId" INTEGER NOT NULL,
  "seasonId" INTEGER NOT NULL,
  "points" INTEGER NOT NULL DEFAULT 0,
  "wins" INTEGER NOT NULL DEFAULT 0,
  "losses" INTEGER NOT NULL DEFAULT 0,
  "streak" INTEGER NOT NULL DEFAULT 0,
  "peakStreak" INTEGER NOT NULL DEFAULT 0,
  CONSTRAINT "PlayerSeason_playerId_seasonId_key" UNIQUE ("playerId", "seasonId"),
  CONSTRAINT "PlayerSeason_playerId_fkey" FOREIGN KEY ("playerId") REFERENCES "Player"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "PlayerSeason_seasonId_fkey" FOREIGN KEY ("seasonId") REFERENCES "Season"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- 5. Tabela Duel
CREATE TABLE "Duel" (
  "id" SERIAL PRIMARY KEY,
  "status" "DuelStatus" NOT NULL DEFAULT 'PROPOSED',
  "format" "DuelFormat" NOT NULL,
  "challengerId" INTEGER NOT NULL,
  "opponentId" INTEGER NOT NULL,
  "witnessId" INTEGER,
  "seasonId" INTEGER NOT NULL,
  "winnerId" INTEGER,
  "scoreWinner" INTEGER,
  "scoreLoser" INTEGER,
  "opponentAccepted" BOOLEAN NOT NULL DEFAULT false,
  "witnessAccepted" BOOLEAN NOT NULL DEFAULT false,
  "channelId" TEXT,
  "messageId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Duel_challengerId_fkey" FOREIGN KEY ("challengerId") REFERENCES "Player"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "Duel_opponentId_fkey" FOREIGN KEY ("opponentId") REFERENCES "Player"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "Duel_witnessId_fkey" FOREIGN KEY ("witnessId") REFERENCES "Player"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT "Duel_seasonId_fkey" FOREIGN KEY ("seasonId") REFERENCES "Season"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "Duel_winnerId_fkey" FOREIGN KEY ("winnerId") REFERENCES "Player"("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- 6. Tabela de controle do Prisma Migrate (para o Prisma reconhecer que o schema já existe)
CREATE TABLE IF NOT EXISTS "_prisma_migrations" (
  "id" VARCHAR(36) PRIMARY KEY,
  "checksum" VARCHAR(64) NOT NULL,
  "finished_at" TIMESTAMP WITH TIME ZONE,
  "migration_name" VARCHAR(255) NOT NULL,
  "logs" TEXT,
  "rolled_back_at" TIMESTAMP WITH TIME ZONE,
  "started_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  "applied_steps_count" INTEGER NOT NULL DEFAULT 0
);

-- Registrar esta migration para o Prisma não tentar rodar novamente
INSERT INTO "_prisma_migrations" ("id", "checksum", "migration_name", "finished_at", "applied_steps_count")
VALUES (
  gen_random_uuid()::text,
  'manual_migration',
  '20260224_init',
  now(),
  1
);

-- =============================================
-- Migration incremental: remover DuelMode e RESULT_SUBMITTED
-- Rodar no SQL Editor do Supabase (se o banco já existe)
-- =============================================

-- 1. Remover coluna "mode" da tabela Duel
ALTER TABLE "Duel" DROP COLUMN IF EXISTS "mode";

-- 2. Remover enum DuelMode
DROP TYPE IF EXISTS "DuelMode";

-- 3. Remover valor RESULT_SUBMITTED do enum DuelStatus
-- PostgreSQL não suporta ALTER TYPE ... DROP VALUE diretamente.
-- Estratégia: renomear enum antigo, criar novo, migrar coluna, dropar antigo.

-- Garante que nenhum registro usa RESULT_SUBMITTED antes de prosseguir
UPDATE "Duel" SET "status" = 'AWAITING_VALIDATION' WHERE "status" = 'RESULT_SUBMITTED';

ALTER TYPE "DuelStatus" RENAME TO "DuelStatus_old";

CREATE TYPE "DuelStatus" AS ENUM (
  'PROPOSED',
  'ACCEPTED',
  'IN_PROGRESS',
  'AWAITING_VALIDATION',
  'CONFIRMED',
  'CANCELLED',
  'EXPIRED'
);

ALTER TABLE "Duel"
  ALTER COLUMN "status" DROP DEFAULT,
  ALTER COLUMN "status" TYPE "DuelStatus" USING ("status"::text::"DuelStatus"),
  ALTER COLUMN "status" SET DEFAULT 'PROPOSED';

DROP TYPE "DuelStatus_old";

-- =============================================
-- Migration incremental: adicionar índices de performance
-- Rodar no SQL Editor do Supabase
-- =============================================

-- Índices para hasActiveDuel (status + challengerId/opponentId)
CREATE INDEX IF NOT EXISTS "Duel_status_challengerId_idx" ON "Duel"("status", "challengerId");
CREATE INDEX IF NOT EXISTS "Duel_status_opponentId_idx" ON "Duel"("status", "opponentId");

-- Índice para expire-duels job e canDuelToday (status + createdAt)
CREATE INDEX IF NOT EXISTS "Duel_status_createdAt_idx" ON "Duel"("status", "createdAt");

-- Índice para getLeaderboard (seasonId + ordering)
CREATE INDEX IF NOT EXISTS "PlayerSeason_leaderboard_idx" ON "PlayerSeason"("seasonId", "points" DESC, "wins" DESC, "peakStreak" DESC);

-- =============================================
-- Migration incremental: tornar channelId obrigatório
-- channelId sempre foi populado no createDuel, mas era nullable no schema.
-- Rodar no SQL Editor do Supabase
-- =============================================

-- Garantir que não há registros com channelId NULL (preencher com '0' se houver)
UPDATE "Duel" SET "channelId" = '0' WHERE "channelId" IS NULL;

ALTER TABLE "Duel" ALTER COLUMN "channelId" SET NOT NULL;

-- =============================================
-- Migration incremental: adicionar flag expiryWarned
-- Controla se aviso de expiração (10 min) já foi enviado.
-- Rodar no SQL Editor do Supabase
-- =============================================

ALTER TABLE "Duel" ADD COLUMN IF NOT EXISTS "expiryWarned" BOOLEAN NOT NULL DEFAULT false;
