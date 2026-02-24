import { prisma } from '../lib/prisma';
import { DUEL_EXPIRY_MS, EXPIRE_CHECK_INTERVAL_MS } from '../config';

export function startExpireDuelsJob() {
  setInterval(async () => {
    try {
      const cutoff = new Date(Date.now() - DUEL_EXPIRY_MS);

      const result = await prisma.duel.updateMany({
        where: {
          status: 'PROPOSED',
          createdAt: { lt: cutoff },
        },
        data: { status: 'EXPIRED' },
      });

      if (result.count > 0) {
        console.log(`Expirados ${result.count} duelo(s) por timeout.`);
      }
    } catch (error) {
      console.error('Erro no job expire-duels:', error);
    }
  }, EXPIRE_CHECK_INTERVAL_MS);

  console.log('Job expire-duels iniciado.');
}
