import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { pickAudioFormat } from '../src/downloader/FormatPicker.js';
import { AUDIO_FORMATS, getAudioFormat } from '../src/downloader/AudioFormats.js';
import { DownloaderService } from '../src/downloader/DownloaderService.js';
import { YtdlpEngine } from '../src/downloader/YtdlpEngine.js';
import { publicDownloadError } from '../src/downloader/DownloadErrors.js';

function pickerFixture(collect) {
  const edits = [];
  const interaction = {
    id: '123', user: {id: 'owner'},
    editReply: async payload => {
      edits.push(payload);
      return {awaitMessageComponent: collect};
    }
  };
  return {interaction, edits};
}

test('menu offers four formats and acknowledges the owner selection', async () => {
  let acknowledged = false;
  const selection = {user: {id: 'owner'}, customId: 'audio-format:123', values: ['flac'],
    deferUpdate: async () => { acknowledged = true; }};
  const fixture = pickerFixture(async options => {
    assert.equal(options.filter(selection), true);
    assert.equal(options.time, 60_000);
    return selection;
  });
  const choice = await pickAudioFormat(fixture.interaction, {title: 'Test track', url: 'https://example.com/song', thumbnail: 'https://example.com/cover.jpg'});
  assert.equal(choice.format, 'flac');
  assert.equal(choice.interaction, selection);
  assert.equal(acknowledged, true);
  const row = fixture.edits[0].components[0].toJSON();
  const embed = fixture.edits[0].embeds[0].toJSON();
  assert.equal(embed.title, 'Test track');
  assert.equal(embed.image.url, 'https://example.com/cover.jpg');
  assert.deepEqual(row.components[0].options.map(option => option.value), ['mp3', 'flac', 'wav', 'ogg']);
});

test('legacy ffmpeg setting uses PATH, explicit directory is preserved', () => {
  const engine = new YtdlpEngine();
  engine.ffmpegLocation = 'ffmpeg';
  assert.equal(engine.buildBaseArgs().includes('--ffmpeg-location'), false);
  engine.ffmpegLocation = '/usr/bin';
  const args = engine.buildBaseArgs();
  assert.equal(args[args.indexOf('--ffmpeg-location') + 1], '/usr/bin');
});

test('public errors never expose commands or filesystem paths', () => {
  const failure = 'Failed to download audio: Command failed: yt-dlp -o /app/downloads/secret ERROR: ffprobe and ffmpeg not found';
  assert.match(publicDownloadError(failure), /check ffmpeg/);
  assert.doesNotMatch(publicDownloadError(failure), /yt-dlp|\/app\/|Command failed/);
  assert.doesNotMatch(publicDownloadError('Command failed: private-token'), /private-token/);
});

test('preview fetches track metadata before conversion and is reused', async () => {
  const service = Object.create(DownloaderService.prototype);
  let metadataCalls = 0;
  service.engine = {
    fetchRawMetadata: async () => {
      metadataCalls++;
      return {title: 'Preview title', thumbnail: 'https://example.com/art.jpg'};
    }
  };
  const preview = await service.prepare('https://example.com/song');
  assert.equal(preview.title, 'Preview title');
  assert.equal(preview.thumbnail, 'https://example.com/art.jpg');
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'preview-test-'));
  service.downloadsDir = root;
  service.engine.downloadAndConvert = async () => {throw new Error('conversion reached');};
  try {
    await assert.rejects(service.download(preview.url, 1024, 'ogg', preview), /conversion reached/);
    assert.equal(metadataCalls, 1);
    assert.deepEqual(fs.readdirSync(root), []);
  } finally {
    fs.rmSync(root, {recursive: true, force: true});
  }
});

test('another user cannot use the menu', async () => {
  let privateReply;
  const fixture = pickerFixture(async options => {
    assert.equal(options.filter({customId: 'audio-format:123', user: {id: 'other'},
      reply: async payload => {privateReply = payload;}}), false);
    throw Object.assign(new Error('time'), {code: 'InteractionCollectorError'});
  });
  assert.equal(await pickAudioFormat(fixture.interaction, {title: 'Track', url: 'https://example.com'}), null);
  assert.equal(privateReply.flags, 64);
  assert.deepEqual(fixture.edits.at(-1).components, []);
});

test('unexpected collector failures propagate', async () => {
  const fixture = pickerFixture(async () => { throw new Error('network error'); });
  await assert.rejects(pickAudioFormat(fixture.interaction, {title: 'Track', url: 'https://example.com'}), /network error/);
});

test('all formats reach converter and oversized output is cleaned', async () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'audio-format-test-'));
  const service = Object.create(DownloaderService.prototype);
  service.downloadsDir = root;
  let receivedFormat;
  service.engine = {
    fetchRawMetadata: async () => ({title: 'Track', duration: 10}),
    downloadAndConvert: async (_, template, metadata, format) => {
      receivedFormat = format;
      const output = path.join(path.dirname(template), `track.${format}`);
      fs.writeFileSync(output, 'audio');
      return output;
    }
  };
  try {
    for (const format of Object.keys(AUDIO_FORMATS)) {
      const result = await service.download('https://example.com/song', 1024, format);
      assert.equal(receivedFormat, format);
      assert.ok(result.filename.endsWith(`.${format}`));
      fs.rmSync(path.dirname(result.filePath), {recursive: true});
    }
    await assert.rejects(service.download('https://example.com/song', 1, 'wav'), /too large/);
    await assert.rejects(service.download('https://example.com/song', 1024, '__proto__'), /Unsupported/);
    assert.deepEqual(fs.readdirSync(root), []);
    assert.equal(getAudioFormat('ogg').codec, 'vorbis');
  } finally {
    fs.rmSync(root, {recursive: true, force: true});
  }
});
