import { getDb } from '../db/connection';
import { CreateDrugInput } from '../../shared/schemas/drug';

/**
 * Active drugs only — the prescription page needs selectable drugs, so deactivated
 * rows must not appear there (D-005: the treatment item is built from a drug list).
 */
export function listActiveDrugs() {
  const db = getDb();
  return db.prepare('SELECT * FROM drugs WHERE is_active = 1 ORDER BY name ASC').all();
}

/** Every drug, active or not — the management screen needs deactivated rows to re-enable. */
export function listAllDrugs() {
  const db = getDb();
  return db.prepare('SELECT * FROM drugs ORDER BY is_active DESC, name ASC').all();
}

export function createDrug(input: CreateDrugInput) {
  const db = getDb();
  const now = new Date().toISOString();
  const stmt = db.prepare(`
    INSERT INTO drugs (name, current_price, created_at, updated_at)
    VALUES (@name, @current_price, @created_at, @updated_at)
  `);
  return stmt.run({
    name: input.name,
    current_price: input.current_price,
    created_at: now,
    updated_at: now
  });
}

/** Soft-delete only: flipping is_active keeps every historical snapshot intact. */
export function toggleDrug(id: number) {
  const db = getDb();
  const now = new Date().toISOString();
  return db
    .prepare(
      'UPDATE drugs SET is_active = CASE WHEN is_active = 1 THEN 0 ELSE 1 END, updated_at = @updated_at WHERE id = @id'
    )
    .run({ id, updated_at: now });
}
