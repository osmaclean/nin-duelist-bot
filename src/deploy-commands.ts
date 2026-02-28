import { REST, Routes, SlashCommandBuilder } from 'discord.js';
import { DISCORD_TOKEN, DISCORD_CLIENT_ID, DISCORD_GUILD_ID } from './config';
import { logger } from './lib/logger';

const commands = [
  new SlashCommandBuilder()
    .setName('duel')
    .setDescription('Desafiar alguém para um duelo')
    .addUserOption((o) => o.setName('opponent').setDescription('Oponente').setRequired(true))
    .addStringOption((o) =>
      o
        .setName('format')
        .setDescription('Formato do duelo')
        .setRequired(true)
        .addChoices({ name: 'MD1 (Melhor de 1)', value: 'MD1' }, { name: 'MD3 (Melhor de 3)', value: 'MD3' }),
    )
    .addUserOption((o) => o.setName('witness').setDescription('Testemunha (obrigatória)').setRequired(true))
    .toJSON(),

  new SlashCommandBuilder()
    .setName('rank')
    .setDescription('Ver ranking da season atual')
    .addIntegerOption((o) => o.setName('page').setDescription('Página').setMinValue(1))
    .toJSON(),

  new SlashCommandBuilder().setName('mvp').setDescription('Top 5 jogadores da season').toJSON(),

  new SlashCommandBuilder().setName('pending').setDescription('Ver duelos pendentes de ação sua').toJSON(),

  new SlashCommandBuilder()
    .setName('history')
    .setDescription('Ver histórico de duelos na season atual')
    .addUserOption((o) => o.setName('player').setDescription('Jogador (padrão: você)'))
    .toJSON(),

  new SlashCommandBuilder()
    .setName('profile')
    .setDescription('Ver perfil de um jogador')
    .addUserOption((o) => o.setName('player').setDescription('Jogador (padrão: você)'))
    .toJSON(),

  new SlashCommandBuilder()
    .setName('admin')
    .setDescription('Comandos administrativos')
    .addSubcommand((sub) =>
      sub
        .setName('cancel')
        .setDescription('Cancelar um duelo forçadamente')
        .addIntegerOption((o) => o.setName('duel_id').setDescription('ID do duelo').setRequired(true))
        .addStringOption((o) => o.setName('reason').setDescription('Motivo do cancelamento').setRequired(true)),
    )
    .toJSON(),
];

async function main() {
  const rest = new REST().setToken(DISCORD_TOKEN);

  logger.info('Registrando slash commands');

  if (DISCORD_GUILD_ID) {
    await rest.put(Routes.applicationGuildCommands(DISCORD_CLIENT_ID, DISCORD_GUILD_ID), { body: commands });
    logger.info('Commands registrados na guild', { guildId: DISCORD_GUILD_ID });
  } else {
    await rest.put(Routes.applicationCommands(DISCORD_CLIENT_ID), { body: commands });
    logger.info('Commands registrados globalmente');
  }
}

main().catch((err) => logger.error('Falha ao registrar commands', { error: String(err) }));
