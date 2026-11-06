import { getDb } from '../db/connection';
import { CreateProcedureInput } from '../../shared/schemas/procedure';

/** Active procedures only — used to populate selectable catalogs (e.g. visit details). */
export function listProcedures() {
  const db = getDb();
  return db
    .prepare('SELECT * FROM procedures WHERE is_active = 1 ORDER BY category ASC, name ASC')
    .all();
}

/** Every procedure, active or not — used by the management screen so rows can be re-enabled. */
export function listAllProcedures() {
  const db = getDb();
  return db
    .prepare('SELECT * FROM procedures ORDER BY is_active DESC, category ASC, name ASC')
    .all();
}

export function getProcedure(id: number) {
  const db = getDb();
  return db.prepare('SELECT * FROM procedures WHERE id = ?').get(id);
}

export function createProcedure(input: CreateProcedureInput) {
  const db = getDb();
  const now = new Date().toISOString();
  const stmt = db.prepare(`
    INSERT INTO procedures (name, category, current_price, created_at, updated_at)
    VALUES (@name, @category, @current_price, @created_at, @updated_at)
  `);
  return stmt.run({
    name: input.name,
    category: input.category,
    current_price: input.current_price,
    created_at: now,
    updated_at: now
  });
}

export function toggleProcedure(id: number) {
  const db = getDb();
  const now = new Date().toISOString();
  return db
    .prepare(
      'UPDATE procedures SET is_active = CASE WHEN is_active = 1 THEN 0 ELSE 1 END, updated_at = @updated_at WHERE id = @id'
    )
    .run({ id, updated_at: now });
}
