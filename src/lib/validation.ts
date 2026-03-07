import { DuelFormat } from '@prisma/client';

/**
 * Sanitize user-provided text to prevent Discord embed injection.
 * Strips @everyone/@here mentions, limits length, and trims whitespace.
 */
export function sanitizeText(input: string, maxLength: number = 500): string {
  return input
    .replace(/@(everyone|here)/gi, '@\u200b$1')
    .trim()
    .slice(0, maxLength);
}

/**
 * Validates that a score is correct for the given duel format.
 * MD1: only 1-0
 * MD3: only 2-0 or 2-1
 */
export function validateScore(format: DuelFormat, scoreWinner: number, scoreLoser: number): boolean {
  if (!Number.isInteger(scoreWinner) || !Number.isInteger(scoreLoser)) return false;
  if (scoreWinner < 0 || scoreLoser < 0) return false;

  if (format === 'MD1') {
    return scoreWinner === 1 && scoreLoser === 0;
  }

  if (format === 'MD3') {
    return (scoreWinner === 2 && scoreLoser === 0) || (scoreWinner === 2 && scoreLoser === 1);
  }

  return false;
}
