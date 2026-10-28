import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { MetadataExtractor, EXTRACT_MAX_BYTES } from '../src/extract/MetadataExtractor.js';
import { extractCommand } from '../src/extract/command.js';
import { createMetadataEmbed } from '../src/embeds.js';
const user = {username: 'Tester', displayAvatarURL: () => 'https://example.com/avatar.png'};
const file = {name: 'test.mp3', size: 5, url: 'https://cdn.discordapp.com/attachments/1/2/test.mp3'};
function fixture(cover = true) {
  return {format: {filename: '/private/input', duration: '62.5', bit_rate: '128000', tags: {TITLE: 'My song', ARTIST: 'Artist', ALBUM: 'Album'}},
    streams: [{index: 0, codec_type: 'audio', codec_name: 'mp3', sample_rate: '44100', channels: 2},
      ...(cover ? [{index: 1, codec_type: 'video', disposition: {attached_pic: 1}}] : [])]};
}

test('reads attachment tags and cover, exports metadata without temporary paths', async () => {
  const extractor = new MetadataExtractor({
    fetchImpl: async () => new Response('audio'),
    execute: async (exe, args) => {
      if (exe.includes('ffprobe')) return {stdout: JSON.stringify(fixture())};
      assert.equal(args[args.indexOf('-map') + 1], '0:1');
      fs.writeFileSync(args.at(-1), 'jpeg');
      return {stdout: ''};
    }
  });
  const result = await extractor.extract(file);
  try {
    assert.equal(result.tags.title, 'My song');
    assert.equal(result.duration, 62.5);
    assert.equal(result.size, 5);
    assert.ok(fs.existsSync(result.coverPath));
    const raw = JSON.parse(fs.readFileSync(result.metadataPath, 'utf8'));
    assert.equal(raw.format.filename, 'test.mp3');
    const embed = createMetadataEmbed({user}, result).toJSON();
    assert.equal(embed.image.url, 'attachment://cover.jpg');
    assert.match(embed.description, /Artist/);
    assert.match(embed.description, /44100/);
  } finally {fs.rmSync(result.directory, {recursive:true,force:true});}
});

test('slash-command ephemeral attachments without artwork still return metadata', async () => {
  const extractor = new MetadataExtractor({fetchImpl: async () => new Response('audio'),
    execute: async () => ({stdout: JSON.stringify(fixture(false))})});
  const result = await extractor.extract({...file, url: 'https://cdn.discordapp.com/ephemeral-attachments/1/2/test.mp3'});
  try {
    assert.equal(result.coverPath, null);
    assert.match(createMetadataEmbed({user}, result).toJSON().description, /Not embedded/);
  } finally {fs.rmSync(result.directory, {recursive:true,force:true});}
});

test('rejects oversized attachments and non-Discord download URLs before fetching', async () => {
  const extractor = new MetadataExtractor({fetchImpl: async () => {throw new Error('must not fetch');}});
  await assert.rejects(extractor.extract({...file, size: EXTRACT_MAX_BYTES + 1}), /too big/);
  await assert.rejects(extractor.extract({...file, url: 'https://example.com/file'}), /directly to Discord/);
});

test('unsupported input cleans up downloaded file', async () => {
  let input;
  const extractor = new MetadataExtractor({fetchImpl: async () => new Response('bad file'),
    execute: async (_, args) => {input = args.at(-1); return {stdout: JSON.stringify({streams: []})};}});
  await assert.rejects(extractor.extract(file), /audio track/);
  assert.equal(fs.existsSync(path.dirname(input)), false);
});

test('temporary files are removed even if sending to Discord fails', async () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'extract-send-test-'));
  const metadataPath = path.join(directory, 'metadata.json');
  fs.writeFileSync(metadataPath, '{}');
  let calls = 0;
  const interaction = {user, options: {getAttachment: () => file}, deferReply: async () => {},
    editReply: async payload => {
      calls++;
      if (calls === 1) throw new Error('upload failed');
      assert.match(payload.embeds[0].toJSON().title, /read that file/);
    }};
  await extractCommand(interaction, {extract: async () => ({directory, metadataPath, tags:{}, audio:{},
    filename:'test.mp3', size:5, duration:1, container:'mp3', bitrate:128000})});
  assert.equal(calls, 2);
  assert.equal(fs.existsSync(directory), false);
});
