import fs from 'node:fs';
import { AttachmentBuilder, EmbedBuilder } from 'discord.js';
import { MetadataExtractor, ExtractError } from './MetadataExtractor.js';
import { createMetadataEmbed } from '../embeds.js';

const extractor = new MetadataExtractor();

export async function extractCommand(interaction, service = extractor) {
  await interaction.deferReply();
  let result;
  try {
    result = await service.extract(interaction.options.getAttachment('file', true));
    const files = [new AttachmentBuilder(result.metadataPath, { name: 'metadata.json' })];
    if (result.coverPath) files.push(new AttachmentBuilder(result.coverPath, { name: 'cover.jpg' }));
    await interaction.editReply({ embeds: [createMetadataEmbed(interaction, result)], files });
  } catch (error) {
    console.error(`Metadata extraction failed: ${error.message}`);
    const message = error instanceof ExtractError ? error.message
      : "Couldn't read that file rn. Try an audio file like MP3, FLAC, WAV, OGG, or M4A.";
    await interaction.editReply({
      embeds: [new EmbedBuilder().setColor(0xe74c3c)
        .setAuthor({ name: interaction.user.username, iconURL: interaction.user.displayAvatarURL() })
        .setTitle("Couldn't read that file").setDescription(`**Error**\n${message}`)
        .setFooter({ text: 'Music Downloader' }).setTimestamp()], files: []
    });
  } finally {
    if (result?.directory) fs.rmSync(result.directory, { recursive: true, force: true });
  }
}
