import { getDb } from '../db/connection';

export function listProcedures() {
  const db = getDb();
  return db
    .prepare('SELECT * FROM procedures WHERE is_active = 1 ORDER BY category ASC, name ASC')
    .all();
}

export function getProcedure(id: number) {
  const db = getDb();
  return db.prepare('SELECT * FROM procedures WHERE id = ?').get(id);
}
