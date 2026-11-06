import { getDb } from '../db/connection';
import { AddVisitProcedureInput } from '../../shared/schemas/visitProcedure';
import { logCorrection } from './auditLog.repo';

/**
 * WF-011 needs `performed_by`, but the app has no authentication yet. Centralised here so
 * there is exactly one place to change when a real user identity exists.
 */
const CORRECTION_PERFORMED_BY = 'admin';

interface VisitRow {
  id: number;
  discharge_date: string | null;
  patient_copay_percentage: number;
}

interface ProcedureRow {
  id: number;
  name: string;
  category: 'radiology' | 'lab' | 'ambulance';
  current_price: number;
  is_active: 0 | 1;
}

/**
 * Recomputes `visits` totals from its line items.
 *
 * `total_gross_amount` = sum of visit_procedures.row_total + sum of prescription_items.row_total
 *                        (D-005: the treatment item is one line on the invoice, and its own
 *                        total is the sum of the drugs inside it).
 * `patient_share_amount` = gross × patient_copay_percentage / 100 (WF-010 step 4).
 * `insurer_share_amount` = gross − patient_share.
 *
 * Must be called inside an open transaction.
 */
export function recalculateVisitTotals(visitId: number): void {
  const db = getDb();

  const visit = db
    .prepare('SELECT id, discharge_date, patient_copay_percentage FROM visits WHERE id = ?')
    .get(visitId) as VisitRow | undefined;
  if (!visit) throw new Error(`Visit ${visitId} not found`);

  const sum = db
    .prepare(
      `SELECT COALESCE((SELECT SUM(row_total) FROM visit_procedures WHERE visit_id = @visit_id), 0)
            + COALESCE((
                SELECT SUM(pi.row_total)
                  FROM prescription_items pi
                  JOIN prescriptions pr ON pr.id = pi.prescription_id
                 WHERE pr.visit_id = @visit_id
              ), 0) AS gross`
    )
    .get({ visit_id: visitId }) as { gross: number };

  const gross = sum.gross;
  // Integer cents throughout — floor the patient's share so rounding never overcharges.
  const patientShare = Math.floor((gross * visit.patient_copay_percentage) / 100);
  const insurerShare = gross - patientShare;

  db.prepare(
    `UPDATE visits
       SET total_gross_amount = @gross,
           patient_share_amount = @patient_share,
           insurer_share_amount = @insurer_share,
           updated_at = @updated_at
     WHERE id = @id`
  ).run({
    id: visitId,
    gross,
    patient_share: patientShare,
    insurer_share: insurerShare,
    updated_at: new Date().toISOString()
  });
}

/**
 * WF-011 guard: on an *open* visit everything behaves as before and the reason is ignored.
 * On a *closed* visit the mutation is allowed only with a non-empty correction reason,
 * which the caller must then log in the same transaction.
 *
 * Returns the normalised reason (or null when the visit is open / no reason was given).
 */
function requireCorrectionReason(visit: VisitRow, correctionReason: string | null | undefined): string | null {
  const reason = typeof correctionReason === 'string' ? correctionReason.trim() : '';

  if (visit.discharge_date === null) {
    // WF-011 step 4: on an active visit the reason carries no meaning.
    return null;
  }

  if (reason.length === 0) {
    const error = new Error('يجب تقديم سبب التصحيح للإقامة المغلقة');
    (error as { code?: string }).code = 'CORRECTION_REASON_REQUIRED';
    throw error;
  }

  return reason;
}

/** Fetches a visit regardless of state; throws NOT_FOUND when it does not exist. */
function getVisitOrThrow(visitId: number): VisitRow {
  const db = getDb();
  const visit = db
    .prepare('SELECT id, discharge_date, patient_copay_percentage FROM visits WHERE id = ?')
    .get(visitId) as VisitRow | undefined;
  if (!visit) {
    const error = new Error('الإقامة غير موجودة');
    (error as { code?: string }).code = 'NOT_FOUND';
    throw error;
  }
  return visit;
}

export function addProcedure(input: AddVisitProcedureInput) {
  const db = getDb();

  const run = db.transaction(() => {
    // WF-003 step 1 normally requires an open visit; WF-011 extends this to a closed
    // visit when an administrative correction reason is supplied.
    const correctionReason = requireCorrectionReason(
      getVisitOrThrow(input.visit_id),
      input.correction_reason
    );

    const procedure = db
      .prepare('SELECT id, name, category, current_price, is_active FROM procedures WHERE id = ?')
      .get(input.procedure_id) as ProcedureRow | undefined;
    if (!procedure || procedure.is_active !== 1) {
      const error = new Error('الإجراء غير موجود أو معطّل');
      (error as { code?: string }).code = 'NOT_FOUND';
      throw error;
    }

    // WF-003 step 5: an override becomes the new catalog price ("last pricing" rule).
    const overrideProvided = input.unit_price !== undefined;
    const unitPriceSnapshot = overrideProvided ? input.unit_price! : procedure.current_price;

    const now = new Date().toISOString();
    if (overrideProvided && unitPriceSnapshot !== procedure.current_price) {
      db.prepare('UPDATE procedures SET current_price = ?, updated_at = ? WHERE id = ?').run(
        unitPriceSnapshot,
        now,
        procedure.id
      );
    }

    const rowTotal = unitPriceSnapshot * input.quantity;

    const result = db
      .prepare(
        `INSERT INTO visit_procedures (
           visit_id, procedure_id, procedure_name_snapshot, procedure_category_snapshot,
           unit_price_snapshot, quantity, row_total, procedure_date, notes, created_at, updated_at
         ) VALUES (
           @visit_id, @procedure_id, @procedure_name_snapshot, @procedure_category_snapshot,
           @unit_price_snapshot, @quantity, @row_total, @procedure_date, @notes, @created_at, @updated_at
         )`
      )
      .run({
        visit_id: input.visit_id,
        procedure_id: procedure.id,
        procedure_name_snapshot: procedure.name,
        procedure_category_snapshot: procedure.category,
        unit_price_snapshot: unitPriceSnapshot,
        quantity: input.quantity,
        row_total: rowTotal,
        procedure_date: input.procedure_date,
        notes: input.notes || null,
        created_at: now,
        updated_at: now
      });

    recalculateVisitTotals(input.visit_id);

    // WF-011 step 4: the mutation and its audit record share one transaction.
    if (correctionReason !== null) {
      logCorrection({
        visit_id: input.visit_id,
        entity_type: 'visit_procedure',
        entity_id: Number(result.lastInsertRowid),
        action_type: 'insert',
        reason: correctionReason,
        performed_by: CORRECTION_PERFORMED_BY,
        details_json: JSON.stringify({
          procedure_id: procedure.id,
          procedure_name: procedure.name,
          procedure_category: procedure.category,
          unit_price_snapshot: unitPriceSnapshot,
          quantity: input.quantity,
          row_total: rowTotal,
          procedure_date: input.procedure_date,
          notes: input.notes || null
        })
      });
    }

    return db.prepare('SELECT * FROM visit_procedures WHERE id = ?').get(result.lastInsertRowid);
  });

  return run();
}

export function listByVisit(visitId: number) {
  const db = getDb();
  return db
    .prepare('SELECT * FROM visit_procedures WHERE visit_id = ? ORDER BY procedure_date ASC, id ASC')
    .all(visitId);
}

export function deleteProcedure(id: number, correctionReason?: string | null) {
  const db = getDb();

  const run = db.transaction(() => {
    const row = db.prepare('SELECT * FROM visit_procedures WHERE id = ?').get(id) as
      | {
          id: number;
          visit_id: number;
          procedure_id: number;
          procedure_name_snapshot: string;
          procedure_category_snapshot: string;
          unit_price_snapshot: number;
          quantity: number;
          row_total: number;
          procedure_date: string;
          notes: string | null;
        }
      | undefined;
    if (!row) {
      const error = new Error('البند غير موجود');
      (error as { code?: string }).code = 'NOT_FOUND';
      throw error;
    }

    // WF-003 / WF-006 for an open visit; WF-011 allows a closed one with a reason.
    const reason = requireCorrectionReason(getVisitOrThrow(row.visit_id), correctionReason);

    db.prepare('DELETE FROM visit_procedures WHERE id = ?').run(id);
    recalculateVisitTotals(row.visit_id);

    if (reason !== null) {
      // The row is gone, so the audit entry is the only remaining record of it.
      logCorrection({
        visit_id: row.visit_id,
        entity_type: 'visit_procedure',
        entity_id: row.id,
        action_type: 'delete',
        reason,
        performed_by: CORRECTION_PERFORMED_BY,
        details_json: JSON.stringify({
          procedure_id: row.procedure_id,
          procedure_name_snapshot: row.procedure_name_snapshot,
          procedure_category_snapshot: row.procedure_category_snapshot,
          unit_price_snapshot: row.unit_price_snapshot,
          quantity: row.quantity,
          row_total: row.row_total,
          procedure_date: row.procedure_date,
          notes: row.notes
        })
      });
    }

    return { id, visit_id: row.visit_id };
  });

  return run();
}
