import { EmbedBuilder } from 'discord.js';
import { publicDownloadError } from './downloader/DownloadErrors.js';

const COLORS = {
  LOADING: 0x2b2d31,
  SUCCESS: 0xffffff,
  ERROR: 0xe74c3c,
  STATS: 0x2b2d31
};

export function createLoadingEmbed(format = 'mp3', track = null) {
  const embed = new EmbedBuilder()
    .setColor(COLORS.LOADING)
    .setTitle(`Grabbing your ${format.toUpperCase()}...`)
    .setDescription(
      [
        '**Status**',
        '- Downloading and converting your track. Hang tight!',
      ].join('\n')
    )
    .setTimestamp()
    .setFooter({ text: 'Music Downloader' });
  if (track) {
    embed.setTitle(track.title.slice(0, 256)).setURL(track.url)
      .setImage(track.thumbnail || null)
      .setDescription(`Grabbing your ${format.toUpperCase()}... Hang tight!`);
  }
  return embed;
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
        `- Format: \`${musicInfo.filename?.split('.').pop()?.toUpperCase() || 'N/A'}\``,
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
    .setTitle("Couldn't grab that track")
    .setDescription(
      [
        '**Error**',
        publicDownloadError(errorMessage),
      ].join('\n')
    )
    .setTimestamp()
    .setFooter({ text: 'Music Downloader' });
}

export function createStatsEmbed(client, downloadCount, uptimeFormatted) {
  return new EmbedBuilder()
    .setColor(COLORS.STATS)
    .setTitle('Bot stats')
    .setDescription(
      [
        '**System**',
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
