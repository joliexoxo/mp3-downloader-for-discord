# Discord Music Downloader

A Node.js Discord bot that sends audio files straight to your chat. Install it on your Discord profile or add it to a server.

## Commands

| Command | What it does |
| --- | --- |
| `/download url:` | Shows the track title and cover, then lets you pick MP3, FLAC, WAV, or OGG. |
| `/extract file:` | Reads an uploaded audio file's metadata and shows its embedded cover art. |
| `/history` | Shows your successful downloads in a private response. |
| `/stats` | Shows uptime, ping, server count, and total downloads. |

Only the person who runs `/download` can use its format menu. The menu expires after 60 seconds. Once you pick a format, the bot downloads, converts, and sends the file.

History includes the title, artist, format, source link, and date, with five tracks per page, newest first. Use the **Previous** and **Next** buttons to switch pages. Buttons are disabled when there is no page in that direction. History stays saved across restarts. Downloads made before history was added cannot be recovered per user: the bot previously stored only a global counter.

OGG uses Vorbis. FLAC and WAV can exceed Discord's upload limit and cannot restore quality missing from the source. Cover art is embedded in the audio file when supported; WAV does not include embedded cover art.

## Extracting metadata

Run `/extract` and attach an audio file using the `file` option. The bot displays embedded tags (title, artist, album, date, genre, track, and more), duration, codec, bitrate, sample rate, and channels, with embedded cover art below the description. Complete metadata is also attached as `metadata.json`. Files without embedded artwork show a clear "Not embedded" status. Uploaded files are limited to 100 MiB and temporary files are deleted after processing. The command works with server and profile installations.

## Discord setup

1. Open your application in the [Discord Developer Portal](https://discord.com/developers/applications).
2. Under **Bot**, copy the bot token into `DISCORD_TOKEN` in `.env`.
3. Under **General Information**, copy the Application ID into `CLIENT_ID`.
4. Under **Installation > Installation Contexts**, enable **User Install** and **Guild Install**.
5. Select **Discord Provided Link**. For User Install, add the `applications.commands` scope. For Guild Install, add `bot` and `applications.commands`, with View Channels, Send Messages, Attach Files, and Embed Links permissions.
6. Use the installation link to add the app to your profile or a server.

Global commands are registered on startup with `integration_types: [0, 1]` and `contexts: [0, 1, 2]`. No privileged intents are required. The bot uses the Discord Gateway, so no HTTP interactions endpoint is needed.

## Local setup

Requirements: Node.js 24, Python with `yt-dlp[default]`, and ffmpeg with ffprobe, available in your PATH.

```bash
npm ci
cp .env.example .env
# Fill in DISCORD_TOKEN and CLIENT_ID, then start the bot.
npm start
```

On PowerShell, use `Copy-Item .env.example .env` to create the configuration file. If `.env` already exists, edit it without replacing it.

### Environment variables

| Variable | Purpose |
| --- | --- |
| `DISCORD_TOKEN` | Your Discord bot token. Required. |
| `CLIENT_ID` | Your Discord Application ID. Required. |
| `FFMPEG_PATH` | Optional path to ffmpeg or its directory. Leave blank to use PATH. |
| `FFPROBE_PATH` | Optional ffprobe executable or directory for `/extract`. Leave blank to use PATH. |
| `YTDLP_PATH` | Optional yt-dlp executable path. Defaults to `yt-dlp`. |
| `COOKIES_PATH` | Optional Netscape cookies file. Defaults to `cookies.txt` in the project root. |

Keep your token and cookies private. `.env`, cookies, downloads, and SQLite databases are ignored by Git.

## VPS deployment

Docker deployment files are maintained locally and are not included in this repository. The following commands apply when your deployment folder already contains the local `Dockerfile` and `compose.yaml`.

Requirements: Docker Engine and the Docker Compose plugin.

```bash
cd mp3-downloader-for-discord
cp .env.example .env
nano .env
# Fill in DISCORD_TOKEN and CLIENT_ID.
docker compose up -d --build
docker compose logs -f --tail=100 bot
```

If `.env` already exists, edit it directly. Inside Docker, executable and cookie paths refer to paths inside the container.

The local image includes Node.js 24, ffmpeg, ffprobe, and yt-dlp with its JavaScript components. It runs as a non-root user. No inbound port is required. The bot restarts automatically, and SQLite statistics and history persist in the `bot-data` volume. A fresh volume starts with an empty database; your local database is not imported automatically.

```bash
# Stop the bot without deleting its saved data.
docker compose down
# Rebuild after updating the source files.
docker compose up -d --build
# Also refresh the base image and yt-dlp.
docker compose build --pull --no-cache
docker compose up -d
```

Do not use `docker compose down -v` if you want to keep statistics and download history.

### Optional cookies

If a platform requires a session, export cookies in Netscape format. A JSON export will not work. For local use, put the file at `cookies.txt` in the project root or set `COOKIES_PATH`.

For Docker, add the cookie mount to the `bot` service in your local `compose.yaml`:

```yaml
    volumes:
      - bot-data:/app/data
      - ./cookies.txt:/app/cookies.txt
```

The file must exist and be writable by the container user (UID 1000), since yt-dlp may update it. Do not mount it read-only. Set `COOKIES_PATH=/app/cookies.txt` in `.env`.

## How it works

YouTube and SoundCloud titles and covers load through oEmbed while full audio metadata is extracted in the background. If oEmbed fails, the bot falls back to yt-dlp metadata. A memory cache holds up to 64 links for two minutes and shares identical requests. Downloads reuse the extracted information and prefer audio-only streams.

- YouTube, SoundCloud, and other yt-dlp sources are supported, subject to platform availability and the VPS network.
- Spotify links provide metadata used to search for an equivalent track on YouTube. For Spotify albums and playlists, only the first track is processed.
- Output formats are MP3, FLAC, WAV, and OGG, with metadata. No SoundCloud API key is used.
- Each download gets its own temporary folder, cleaned after sending or on failure. An abrupt shutdown can leave temporary files behind.
- Upload size follows the limit provided by the Discord interaction, with a 10 MiB fallback.
- Metadata extraction times out after two minutes; downloading and conversion time out after ten minutes.
- Only download content you are allowed to download.

## Tests

```bash
npm test
```

Tests cover format selection, download cleanup, private per-user history, database migration and persistence, preview caching, and metadata reuse.

## Troubleshooting

If startup fails, check `.env`, both Discord installation contexts, and the logs. If YouTube downloads fail, update yt-dlp, or rebuild the local Docker image. Some VPS networks may need cookies or face platform restrictions.

If audio conversion fails, check that both ffmpeg and ffprobe are available. Technical error details stay in the logs; Discord responses show a short message.
