import { logger } from './logger';
import { OPS_WEBHOOK_URL } from '../config';

/**
 * Envia alerta para canal privado de ops via Discord webhook.
 * Fire-and-forget — nunca lança exceção.
 */
export async function sendOpsAlert(
  title: string,
  message: string,
  level: 'warn' | 'error' = 'error',
): Promise<void> {
  if (!OPS_WEBHOOK_URL) return;

  try {
    const color = level === 'error' ? 0xff0000 : 0xffa500;
    await fetch(OPS_WEBHOOK_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        embeds: [
          {
            title,
            description: message,
            color,
            timestamp: new Date().toISOString(),
          },
        ],
      }),
    });
  } catch (error) {
    logger.error('Falha ao enviar alerta ops', { error: String(error) });
  }
}
