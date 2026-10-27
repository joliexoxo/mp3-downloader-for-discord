import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { YtdlpEngine } from './YtdlpEngine.js';
import { SpotifyResolver } from './SpotifyResolver.js';
import { Metadata } from './Metadata.js';
import { Formatter } from '../utils/Formatter.js';
import { getAudioFormat } from './AudioFormats.js';
import { fetchTrackPreview } from './TrackPreview.js';
import { PreviewCache } from './PreviewCache.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export class DownloaderService {
  constructor() {
    this.engine = new YtdlpEngine();
    this.downloadsDir = path.resolve(__dirname, '../../downloads');
    this.ensureDownloadsDirectoryExists();
  }

  ensureDownloadsDirectoryExists() {
    if (!fs.existsSync(this.downloadsDir)) {
      fs.mkdirSync(this.downloadsDir, { recursive: true });
    }
  }

  async prepare(url) {
    let parsed;
    try { parsed = new URL(url); } catch { throw new Error('Enter a valid HTTP(S) music URL.'); }
    if (!['https:', 'http:'].includes(parsed.protocol)) {
      throw new Error('Only HTTP(S) music URLs are supported.');
    }
    this.previewCache ??= new PreviewCache();
    const key = parsed.href;
    return this.previewCache.getOrCreate(key, async () => {
      const pendingMetadata = this.resolveTrack(key);
      // The lightweight preview may finish before full extraction fails.
      pendingMetadata.catch(() => this.previewCache.entries.delete(key));
      const lightweight = fetchTrackPreview(key).then(preview => preview
        ? { ...preview, pendingMetadata }
        : pendingMetadata);
      return Promise.race([pendingMetadata, lightweight]);
    });
  }

  async resolveTrack(url) {
    const isSpotify = SpotifyResolver.isSpotifyUrl(url);
    let downloadUrl = url;
    let spotifyData = null;

    if (isSpotify) {
      spotifyData = await SpotifyResolver.fetchMetadata(url);
      downloadUrl = spotifyData.searchQuery;
    }

    let customMetadata = null;
    if (isSpotify && spotifyData) {
      customMetadata = {
        title: spotifyData.title,
        artist: spotifyData.artist,
        album: spotifyData.collectionName || spotifyData.title
      };
    }

    const rawMetadata = await this.engine.fetchRawMetadata(downloadUrl);
    return {
      downloadUrl, spotifyData, customMetadata, rawMetadata,
      title: spotifyData?.title || rawMetadata.title || 'Unknown track',
      thumbnail: spotifyData?.thumbnail || rawMetadata.thumbnail,
      url: rawMetadata.webpage_url || url
    };
  }

  async download(url, maxSizeBytes = 10 * 1024 * 1024, format = 'mp3', prepared = null) {
    getAudioFormat(format);
    const preview = prepared || await this.prepare(url);
    const { downloadUrl, spotifyData, customMetadata, rawMetadata } = preview.pendingMetadata
      ? await preview.pendingMetadata : preview;
    const isSpotify = Boolean(spotifyData);
    const requestDir = fs.mkdtempSync(path.join(this.downloadsDir, 'track-'));
    try {
    const outputTemplate = path.join(requestDir, '%(title).100s.%(ext)s');
    
    const filePath = await this.engine.downloadAndConvert(downloadUrl, outputTemplate, customMetadata, format, rawMetadata);
    
    if (!fs.existsSync(filePath)) {
      throw new Error('Downloaded file could not be found');
    }

    const stats = fs.statSync(filePath);
    
    if (stats.size > maxSizeBytes) {
      fs.unlinkSync(filePath);
      throw new Error(`The file is too large (${Formatter.formatFileSize(stats.size)}). Attachment limit: ${Formatter.formatFileSize(maxSizeBytes)}.`);
    }

    if (isSpotify && spotifyData) {
      let sourceName = 'Spotify';
      if (spotifyData.type === 'album') {
        sourceName = `Spotify (Album: ${spotifyData.collectionName}${spotifyData.totalTracks > 1 ? ` - Track 1/${spotifyData.totalTracks}` : ''})`;
      } else if (spotifyData.type === 'playlist') {
        sourceName = `Spotify (Playlist: ${spotifyData.collectionName} - Track 1/${spotifyData.totalTracks})`;
      }

      return new Metadata({
        title: spotifyData.title,
        artist: spotifyData.artist,
        duration: Formatter.formatDuration(spotifyData.durationMs / 1000),
        thumbnail: spotifyData.thumbnail || rawMetadata.thumbnail,
        fileSize: Formatter.formatFileSize(stats.size),
        source: sourceName,
        filePath: filePath,
        filename: path.basename(filePath),
        url: url
      });
    }

    return new Metadata({
      title: rawMetadata.title,
      artist: rawMetadata.uploader,
      duration: Formatter.formatDuration(rawMetadata.duration),
      thumbnail: rawMetadata.thumbnail,
      fileSize: Formatter.formatFileSize(stats.size),
      source: rawMetadata.extractor_key,
      filePath: filePath,
      filename: path.basename(filePath),
      url: rawMetadata.webpage_url || url
    });
    } catch (error) {
      fs.rmSync(requestDir, { recursive: true, force: true });
      throw error;
    }
  }
}

