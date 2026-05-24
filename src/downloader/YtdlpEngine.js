import { execFile } from 'child_process';
import { promisify } from 'util';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const execFilePromise = promisify(execFile);

export class YtdlpEngine {
  constructor() {
    this.ffmpegLocation = process.env.FFMPEG_PATH || 'ffmpeg';
    this.cookiesPath = path.resolve(__dirname, '../../cookies.txt');
  }

  buildBaseArgs() {
    const args = [
      '--ffmpeg-location',
      this.ffmpegLocation,
      '--no-warnings'
    ];

    if (fs.existsSync(this.cookiesPath)) {
      args.push('--cookies', this.cookiesPath);
    }

    return args;
  }

  async fetchRawMetadata(url) {
    try {
      const args = [...this.buildBaseArgs(), '--dump-json', url];
      const { stdout } = await execFilePromise('yt-dlp', args, {
        env: { ...process.env, PYTHONIOENCODING: 'utf-8' }
      });
      return JSON.parse(stdout);
    } catch (error) {
      throw new Error(`Failed to fetch metadata: ${error.message}`);
    }
  }

  async downloadAndConvert(url, outputTemplate, customMetadata = null) {
    try {
      const args = [
        ...this.buildBaseArgs(),
        '-x',
        '--audio-format',
        'mp3',
        '--embed-metadata',
        '--embed-thumbnail',
        '-o',
        outputTemplate
      ];

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
      
      const { stdout } = await execFilePromise('yt-dlp', args, {
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
