-- =============================================
-- NinDuelist — Migration SQL para Supabase
-- Rodar no SQL Editor do Supabase (uma única vez)
-- =============================================

-- 1. Enums
CREATE TYPE "DuelStatus" AS ENUM (
  'PROPOSED',
  'ACCEPTED',
  'IN_PROGRESS',
  'RESULT_SUBMITTED',
  'AWAITING_VALIDATION',
  'CONFIRMED',
  'CANCELLED',
  'EXPIRED'
);

CREATE TYPE "DuelMode" AS ENUM ('RANKED', 'CASUAL');

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
  "mode" "DuelMode" NOT NULL,
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
