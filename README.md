# 🎵 Discord Music Downloader Bot

Discord bot to download music from YouTube, SoundCloud, and other platforms.

## ✨ Features

- 📥 Download music from YouTube and SoundCloud
- 🎨 Clean and elegant embeds
- ⏳ Loading indicator with animated GIF
- 🖼️ Display music cover art
- 📊 Detailed information (artist, duration, size)
- 🗑️ Automatic cleanup of temporary files
- ⚡ Slash commands only
- 🔄 Auto-deploy commands on startup

## 🚀 Installation

1. **Clone the project**
   ```bash
   git clone <repo-url>
   cd discord-music-downloader
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Configure the bot**
   - Copy `.env.example` to `.env`
   - Fill in the environment variables:
     ```env
     DISCORD_TOKEN=your_discord_bot_token
     CLIENT_ID=your_client_id
     ```

4. **Create Discord bot**
   - Go to [Discord Developer Portal](https://discord.com/developers/applications)
   - Create a new application
   - Go to "Bot" and create a bot
   - Copy the token to `.env`
   - Copy the Application ID to `.env` (CLIENT_ID)
   - In "OAuth2" > "URL Generator":
     - Check `bot` and `applications.commands`
     - Permissions: `Send Messages`, `Attach Files`, `Embed Links`
   - Use the generated URL to invite the bot

5. **Start the bot**
   ```bash
   npm start
   ```

## 📝 Usage

Use the `/download` slash command with the music URL:

```
/download url: https://www.youtube.com/watch?v=...
```

The bot will:
1. ⏳ Display a loading embed with animated GIF
2. 📥 Download the music
3. ✅ Edit the embed with cover art and information
4. 📤 Send the audio file

## 🎨 Embed Style

Embeds are designed to be clean and professional:
- **Loading**: Blue with animated GIF
- **Success**: Green with music cover
- **Error**: Red with error details

## 🔧 Technologies

- **discord.js** v14 - Discord framework
- **@distube/ytdl-core** - YouTube downloader
- **play-dl** - Multi-platform support (SoundCloud, etc.)
- **Node.js** - Runtime

## 📦 Supported Platforms

- ✅ **YouTube** - Fully supported (no setup required)
- ⚙️ **SoundCloud** - Requires client_id setup (optional)
- 🔄 Other platforms coming soon

### Setting up SoundCloud (Optional)

1. Go to [SoundCloud Apps](https://soundcloud.com/settings/apps/new)
2. Create a new app
3. Copy the Client ID
4. Add it to `.env`: `SOUNDCLOUD_CLIENT_ID=your_client_id`
5. Restart the bot

**Note:** The bot works perfectly with YouTube only. SoundCloud is optional.

## ⚠️ Notes

- Audio files are automatically deleted after 5 seconds
- Discord size limit: 25 MB (normal servers) / 500 MB (boosted servers)
- Respect copyright and platform terms of service
- Commands are automatically deployed on bot startup

## 📄 License

MIT
