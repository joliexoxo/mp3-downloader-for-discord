import fs from 'fs';
import { Client, GatewayIntentBits, REST, Routes, AttachmentBuilder } from 'discord.js';
import { config } from 'dotenv';
import { DownloaderService } from './downloader/DownloaderService.js';
import { StatsRepository } from './database/StatsRepository.js';
import { createLoadingEmbed, createSuccessEmbed, createErrorEmbed, createStatsEmbed } from './embeds.js';

config();

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
  ]
});

const commands = [
  {
    name: 'download',
    description: 'Download music from YouTube, SoundCloud, and more',
    integration_types: [0, 1],
    contexts: [0, 1, 2],
    options: [
      {
        name: 'url',
        type: 3,
        description: 'URL of the music to download',
        required: true
      }
    ]
  },
  {
    name: 'stats',
    description: 'Show bot statistics',
    integration_types: [0, 1],
    contexts: [0, 1, 2]
  }
];

const downloaderService = new DownloaderService();
const statsRepository = new StatsRepository();

async function deployCommands() {
  const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN);
  
  try {
    console.log('Deploying slash commands...');
    await rest.put(
      Routes.applicationCommands(process.env.CLIENT_ID),
      { body: commands }
    );
    console.log('Slash commands deployed successfully!');
  } catch (error) {
    console.error('Error deploying commands:', error);
  }
}

client.once('ready', async () => {
  console.log(`Bot connected as ${client.user.tag}`);
  console.log(`Serving ${client.guilds.cache.size} server(s)`);
  
  await deployCommands();
});

client.on('interactionCreate', async (interaction) => {
  if (!interaction.isChatInputCommand()) return;

  if (interaction.commandName === 'stats') {
    const uptime = process.uptime();
    const days = Math.floor(uptime / 86400);
    const hours = Math.floor(uptime / 3600) % 24;
    const minutes = Math.floor(uptime / 60) % 60;
    const seconds = Math.floor(uptime) % 60;
    
    let uptimeStr = '';
    if (days > 0) uptimeStr += `${days}d `;
    if (hours > 0) uptimeStr += `${hours}h `;
    if (minutes > 0) uptimeStr += `${minutes}m `;
    uptimeStr += `${seconds}s`;

    await interaction.reply({ embeds: [createStatsEmbed(client, statsRepository.getTotalDownloads(), uptimeStr)] });
    return;
  }

  if (interaction.commandName === 'download') {
    const url = interaction.options.getString('url');
    await interaction.reply({ embeds: [createLoadingEmbed()] });

    try {
      const result = await downloaderService.download(url);
      statsRepository.incrementDownloads();
      const successEmbed = createSuccessEmbed(interaction, result);
      const attachment = new AttachmentBuilder(result.filePath, {
        name: result.filename
      });

      await interaction.editReply({
        embeds: [successEmbed],
        files: [attachment]
      });

      setTimeout(() => {
        if (fs.existsSync(result.filePath)) {
          fs.unlinkSync(result.filePath);
        }
      }, 5000);

    } catch (error) {
      console.error('Download error:', error);
      await interaction.editReply({ embeds: [createErrorEmbed(interaction, error.message)] });
    }
  }
});

client.login(process.env.DISCORD_TOKEN);
