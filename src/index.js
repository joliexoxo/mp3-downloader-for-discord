import fs from 'fs';
import path from 'path';
import { Client, GatewayIntentBits, REST, Routes, AttachmentBuilder } from 'discord.js';
import { config } from 'dotenv';
import { DownloaderService } from './downloader/DownloaderService.js';
import { StatsRepository } from './database/StatsRepository.js';
import { pickAudioFormat } from './downloader/FormatPicker.js';
import { showHistory } from './history.js';
import { createLoadingEmbed, createSuccessEmbed, createErrorEmbed, createStatsEmbed } from './embeds.js';

config();

if (!process.env.DISCORD_TOKEN?.trim() || !/^\d{17,20}$/.test(process.env.CLIENT_ID || '')) {
  console.error('Configure DISCORD_TOKEN and CLIENT_ID (Application ID) in .env before starting.');
  process.exit(1);
}

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
  ]
});

const commands = [
  {
    name: 'download',
    description: 'Grab a track from YouTube, SoundCloud, and more',
    integration_types: [0, 1],
    contexts: [0, 1, 2],
    options: [
      {
        name: 'url',
        type: 3,
        description: 'Drop your track link here',
        required: true
      }
    ]
  },
  {
    name: 'history',
    description: 'Check your past downloads',
    integration_types: [0, 1],
    contexts: [0, 1, 2],
    options: [{
      name: 'page',
      description: 'Pick a page of your download history',
      type: 4,
      min_value: 1,
      max_value: 1000000,
      required: false
    }]
  },
  {
    name: 'stats',
    description: 'Check the bot stats',
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
    throw new Error(`Error deploying commands: ${error.message}`);
  }
}

client.once('ready', async () => {
  console.log(`Bot connected as ${client.user.tag}`);
  console.log(`Serving ${client.guilds.cache.size} server(s)`);
  
});

async function handleInteraction(interaction) {
  if (!interaction.isChatInputCommand()) return;

  if (interaction.commandName === 'history') {
    await showHistory(interaction, statsRepository);
    return;
  }

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
    await interaction.deferReply();

    let result;
    try {
      const parsed = new URL(url);
      if (!['http:', 'https:'].includes(parsed.protocol)) throw new Error('Enter a valid HTTP(S) music URL.');
      const track = await downloaderService.prepare(parsed.href);
      const choice = await pickAudioFormat(interaction, track);
      if (!choice) return;
      interaction = choice.interaction;
      await interaction.editReply({ embeds: [createLoadingEmbed(choice.format, track)], components: [] });
      result = await downloaderService.download(url, interaction.attachmentSizeLimit, choice.format, track);
      const successEmbed = createSuccessEmbed(interaction, result);
      const attachment = new AttachmentBuilder(result.filePath, {
        name: result.filename
      });

      await interaction.editReply({
        embeds: [successEmbed],
        files: [attachment]
      });

      try {
        statsRepository.recordDownload(interaction.user.id, result, choice.format);
      } catch (error) {
        console.error(`Could not save download history: ${error.message}`);
      }

    } catch (error) {
      console.error('Download error:', error);
      await interaction.editReply({ embeds: [createErrorEmbed(interaction, error.message)], components: [] });
    } finally {
      if (result?.filePath) {
        fs.rmSync(path.dirname(result.filePath), { recursive: true, force: true });
      }
    }
  }
}

client.on('interactionCreate', interaction => {
  handleInteraction(interaction).catch(error => {
    console.error(`Interaction failed: ${error.message}`);
  });
});

for (const signal of ['SIGINT', 'SIGTERM']) {
  process.once(signal, () => {
    console.log(`Received ${signal}, stopping bot.`);
    client.destroy();
    statsRepository.db.close();
    process.exit(0);
  });
}

try {
  await deployCommands();
  await client.login(process.env.DISCORD_TOKEN);
} catch (error) {
  console.error(`Bot startup failed: ${error.message}`);
  client.destroy();
  statsRepository.db.close();
  process.exit(1);
}
