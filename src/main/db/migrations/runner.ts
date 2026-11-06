import type Database from 'better-sqlite3';
import { existsSync, readFileSync, readdirSync } from 'fs';
import { join } from 'path';

/**
 * Resolves the directory that holds the `.sql` migration files.
 *
 * electron-vite compiles the main process into `out/main/`, so `__dirname` is that
 * folder in both dev and production builds. `viteStaticCopy` (see electron.vite.config.ts)
 * copies `src/main/db/migrations/*.sql` to `out/main/db/migrations`, which makes the
 * first candidate below the authoritative location in every environment.
 *
 * The remaining candidates are a last-resort safety net: `migrations/` covers a
 * differently configured copy target, and the source tree only exists in an
 * unpackaged checkout (it is absent from a packaged app). If none resolve we throw
 * instead of silently applying zero migrations.
 */
function resolveMigrationsDir(): string {
  const candidates = [
    // out/main/db/migrations — the viteStaticCopy destination (dev and production).
    join(__dirname, 'db', 'migrations'),
    join(__dirname, 'migrations'),
    // Unpackaged runs only: out/main/../../src/main/db/migrations.
    join(__dirname, '..', '..', 'src', 'main', 'db', 'migrations')
  ];

  for (const candidate of candidates) {
    if (existsSync(candidate)) {
      console.log(`[db] migrations dir: ${candidate}`);
      return candidate;
    }
  }

  throw new Error(`[db] migrations directory not found. Tried: ${candidates.join(', ')}`);
}

interface MigrationRow {
  name: string;
}

export function runMigrations(db: Database.Database): void {
  const migrationsDir = resolveMigrationsDir();

  db.exec(`
    CREATE TABLE IF NOT EXISTS _migrations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE,
      applied_at TEXT NOT NULL
    );
  `);

  const applied = new Set(
    db.prepare('SELECT name FROM _migrations').all().map((row) => (row as MigrationRow).name)
  );

  // Serial NNN_ prefixes make alphabetical order the chronological order.
  const files = readdirSync(migrationsDir)
    .filter((file) => file.endsWith('.sql'))
    .sort();

  const insertMigration = db.prepare('INSERT INTO _migrations (name, applied_at) VALUES (?, ?)');

  for (const file of files) {
    if (applied.has(file)) continue;

    const sql = readFileSync(join(migrationsDir, file), 'utf8');

    const applyMigration = db.transaction(() => {
      db.exec(sql);
      insertMigration.run(file, new Date().toISOString());
    });

    applyMigration();
    console.log(`[db] migration applied: ${file}`);
  }
}
