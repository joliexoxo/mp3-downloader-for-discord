import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { YtdlpEngine } from './YtdlpEngine.js';
import { SpotifyResolver } from './SpotifyResolver.js';
import { Metadata } from './Metadata.js';
import { Formatter } from '../utils/Formatter.js';

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

  async download(url) {
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
    const outputTemplate = path.join(this.downloadsDir, '%(title).100s.%(ext)s');
    
    const filePath = await this.engine.downloadAndConvert(downloadUrl, outputTemplate, customMetadata);
    
    if (!fs.existsSync(filePath)) {
      throw new Error('Downloaded file could not be found');
    }

    const stats = fs.statSync(filePath);
    const maxSizeBytes = 25 * 1024 * 1024;
    
    if (stats.size > maxSizeBytes) {
      fs.unlinkSync(filePath);
      throw new Error(`The file is too large (${Formatter.formatFileSize(stats.size)}). Discord attachment limit is 25 MB.`);
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
  }
}

