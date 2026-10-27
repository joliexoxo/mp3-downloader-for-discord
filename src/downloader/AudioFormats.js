export const AUDIO_FORMATS = Object.freeze({
  mp3: { label: 'MP3', codec: 'mp3', description: 'Works on most devices' },
  flac: { label: 'FLAC', codec: 'flac', description: 'Lossless encoding, bigger file' },
  wav: { label: 'WAV', codec: 'wav', description: 'Uncompressed audio, much bigger file' },
  ogg: { label: 'OGG', codec: 'vorbis', description: 'Compressed audio with Ogg Vorbis' }
});

export function getAudioFormat(format) {
  if (!Object.hasOwn(AUDIO_FORMATS, format)) throw new Error('Unsupported audio format.');
  return AUDIO_FORMATS[format];
}
