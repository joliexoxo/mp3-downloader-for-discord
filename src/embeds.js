import { EmbedBuilder } from 'discord.js';

const COLORS = {
  LOADING: 0x2b2d31,
  SUCCESS: 0xffffff,
  ERROR: 0xe74c3c,
  STATS: 0x2b2d31
};

export function createLoadingEmbed() {
  return new EmbedBuilder()
    .setColor(COLORS.LOADING)
    .setTitle('Downloading...')
    .setDescription(
      [
        '**Status**',
        '- Fetching audio stream...',
      ].join('\n')
    )
    .setTimestamp()
    .setFooter({ text: 'Music Downloader' });
}

export function createSuccessEmbed(interaction, musicInfo) {
  return new EmbedBuilder()
    .setAuthor({
      name: interaction.user.username,
      iconURL: interaction.user.displayAvatarURL()
    })
    .setColor(COLORS.SUCCESS)
    .setTitle(musicInfo.title)
    .setURL(musicInfo.url || null)
    .setDescription(
      [
        '**Track Info**',
        `- Artist: \`${musicInfo.artist || 'Unknown'}\``,
        `- Duration: \`${musicInfo.duration || 'N/A'}\``,
        `- Size: \`${musicInfo.fileSize || 'N/A'}\``,
        '',
        '**Source**',
        `- Platform: \`${musicInfo.source || 'Unknown'}\``,
      ].join('\n')
    )
    .setImage(musicInfo.thumbnail || null)
    .setFooter({ text: 'Music Downloader' })
    .setTimestamp();
}

export function createErrorEmbed(interaction, errorMessage) {
  return new EmbedBuilder()
    .setAuthor({
      name: interaction.user.username,
      iconURL: interaction.user.displayAvatarURL()
    })
    .setColor(COLORS.ERROR)
    .setTitle('Download Failed')
    .setDescription(
      [
        '**Error**',
        `- \`${errorMessage}\``,
      ].join('\n')
    )
    .setTimestamp()
    .setFooter({ text: 'Music Downloader' });
}

export function createStatsEmbed(client, downloadCount, uptimeFormatted) {
  return new EmbedBuilder()
    .setColor(COLORS.STATS)
    .setTitle('Bot Statistics')
    .setDescription(
      [
        '**System Info**',
        `- Uptime: \`${uptimeFormatted}\``,
        `- Ping: \`${client.ws.ping}ms\``,
        `- Servers: \`${client.guilds.cache.size}\``,
        '',
        '**Usage**',
        `- Tracks Downloaded: \`${downloadCount}\``
      ].join('\n')
    )
    .setTimestamp()
    .setFooter({ text: 'Music Downloader' });
}
