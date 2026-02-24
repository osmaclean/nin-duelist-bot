import 'dotenv/config';

export const DISCORD_TOKEN = process.env.DISCORD_TOKEN!;
export const DISCORD_CLIENT_ID = process.env.DISCORD_CLIENT_ID!;
export const DISCORD_GUILD_ID = process.env.DISCORD_GUILD_ID!;

/** Duração de uma season em dias */
export const SEASON_DURATION_DAYS = 30;

/** Tempo máximo (ms) para aceitar um duelo antes de expirar */
export const DUEL_EXPIRY_MS = 30 * 60 * 1000; // 30 minutos

/** Intervalo do job de expiração (ms) */
export const EXPIRE_CHECK_INTERVAL_MS = 60 * 1000; // 1 minuto

/** Intervalo do job de season (ms) */
export const SEASON_CHECK_INTERVAL_MS = 5 * 60 * 1000; // 5 minutos

/** Itens por página no ranking */
export const RANK_PAGE_SIZE = 20;

/** Pontos por vitória/derrota (ranked) */
export const POINTS_WIN = 1;
export const POINTS_LOSS = -1;
