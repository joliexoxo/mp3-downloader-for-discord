export function publicDownloadError(message = '') {
  if (/ffprobe|ffmpeg.*not found|ffmpeg-location/i.test(message)) {
    return "Audio conversion isn't available rn. The bot owner needs to check ffmpeg.";
  }
  if (/file is too large/i.test(message)) {
    return "That file's too big for Discord. Try MP3 or OGG.";
  }
  if (/Invalid URL|valid HTTP|Only HTTP/i.test(message)) {
    return 'Drop a valid track link and try again.';
  }
  if (/private|unavailable|not available|not found|403|404/i.test(message)) {
    return "That track isn't available. Try another link.";
  }
  if (/timed? ?out|timeout|ETIMEDOUT/i.test(message)) {
    return 'That took too long. Try again in a bit.';
  }
  return "Couldn't download that track rn. Try again in a bit or use another link.";
}
