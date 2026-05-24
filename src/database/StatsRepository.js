import Database from 'better-sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export class StatsRepository {
  constructor() {
    const dataDir = path.resolve(__dirname, '../../data');
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true });
    }

    this.db = new Database(path.join(dataDir, 'stats.db'));
    this.initialize();
  }

  initialize() {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS stats (
        key   TEXT PRIMARY KEY,
        value INTEGER NOT NULL DEFAULT 0
      );

      INSERT OR IGNORE INTO stats (key, value) VALUES ('total_downloads', 0);
    `);
  }

  incrementDownloads() {
    this.db.prepare(`UPDATE stats SET value = value + 1 WHERE key = 'total_downloads'`).run();
  }

  getTotalDownloads() {
    return this.db.prepare(`SELECT value FROM stats WHERE key = 'total_downloads'`).get()?.value ?? 0;
  }
}
