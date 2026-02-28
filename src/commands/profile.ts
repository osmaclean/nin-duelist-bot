import { ChatInputCommandInteraction, EmbedBuilder, Colors } from 'discord.js';
import { getActiveSeason } from '../services/season.service';
import { getPlayerProfile } from '../services/profile.service';

export async function handleProfileCommand(interaction: ChatInputCommandInteraction) {
  await interaction.deferReply({ ephemeral: true });

  const season = await getActiveSeason();
  if (!season) {
    await interaction.editReply('Nenhuma season ativa no momento.');
    return;
  }

  const targetUser = interaction.options.getUser('player') ?? interaction.user;
  const profile = await getPlayerProfile(targetUser.id, season.id);

  if (!profile) {
    await interaction.editReply(`<@${targetUser.id}> não tem perfil nesta season.`);
    return;
  }

  const total = profile.wins + profile.losses;
  const rankDisplay = profile.rank ? `#${profile.rank}` : '-';
  const medal = profile.rank && profile.rank <= 3
    ? ['\u{1F947}', '\u{1F948}', '\u{1F949}'][profile.rank - 1]
    : '';

  const embed = new EmbedBuilder()
    .setTitle(`${medal} Perfil — ${targetUser.username}`.trim())
    .setColor(Colors.Blue)
    .setThumbnail(targetUser.displayAvatarURL())
    .addFields(
      { name: 'Ranking', value: rankDisplay, inline: true },
      { name: 'Pontos', value: `${profile.points}`, inline: true },
      { name: 'Duelos', value: `${total}`, inline: true },
      { name: 'V/D', value: `${profile.wins}V ${profile.losses}D`, inline: true },
      { name: 'Win Rate', value: `${profile.winRate}%`, inline: true },
      { name: '\u200b', value: '\u200b', inline: true },
      { name: 'Streak Atual', value: `${profile.streak}`, inline: true },
      { name: 'Peak Streak', value: `${profile.peakStreak}`, inline: true },
      { name: 'Seasons', value: `${profile.seasonsPlayed}`, inline: true },
    )
    .setFooter({ text: `Season ${season.number}` });

  await interaction.editReply({ embeds: [embed] });
}
