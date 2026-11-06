import Database from 'better-sqlite3';
import { app } from 'electron';
import { join } from 'path';
import { runMigrations } from './migrations/runner';

let db: Database.Database | null = null;

export function initDatabase(): Database.Database {
  if (db) return db;

  const dbPath = join(app.getPath('userData'), 'medical.db');
  console.log(`[db] path: ${dbPath}`);

  db = new Database(dbPath);

  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');
  db.pragma('synchronous = FULL');
  db.pragma('busy_timeout = 5000');
  db.pragma('temp_store = MEMORY');

  const walMode = db.pragma('journal_mode', { simple: true });
  const fkMode = db.pragma('foreign_keys', { simple: true });

  console.log(`[db] journal_mode: ${walMode}`);
  console.log(`[db] foreign_keys: ${fkMode}`);

  runMigrations(db);
  console.log('[db] migrations applied');

  return db;
}
