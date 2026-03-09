import { ChatInputCommandInteraction, EmbedBuilder, Colors } from 'discord.js';

export async function handleHelpCommand(interaction: ChatInputCommandInteraction) {
  const embed = new EmbedBuilder()
    .setTitle('NinDuelist — Guia Rápido')
    .setColor(Colors.Blurple)
    .setDescription(
      'Sistema de duelos ranqueados do **Nin Online** com temporadas, testemunhas obrigatórias e anti-farm.',
    )
    .addFields(
      {
        name: '⚔️ Como funciona um duelo',
        value: [
          '1. `/duel @oponente formato @testemunha` — Crie o desafio',
          '2. O oponente aceita clicando no botão',
          '3. Após a luta, um dos duelistas reporta o resultado',
          '4. A testemunha valida o placar — pontos são aplicados!',
        ].join('\n'),
      },
      {
        name: '🎮 Duelos',
        value: '`/duel` — Desafiar jogador\n`/pending` — Duelos aguardando sua ação',
        inline: true,
      },
      {
        name: '🏆 Rankings',
        value: '`/rank` — Leaderboard\n`/mvp` — Top 3\n`/profile` — Perfil\n`/h2h` — Confronto direto',
        inline: true,
      },
      {
        name: '📊 Estatísticas',
        value: '`/history` — Histórico\n`/activity` — Mais ativos\n`/records` — Recordes',
        inline: true,
      },
      {
        name: '📅 Temporada & Config',
        value: '`/season` — Status da temporada atual\n`/settings` — Ativar/desativar notificações por DM',
        inline: true,
      },
      {
        name: '📌 Regras importantes',
        value: [
          '• **Testemunha obrigatória** em todo duelo',
          '• **+1 pt** por vitória, **-1 pt** por derrota',
          '• Máximo **1 duelo confirmado** por dupla por dia',
          '• Duelos expiram em **30 minutos** se não aceitos',
        ].join('\n'),
      },
      {
        name: '🔗 Documentação completa',
        value: '[ninduelist.vercel.app](https://ninduelist.vercel.app/)',
      },
    );

  await interaction.reply({ embeds: [embed], ephemeral: true });
}
