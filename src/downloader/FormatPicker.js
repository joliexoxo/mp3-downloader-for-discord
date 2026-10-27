import { ActionRowBuilder, StringSelectMenuBuilder, EmbedBuilder, ComponentType, MessageFlags } from 'discord.js';
import { AUDIO_FORMATS } from './AudioFormats.js';

export const FORMAT_PICKER_TIMEOUT_MS = 60_000;

export async function pickAudioFormat(interaction, track) {
  const customId = `audio-format:${interaction.id}`;
  const menu = new StringSelectMenuBuilder()
    .setCustomId(customId)
    .setPlaceholder('Pick your format')
    .addOptions(Object.entries(AUDIO_FORMATS).map(([value, format]) => ({
      label: format.label, value, description: format.description
    })));
  const message = await interaction.editReply({
    embeds: [new EmbedBuilder()
      .setColor(0x2b2d31)
      .setTitle(track.title.slice(0, 256))
      .setURL(track.url)
      .setImage(track.thumbnail || null)],
    components: [new ActionRowBuilder().addComponents(menu)]
  });

  let selection;
  try {
    selection = await message.awaitMessageComponent({
      componentType: ComponentType.StringSelect,
      time: FORMAT_PICKER_TIMEOUT_MS,
      filter: candidate => {
        if (candidate.customId !== customId) return false;
        if (candidate.user.id === interaction.user.id) return true;
        candidate.reply({ content: "This isn't your menu. Run `/download` to get your own.", flags: MessageFlags.Ephemeral })
          .catch(error => console.error(`Format menu reply failed: ${error.message}`));
        return false;
      }
    });
  } catch (error) {
    if (error.code !== 'InteractionCollectorError') throw error;
    await interaction.editReply({
      embeds: [new EmbedBuilder().setColor(0x2b2d31).setTitle("Time's up")
        .setDescription('Run `/download` again to pick a format.')],
      components: []
    });
    return null;
  }
  await selection.deferUpdate();
  return { format: selection.values[0], interaction: selection };
}
