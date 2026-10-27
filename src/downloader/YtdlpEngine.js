import { execFile } from 'child_process';
import { promisify } from 'util';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { getAudioFormat } from './AudioFormats.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const execFilePromise = promisify(execFile);

export class YtdlpEngine {
  constructor() {
    this.ffmpegLocation = process.env.FFMPEG_PATH?.trim();
    this.executable = process.env.YTDLP_PATH || 'yt-dlp';
    this.cookiesPath = process.env.COOKIES_PATH || path.resolve(__dirname, '../../cookies.txt');
  }

  buildBaseArgs() {
    const args = [
      '--ignore-config',
      '--no-playlist',
      '--js-runtimes', 'node',
      '--no-warnings'
    ];

    // Bare executable names are resolved through PATH by yt-dlp itself.
    if (this.ffmpegLocation && this.ffmpegLocation !== 'ffmpeg') {
      args.push('--ffmpeg-location', this.ffmpegLocation);
    }

    if (fs.existsSync(this.cookiesPath)) {
      args.push('--cookies', this.cookiesPath);
    }

    return args;
  }

  async fetchRawMetadata(url) {
    try {
      const args = [...this.buildBaseArgs(), '--dump-json', url];
      const { stdout } = await execFilePromise(this.executable, args, {
        timeout: 120_000,
        maxBuffer: 8 * 1024 * 1024,
        env: { ...process.env, PYTHONIOENCODING: 'utf-8' }
      });
      return JSON.parse(stdout);
    } catch (error) {
      throw new Error(`Failed to fetch metadata: ${error.message}`);
    }
  }

  async downloadAndConvert(url, outputTemplate, customMetadata = null, format = 'mp3') {
    const selectedFormat = getAudioFormat(format);
    try {
      const args = [
        ...this.buildBaseArgs(),
        '-x',
        '--audio-format',
        selectedFormat.codec,
        '--embed-metadata',
        '-o',
        outputTemplate
      ];

      if (format !== 'wav') args.push('--embed-thumbnail');

      if (customMetadata) {
        if (customMetadata.title) {
          args.push('--parse-metadata', `${customMetadata.title}:%(title)s`);
        }
        if (customMetadata.artist) {
          args.push('--parse-metadata', `${customMetadata.artist}:%(artist)s`);
        }
        if (customMetadata.album) {
          args.push('--parse-metadata', `${customMetadata.album}:%(album)s`);
        }
      }

      args.push(
        '--print',
        'after_move:filepath',
        url
      );
      
      const { stdout } = await execFilePromise(this.executable, args, {
        timeout: 600_000,
        maxBuffer: 8 * 1024 * 1024,
        env: { ...process.env, PYTHONIOENCODING: 'utf-8' }
      });
      const lines = stdout.trim().split(/\r?\n/);
      const filePath = lines[lines.length - 1]?.trim();
      
      if (!filePath) {
        throw new Error('No output filepath returned by yt-dlp');
      }
      
      return filePath;
    } catch (error) {
      throw new Error(`Failed to download audio: ${error.message}`);
    }
  }
}
