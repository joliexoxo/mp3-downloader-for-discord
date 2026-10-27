import { EmbedBuilder, MessageFlags, escapeMarkdown } from 'discord.js';
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
    text: `Page ${history.page}/${history.pages} · ${history.total} downloads · Use /history page:2 to switch pages`
  });
}

export async function showHistory(interaction, repository) {
  await interaction.deferReply({ flags: MessageFlags.Ephemeral });
  const page = interaction.options.getInteger('page') ?? 1;
  const history = repository.getHistory(interaction.user.id, page);
  await interaction.editReply({ embeds: [createHistoryEmbed(history)] });
}
