import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { Readable, Transform } from 'node:stream';
import { pipeline } from 'node:stream/promises';

export const EXTRACT_MAX_BYTES = 100 * 1024 * 1024;
const DOWNLOAD_TIMEOUT_MS = 60_000;
const PROCESS_TIMEOUT_MS = 20_000;
const MEDIA_FORMATS = 'mp3,flac,wav,ogg,mov,matroska,webm,aac,aiff,asf,ape,wv,tta,mpc,mpc8,ac3,eac3';
const executeFile = promisify(execFile);
export class ExtractError extends Error {}

function executable(name) {
  const explicit = name === 'ffprobe' ? process.env.FFPROBE_PATH : process.env.FFMPEG_PATH;
  if (!explicit || explicit === name) return name;
  return fs.existsSync(explicit) && fs.statSync(explicit).isDirectory()
    ? path.join(explicit, process.platform === 'win32' ? `${name}.exe` : name) : explicit;
}

export class MetadataExtractor {
  constructor({ execute = executeFile, fetchImpl = fetch } = {}) {
    this.execute = execute;
    this.fetchImpl = fetchImpl;
  }

  async extract(attachment) {
    if (attachment.size > EXTRACT_MAX_BYTES) throw new ExtractError('That file is too big. Keep it under 100 MiB.');
    const url = new URL(attachment.url);
    if (url.protocol !== 'https:' || !['cdn.discordapp.com', 'media.discordapp.net'].includes(url.hostname)
      || !/^\/(?:ephemeral-)?attachments\//.test(url.pathname)) {
      throw new ExtractError('Upload the file directly to Discord and try again.');
    }
    const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'audio-metadata-'));
    try {
      const response = await this.fetchImpl(url, { redirect: 'error', signal: AbortSignal.timeout(DOWNLOAD_TIMEOUT_MS) });
      if (!response.ok || !response.body) throw new ExtractError("Couldn't fetch that file. Upload it again and retry.");
      let size = 0;
      const limit = new Transform({ transform(chunk, encoding, callback) {
        size += chunk.length;
        callback(size > EXTRACT_MAX_BYTES ? new ExtractError('That file is too big. Keep it under 100 MiB.') : null, chunk);
      }});
      const input = path.join(directory, 'input');
      await pipeline(Readable.fromWeb(response.body), limit, fs.createWriteStream(input));
      const result = await this.inspect(input, attachment.name || 'Audio file', size);
      return { ...result, directory };
    } catch (error) {
      fs.rmSync(directory, { recursive: true, force: true });
      throw error;
    }
  }

  async inspect(input, filename, size) {
    const { stdout } = await this.execute(executable('ffprobe'), [
      '-v', 'error', '-protocol_whitelist', 'file,pipe', '-format_whitelist', MEDIA_FORMATS,
      '-show_format', '-show_streams', '-of', 'json', input
    ], { timeout: PROCESS_TIMEOUT_MS, maxBuffer: 2 * 1024 * 1024 });
    const probe = JSON.parse(stdout);
    const audio = probe.streams?.find(stream => stream.codec_type === 'audio');
    if (!audio) throw new ExtractError("That file doesn't contain an audio track.");
    const tags = Object.fromEntries(Object.entries({ ...audio.tags, ...probe.format?.tags })
      .map(([key, value]) => [key.toLowerCase(), String(value)]));
    const cover = probe.streams.find(stream => stream.codec_type === 'video' && stream.disposition?.attached_pic === 1);
    let coverPath = null;
    let coverUnavailable = false;
    if (cover) {
      coverPath = path.join(path.dirname(input), 'cover.jpg');
      try {
        await this.execute(executable('ffmpeg'), [
          '-nostdin', '-v', 'error', '-protocol_whitelist', 'file,pipe', '-format_whitelist', MEDIA_FORMATS, '-i', input,
          '-map', `0:${cover.index}`, '-frames:v', '1',
          '-vf', 'scale=1200:1200:force_original_aspect_ratio=decrease', '-c:v', 'mjpeg', '-y', coverPath
        ], { timeout: PROCESS_TIMEOUT_MS, maxBuffer: 1024 * 1024 });
      } catch (error) {
        console.error(`Cover extraction failed: ${error.message}`);
        coverUnavailable = true;
        coverPath = null;
      }
    }
    // Replace the temporary server path in the exported metadata.
    if (probe.format) probe.format.filename = filename;
    const metadataPath = path.join(path.dirname(input), 'metadata.json');
    fs.writeFileSync(metadataPath, JSON.stringify(probe, null, 2));
    return {
      filename, size, tags, audio, duration: Number(probe.format?.duration || audio.duration || 0),
      bitrate: Number(audio.bit_rate || probe.format?.bit_rate || 0),
      container: probe.format?.format_name || 'Unknown', coverPath, coverUnavailable, metadataPath
    };
  }
}
