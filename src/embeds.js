import { EmbedBuilder } from 'discord.js';
import { publicDownloadError } from './downloader/DownloadErrors.js';
import { Formatter } from './utils/Formatter.js';

const COLORS = {
  LOADING: 0x2b2d31,
  SUCCESS: 0xffffff,
  ERROR: 0xe74c3c,
  STATS: 0x2b2d31
};

export function createMetadataEmbed(interaction, info) {
  const clean = value => String(value).replace(/[`\r\n]/g, ' ').slice(0, 140);
  const tags = info.tags;
  const lines = ['**Metadata**'];
  const labels = {
    title: 'Title', artist: 'Artist', album: 'Album', album_artist: 'Album artist',
    albumartist: 'Album artist', date: 'Date', year: 'Year', genre: 'Genre', track: 'Track',
    tracknumber: 'Track', disc: 'Disc', discnumber: 'Disc', composer: 'Composer',
    copyright: 'Copyright', comment: 'Comment', description: 'Description', encoder: 'Encoder',
    bpm: 'BPM', isrc: 'ISRC'
  };
  const seen = new Set();
  for (const [key, label] of Object.entries(labels)) {
    if (tags[key] && !seen.has(label)) {
      lines.push(`- ${label}: \`${clean(tags[key])}\``);
      seen.add(label);
    }
  }
  if (!seen.size) lines.push('- No embedded tags found.');
  lines.push('', '**Audio**',
    `- Duration: \`${Formatter.formatDuration(info.duration)}\``,
    `- Size: \`${Formatter.formatFileSize(info.size)}\``,
    `- Container: \`${clean(info.container)}\``,
    `- Codec: \`${clean(info.audio.codec_name || 'N/A')}\``,
    `- Bitrate: \`${info.bitrate ? `${Math.round(info.bitrate / 1000)} kbps` : 'N/A'}\``,
    `- Sample rate: \`${clean(info.audio.sample_rate || 'N/A')} Hz\``,
    `- Channels: \`${clean(info.audio.channels || 'N/A')}\``);
  const depth = Number(info.audio.bits_per_raw_sample || info.audio.bits_per_sample || 0);
  if (depth) lines.push(`- Bit depth: \`${depth} bit\``);
  if (!info.coverPath) lines.push(`- Cover: \`${info.coverUnavailable ? "Couldn't extract it" : 'Not embedded'}\``);
  lines.push('', 'Full metadata is attached as `metadata.json`.');
  const embed = new EmbedBuilder().setColor(COLORS.SUCCESS)
    .setAuthor({ name: interaction.user.username, iconURL: interaction.user.displayAvatarURL() })
    .setTitle(String(tags.title || info.filename).slice(0, 256))
    .setDescription(lines.join('\n').slice(0, 4096))
    .setFooter({ text: 'Music Downloader' }).setTimestamp();
  if (info.coverPath) embed.setImage('attachment://cover.jpg');
  return embed;
}

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
