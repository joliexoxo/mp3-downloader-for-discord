export class Formatter {
  static formatDuration(seconds) {
    if (!seconds) {
      return '0:00';
    }
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  }

  static formatFileSize(bytes) {
    if (!bytes) {
      return '0.00 MB';
    }
    const mb = bytes / (1024 * 1024);
    return `${mb.toFixed(2)} MB`;
  }
}
