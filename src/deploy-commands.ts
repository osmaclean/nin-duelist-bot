import { REST, Routes, SlashCommandBuilder } from 'discord.js';
import { DISCORD_TOKEN, DISCORD_CLIENT_ID, DISCORD_GUILD_ID } from './config';

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
    .addStringOption((o) =>
      o
        .setName('mode')
        .setDescription('Modo do duelo')
        .setRequired(true)
        .addChoices({ name: 'Ranked', value: 'RANKED' }, { name: 'Casual', value: 'CASUAL' }),
    )
    .addUserOption((o) => o.setName('witness').setDescription('Testemunha (obrigatória em ranked)'))
    .toJSON(),

  new SlashCommandBuilder()
    .setName('rank')
    .setDescription('Ver ranking da season atual')
    .addIntegerOption((o) => o.setName('page').setDescription('Página').setMinValue(1))
    .toJSON(),

  new SlashCommandBuilder().setName('mvp').setDescription('Top 5 jogadores da season').toJSON(),
];

async function main() {
  const rest = new REST().setToken(DISCORD_TOKEN);

  console.log('Registrando slash commands...');

  if (DISCORD_GUILD_ID) {
    await rest.put(Routes.applicationGuildCommands(DISCORD_CLIENT_ID, DISCORD_GUILD_ID), { body: commands });
    console.log(`Commands registrados na guild ${DISCORD_GUILD_ID}`);
  } else {
    await rest.put(Routes.applicationCommands(DISCORD_CLIENT_ID), { body: commands });
    console.log('Commands registrados globalmente');
  }
}

main().catch(console.error);
