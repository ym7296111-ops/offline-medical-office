import { getDb } from '../db/connection';
import { CorrectionInput } from '../../shared/schemas/audit';

/**
 * Appends one administrative-correction record (D-006 / WF-011 step 4).
 *
 * The audit log is append-only: nothing here updates or deletes a row, because the whole
 * point is that a closed visit's history can explain every later change.
 *
 * Must be called inside the same transaction as the mutation it describes, so a failed
 * correction can never leave a log entry behind for a change that did not happen.
 */
export function logCorrection(input: CorrectionInput) {
  const db = getDb();
  const now = new Date().toISOString();

  const result = db
    .prepare(
      `INSERT INTO audit_log (
         visit_id, entity_type, entity_id, action_type,
         reason, performed_by, performed_at, details_json, created_at
       ) VALUES (
         @visit_id, @entity_type, @entity_id, @action_type,
         @reason, @performed_by, @performed_at, @details_json, @created_at
       )`
    )
    .run({
      visit_id: input.visit_id,
      entity_type: input.entity_type,
      entity_id: input.entity_id,
      action_type: input.action_type,
      reason: input.reason,
      performed_by: input.performed_by,
      performed_at: now,
      details_json: input.details_json || null,
      created_at: now
    });

  return db.prepare('SELECT * FROM audit_log WHERE id = ?').get(result.lastInsertRowid);
}

/** All correction records for one visit, newest first (most recent correction on top). */
export function listCorrectionsByVisit(visitId: number) {
  const db = getDb();
  return db
    .prepare('SELECT * FROM audit_log WHERE visit_id = ? ORDER BY performed_at DESC, id DESC')
    .all(visitId);
}
