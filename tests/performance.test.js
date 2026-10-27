import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { PreviewCache, PREVIEW_CACHE_TTL_MS, PREVIEW_CACHE_MAX_ENTRIES } from '../src/downloader/PreviewCache.js';
import { fetchTrackPreview } from '../src/downloader/TrackPreview.js';
import { DownloaderService } from '../src/downloader/DownloaderService.js';
import { YtdlpEngine } from '../src/downloader/YtdlpEngine.js';

test('simultaneous and repeated requests reuse metadata, expired requests refresh', async () => {
  let now = 0;
  let calls = 0;
  const cache = new PreviewCache(() => now);
  const create = async () => { calls++; return {title: 'Track'}; };
  const [a, b] = await Promise.all([cache.getOrCreate('track', create), cache.getOrCreate('track', create)]);
  assert.equal(a, b);
  assert.equal(calls, 1);
  await cache.getOrCreate('track', create);
  assert.equal(calls, 1);
  now = PREVIEW_CACHE_TTL_MS + 1;
  await cache.getOrCreate('track', create);
  assert.equal(calls, 2);
});

test('failed metadata is retryable and cache is bounded', async () => {
  const cache = new PreviewCache();
  await assert.rejects(cache.getOrCreate('track', async () => { throw new Error('offline'); }), /offline/);
  assert.equal(await cache.getOrCreate('track', async () => 'retry OK'), 'retry OK');
  for (let i = 0; i < PREVIEW_CACHE_MAX_ENTRIES + 5; i++) await cache.getOrCreate(`track-${i}`, async () => i);
  assert.equal(cache.entries.size, PREVIEW_CACHE_MAX_ENTRIES);
});

test('lightweight previews include cover and fall back on unavailable provider', async () => {
  const preview = await fetchTrackPreview('https://on.soundcloud.com/example', async endpoint => {
    assert.equal(endpoint.origin, 'https://soundcloud.com');
    return {ok: true, json: async () => ({title: 'Track', thumbnail_url: 'https://example.com/cover.jpg'})};
  });
  assert.equal(preview.title, 'Track');
  assert.equal(preview.thumbnail, 'https://example.com/cover.jpg');
  assert.equal(await fetchTrackPreview('https://youtu.be/example', async () => { throw new Error('timeout'); }), null);
  assert.equal(await fetchTrackPreview('https://example.com', async () => { throw new Error('must not call'); }), null);
});

test('format menu can appear before full extraction completes', async t => {
  t.mock.method(globalThis, 'fetch', async () => ({ok: true, json: async () => ({
    title: 'Fast title', thumbnail_url: 'https://example.com/cover.jpg'
  })}));
  const service = Object.create(DownloaderService.prototype);
  let finish;
  let calls = 0;
  service.resolveTrack = () => { calls++; return new Promise(resolve => { finish = resolve; }); };
  const preview = await service.prepare('https://youtu.be/example');
  assert.equal(preview.title, 'Fast title');
  assert.ok(preview.pendingMetadata);
  assert.equal(await service.prepare('https://youtu.be/example'), preview);
  assert.equal(calls, 1);
  const full = {rawMetadata: {title: 'Full title'}};
  finish(full);
  assert.equal(await preview.pendingMetadata, full);
});

test('audio format selection avoids downloading video', () => {
  const args = new YtdlpEngine().buildBaseArgs();
  assert.equal(args[args.indexOf('--format') + 1], 'bestaudio/best');
});

test('conversion reuses extracted media information rather than fetching the track again', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'metadata-reuse-'));
  const url = 'https://example.com/track';
  const raw = {id: '123', title: 'Track', formats: [{url: 'https://example.com/audio'}]};
  let calls = 0;
  const engine = new YtdlpEngine({execute: async (_, args) => {
    calls++;
    assert.equal(args.includes(url), false);
    const file = args[args.indexOf('--load-info-json') + 1];
    assert.deepEqual(JSON.parse(fs.readFileSync(file, 'utf8')), raw);
    assert.equal(args[args.indexOf('--audio-format') + 1], 'vorbis');
    return {stdout: path.join(dir, 'track.ogg')};
  }});
  try {
    const result = await engine.downloadAndConvert(url, path.join(dir, '%(title)s.%(ext)s'), null, 'ogg', raw);
    assert.equal(result, path.join(dir, 'track.ogg'));
    assert.equal(calls, 1);
  } finally {
    fs.rmSync(dir, {recursive: true, force: true});
  }
});
