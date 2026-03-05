import 'dotenv/config';

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Variável de ambiente obrigatória não definida: ${name}`);
  }
  return value;
}

export const DISCORD_TOKEN = requireEnv('DISCORD_TOKEN');
export const DISCORD_CLIENT_ID = requireEnv('DISCORD_CLIENT_ID');
export const DISCORD_GUILD_ID: string | undefined = process.env.DISCORD_GUILD_ID;

// Validação eager — Prisma lê DATABASE_URL direto do env, mas queremos falhar rápido
requireEnv('DATABASE_URL');

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

/** Tempo antes da expiração para enviar aviso (ms) */
export const EXPIRY_WARNING_MS = 10 * 60 * 1000; // 10 minutos antes de expirar

/** Cooldown para criação de duelo por usuário (ms) */
export const DUEL_COOLDOWN_MS = 30 * 1000; // 30 segundos

/** Cooldown para botões de ação por usuário (ms) */
export const BUTTON_COOLDOWN_MS = 5 * 1000; // 5 segundos

/** Cooldown de notificação por usuário por tipo de evento (ms) */
export const NOTIFICATION_COOLDOWN_MS = 5 * 60 * 1000; // 5 minutos

/** Tempo antes do fim da season para enviar aviso (ms) */
export const SEASON_ENDING_WARNING_MS = 24 * 60 * 60 * 1000; // 24 horas

/** Pontos por vitória/derrota (ranked) */
export const POINTS_WIN = 1;
export const POINTS_LOSS = -1;

/** IDs de cargos com permissão admin (separados por vírgula no env) */
export const ADMIN_ROLE_IDS: string[] = (process.env.ADMIN_ROLE_IDS ?? '')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean);
