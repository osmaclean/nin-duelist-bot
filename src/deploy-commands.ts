import { REST, Routes, SlashCommandBuilder, PermissionFlagsBits } from 'discord.js';
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

  new SlashCommandBuilder().setName('mvp').setDescription('Top 3 jogadores da season').toJSON(),

  new SlashCommandBuilder()
    .setName('pending')
    .setDescription('Ver duelos pendentes de acao sua')
    .addIntegerOption((o) => o.setName('limit').setDescription('Maximo de duelos a exibir').setMinValue(1).setMaxValue(50))
    .toJSON(),

  new SlashCommandBuilder()
    .setName('history')
    .setDescription('Ver historico de duelos na season atual')
    .addUserOption((o) => o.setName('player').setDescription('Jogador (padrao: voce)'))
    .addUserOption((o) => o.setName('vs').setDescription('Filtrar duelos contra este jogador'))
    .addStringOption((o) => o.setName('from').setDescription('Data inicial (YYYY-MM-DD)'))
    .addStringOption((o) => o.setName('to').setDescription('Data final (YYYY-MM-DD)'))
    .addIntegerOption((o) => o.setName('page').setDescription('Pagina').setMinValue(1))
    .toJSON(),

  new SlashCommandBuilder()
    .setName('profile')
    .setDescription('Ver perfil de um jogador')
    .addUserOption((o) => o.setName('player').setDescription('Jogador (padrão: você)'))
    .toJSON(),

  new SlashCommandBuilder()
    .setName('h2h')
    .setDescription('Ver confronto direto entre dois jogadores')
    .addUserOption((o) => o.setName('player_a').setDescription('Primeiro jogador').setRequired(true))
    .addUserOption((o) => o.setName('player_b').setDescription('Segundo jogador').setRequired(true))
    .toJSON(),

  new SlashCommandBuilder().setName('activity').setDescription('Top 10 jogadores mais ativos da season').toJSON(),

  new SlashCommandBuilder().setName('records').setDescription('Recordes da season atual').toJSON(),

  new SlashCommandBuilder().setName('season').setDescription('Status da season atual').toJSON(),

  new SlashCommandBuilder()
    .setName('settings')
    .setDescription('Configurar preferências pessoais')
    .addStringOption((o) =>
      o
        .setName('notifications')
        .setDescription('Ativar ou desativar notificações por DM')
        .setRequired(true)
        .addChoices({ name: 'Ativar DMs', value: 'on' }, { name: 'Desativar DMs', value: 'off' }),
    )
    .toJSON(),

  new SlashCommandBuilder()
    .setName('admin')
    .setDescription('Comandos administrativos')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addSubcommand((sub) =>
      sub
        .setName('cancel')
        .setDescription('Cancelar um duelo forçadamente')
        .addIntegerOption((o) => o.setName('duel_id').setDescription('ID do duelo').setRequired(true))
        .addStringOption((o) => o.setName('reason').setDescription('Motivo do cancelamento').setRequired(true)),
    )
    .addSubcommand((sub) =>
      sub
        .setName('reopen')
        .setDescription('Reabrir um duelo terminal para IN_PROGRESS')
        .addIntegerOption((o) => o.setName('duel_id').setDescription('ID do duelo').setRequired(true))
        .addStringOption((o) => o.setName('reason').setDescription('Motivo da reabertura').setRequired(true)),
    )
    .addSubcommand((sub) =>
      sub
        .setName('force-expire')
        .setDescription('Forçar expiração de um duelo')
        .addIntegerOption((o) => o.setName('duel_id').setDescription('ID do duelo').setRequired(true))
        .addStringOption((o) => o.setName('reason').setDescription('Motivo da expiração').setRequired(true)),
    )
    .addSubcommand((sub) =>
      sub
        .setName('fix-result')
        .setDescription('Corrigir resultado de um duelo confirmado')
        .addIntegerOption((o) => o.setName('duel_id').setDescription('ID do duelo').setRequired(true))
        .addUserOption((o) => o.setName('winner').setDescription('Novo vencedor').setRequired(true))
        .addStringOption((o) => o.setName('score').setDescription('Placar (ex: 2-1)').setRequired(true))
        .addStringOption((o) => o.setName('reason').setDescription('Motivo da correção').setRequired(true)),
    )
    .addSubcommand((sub) =>
      sub
        .setName('logs')
        .setDescription('Ver histórico de ações admin em um duelo')
        .addIntegerOption((o) => o.setName('duel_id').setDescription('ID do duelo').setRequired(true)),
    )
    .addSubcommandGroup((group) =>
      group
        .setName('season')
        .setDescription('Gestão de seasons')
        .addSubcommand((sub) => sub.setName('status').setDescription('Ver informações da season ativa'))
        .addSubcommand((sub) => sub.setName('end').setDescription('Encerrar a season ativa manualmente'))
        .addSubcommand((sub) =>
          sub
            .setName('create')
            .setDescription('Criar uma nova season')
            .addStringOption((o) => o.setName('name').setDescription('Nome da season (opcional)'))
            .addIntegerOption((o) =>
              o.setName('duration').setDescription('Duração em dias (padrão: 30)').setMinValue(1).setMaxValue(365),
            ),
        )
        .addSubcommand((sub) =>
          sub
            .setName('repair')
            .setDescription('Recalcular stats de uma season a partir dos duelos confirmados')
            .addIntegerOption((o) => o.setName('season_id').setDescription('ID da season').setRequired(true)),
        ),
    )
    .addSubcommandGroup((group) =>
      group
        .setName('search')
        .setDescription('Buscar duelos')
        .addSubcommand((sub) =>
          sub
            .setName('player')
            .setDescription('Listar duelos recentes de um jogador')
            .addUserOption((o) => o.setName('player').setDescription('Jogador para buscar').setRequired(true)),
        )
        .addSubcommand((sub) =>
          sub
            .setName('status')
            .setDescription('Listar duelos por status')
            .addStringOption((o) =>
              o
                .setName('status')
                .setDescription('Status do duelo')
                .setRequired(true)
                .addChoices(
                  { name: 'PROPOSED', value: 'PROPOSED' },
                  { name: 'ACCEPTED', value: 'ACCEPTED' },
                  { name: 'IN_PROGRESS', value: 'IN_PROGRESS' },
                  { name: 'AWAITING_VALIDATION', value: 'AWAITING_VALIDATION' },
                  { name: 'CONFIRMED', value: 'CONFIRMED' },
                  { name: 'CANCELLED', value: 'CANCELLED' },
                  { name: 'EXPIRED', value: 'EXPIRED' },
                ),
            ),
        ),
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
