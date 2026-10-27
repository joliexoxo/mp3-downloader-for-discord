import Database from 'better-sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
export const HISTORY_PAGE_SIZE = 5;

export class StatsRepository {
  constructor(databasePath = path.resolve(__dirname, '../../data/stats.db')) {
    if (databasePath !== ':memory:') {
      fs.mkdirSync(path.dirname(databasePath), { recursive: true });
    }

    this.db = new Database(databasePath);
    this.initialize();
  }

  initialize() {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS stats (
        key   TEXT PRIMARY KEY,
        value INTEGER NOT NULL DEFAULT 0
      );

      INSERT OR IGNORE INTO stats (key, value) VALUES ('total_downloads', 0);

      CREATE TABLE IF NOT EXISTS downloads (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id TEXT NOT NULL,
        title TEXT NOT NULL,
        artist TEXT NOT NULL,
        url TEXT NOT NULL,
        format TEXT NOT NULL,
        downloaded_at INTEGER NOT NULL
      );
      CREATE INDEX IF NOT EXISTS downloads_user_id ON downloads (user_id, id DESC);
    `);
  }

  incrementDownloads() {
    this.db.prepare(`UPDATE stats SET value = value + 1 WHERE key = 'total_downloads'`).run();
  }

  recordDownload(userId, track, format) {
    this.db.transaction(() => {
      this.db.prepare(`INSERT INTO downloads (user_id, title, artist, url, format, downloaded_at)
        VALUES (?, ?, ?, ?, ?, ?)`).run(
        userId, track.title || 'Unknown track', track.artist || 'Unknown artist',
        track.url || '', format, Math.floor(Date.now() / 1000)
      );
      this.incrementDownloads();
    })();
  }

  getHistory(userId, requestedPage = 1) {
    if (!Number.isSafeInteger(requestedPage) || requestedPage < 1) {
      throw new Error('Invalid history page.');
    }
    const total = this.db.prepare('SELECT COUNT(*) AS total FROM downloads WHERE user_id = ?').get(userId).total;
    const pages = Math.max(1, Math.ceil(total / HISTORY_PAGE_SIZE));
    const page = Math.min(requestedPage, pages);
    const tracks = this.db.prepare(`SELECT title, artist, url, format, downloaded_at
      FROM downloads WHERE user_id = ? ORDER BY id DESC LIMIT ? OFFSET ?`)
      .all(userId, HISTORY_PAGE_SIZE, (page - 1) * HISTORY_PAGE_SIZE);
    return { tracks, total, page, pages };
  }

  getTotalDownloads() {
    return this.db.prepare(`SELECT value FROM stats WHERE key = 'total_downloads'`).get()?.value ?? 0;
  }
}
