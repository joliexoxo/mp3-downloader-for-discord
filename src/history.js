import { EmbedBuilder, MessageFlags, escapeMarkdown, ActionRowBuilder, ButtonBuilder, ButtonStyle } from 'discord.js';
import { HISTORY_PAGE_SIZE } from './database/StatsRepository.js';

export function createHistoryEmbed(history) {
  const embed = new EmbedBuilder().setColor(0x2b2d31).setTitle('Your download history');
  if (history.total === 0) {
    return embed.setDescription("No downloads yet. Grab your first track with `/download`.")
      .setFooter({ text: 'Music Downloader' });
  }
  for (const [index, track] of history.tracks.entries()) {
    let link = '';
    try {
      const url = new URL(track.url);
      if (['http:', 'https:'].includes(url.protocol) && url.href.length <= 512) {
        link = `\n[Track link](<${url.href.replaceAll('>', '%3E')}>)`;
      }
    } catch { /* Older entries may not have a source URL. */ }
    embed.addFields({
      name: `${(history.page - 1) * HISTORY_PAGE_SIZE + index + 1}. ${track.title.slice(0, 120)}`,
      value: `${escapeMarkdown(track.artist.slice(0, 120))} · ${track.format.toUpperCase()}\n<t:${track.downloaded_at}:f>${link}`
    });
  }
  return embed.setFooter({
    text: `Page ${history.page}/${history.pages} · ${history.total} downloads`
  });
}

export function createHistoryComponents(userId, history) {
  return [new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId(`history:${userId}:${Math.max(1, history.page - 1)}`)
      .setLabel('Previous').setStyle(ButtonStyle.Secondary).setDisabled(history.page <= 1),
    new ButtonBuilder().setCustomId(`history:${userId}:${history.page + 1}`)
      .setLabel('Next').setStyle(ButtonStyle.Secondary).setDisabled(history.page >= history.pages)
  )];
}

function historyReply(repository, userId, page) {
  const history = repository.getHistory(userId, page);
  return { embeds: [createHistoryEmbed(history)], components: createHistoryComponents(userId, history) };
}

export async function showHistory(interaction, repository) {
  await interaction.deferReply({ flags: MessageFlags.Ephemeral });
  await interaction.editReply(historyReply(repository, interaction.user.id, 1));
}

export async function navigateHistory(interaction, repository) {
  const match = /^history:([^:]+):([1-9]\d{0,14})$/.exec(interaction.customId);
  if (!match || !Number.isSafeInteger(Number(match[2]))) {
    await interaction.reply({ content: 'Run `/history` to open your downloads again.', flags: MessageFlags.Ephemeral });
    return;
  }
  if (match[1] !== interaction.user.id) {
    await interaction.reply({ content: "This isn't your history. Run `/history` to see yours.", flags: MessageFlags.Ephemeral });
    return;
  }
  await interaction.deferUpdate();
  await interaction.editReply(historyReply(repository, interaction.user.id, Number(match[2])));
}
