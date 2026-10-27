import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import Database from 'better-sqlite3';
import { StatsRepository } from '../src/database/StatsRepository.js';
import { createHistoryEmbed, showHistory } from '../src/history.js';

const track = {title: 'Track', artist: 'Artist', url: 'https://example.com/track'};

test('history is isolated by user and newest downloads come first across pages', () => {
  const repo = new StatsRepository(':memory:');
  try {
    repo.recordDownload('bob', {...track, title: 'Private Bob track'}, 'wav');
    for (let i = 1; i <= 7; i++) repo.recordDownload('alice', {...track, title: `Track ${i}`}, 'ogg');
    const first = repo.getHistory('alice');
    assert.equal(first.total, 7);
    assert.equal(first.pages, 2);
    assert.deepEqual(first.tracks.map(t => t.title), ['Track 7', 'Track 6', 'Track 5', 'Track 4', 'Track 3']);
    assert.deepEqual(repo.getHistory('alice', 2).tracks.map(t => t.title), ['Track 2', 'Track 1']);
    assert.equal(repo.getHistory('bob').total, 1);
    assert.equal(repo.getHistory('new-user').total, 0);
    assert.equal(repo.getHistory('alice', 999).page, 2);
    assert.throws(() => repo.getHistory('alice', -1), /Invalid/);
    assert.equal(repo.getTotalDownloads(), 8);
    assert.equal(first.tracks[0].format, 'ogg');
    assert.ok(first.tracks[0].downloaded_at > 0);
  } finally { repo.db.close(); }
});

test('existing statistics survive migration and per-user history survives restart', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'history-db-'));
  const file = path.join(dir, 'stats.db');
  const legacy = new Database(file);
  legacy.exec("CREATE TABLE stats (key TEXT PRIMARY KEY, value INTEGER NOT NULL DEFAULT 0); INSERT INTO stats VALUES ('total_downloads', 42)");
  legacy.close();
  let repo;
  try {
    repo = new StatsRepository(file);
    assert.equal(repo.getTotalDownloads(), 42);
    assert.equal(repo.getHistory('alice').total, 0);
    repo.recordDownload('alice', track, 'flac');
    repo.db.close();
    repo = new StatsRepository(file);
    assert.equal(repo.getHistory('alice').tracks[0].title, 'Track');
    assert.equal(repo.getTotalDownloads(), 43);
  } finally { repo?.db.close(); fs.rmSync(dir, {recursive: true, force: true}); }
});

test('history response is private and uses the caller ID only', async () => {
  let flags;
  let queriedUser;
  let page;
  let reply;
  await showHistory({
    user: {id: 'caller'}, options: {getInteger: () => 2},
    deferReply: async payload => {flags = payload.flags;},
    editReply: async payload => {reply = payload;}
  }, {getHistory: (id, requestedPage) => {
    queriedUser = id; page = requestedPage;
    return {tracks: [], total: 0, page: 1, pages: 1};
  }});
  assert.equal(flags, 64);
  assert.equal(queriedUser, 'caller');
  assert.equal(page, 2);
  assert.match(reply.embeds[0].toJSON().description, /No downloads yet/);
});

test('long titles and URLs stay within Discord embed limits', () => {
  const repo = new StatsRepository(':memory:');
  try {
    for (let i = 0; i < 5; i++) repo.recordDownload('alice', {
      title: 'x'.repeat(500), artist: '*'.repeat(500), url: 'https://example.com/' + 'a'.repeat(2000)
    }, 'mp3');
    const embed = createHistoryEmbed(repo.getHistory('alice'));
    const json = embed.toJSON();
    assert.ok(embed.length < 6000);
    assert.ok(json.fields.every(f => f.value.length <= 1024 && f.name.length <= 256));
  } finally { repo.db.close(); }
});
