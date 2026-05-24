export class Metadata {
  constructor({ title, artist, duration, thumbnail, fileSize, source, filePath, filename, url }) {
    this.title = title;
    this.artist = artist;
    this.duration = duration;
    this.thumbnail = thumbnail;
    this.fileSize = fileSize;
    this.source = source;
    this.filePath = filePath;
    this.filename = filename;
    this.url = url;
  }
}
