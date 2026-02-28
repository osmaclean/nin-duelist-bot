import { PrismaClient } from '@prisma/client';

export const prisma = new PrismaClient();

export type TxClient = Omit<PrismaClient, '$connect' | '$disconnect' | '$on' | '$transaction' | '$use' | '$extends'>;
