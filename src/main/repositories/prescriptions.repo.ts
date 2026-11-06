import { getDb } from '../db/connection';
import { CreatePrescriptionInput, AddPrescriptionItemInput } from '../../shared/schemas/prescription';
import { recalculateVisitTotals } from './visitProcedures.repo';
import { logCorrection } from './auditLog.repo';

/**
 * WF-011 needs `performed_by`, but the app has no authentication yet. Mirrors the constant
 * in visitProcedures.repo.ts (both are 'admin' until a real identity exists).
 */
const CORRECTION_PERFORMED_BY = 'admin';

interface VisitRow {
  id: number;
  discharge_date: string | null;
}

interface PrescriptionRow {
  id: number;
  visit_id: number;
  prescription_date: string;
  total_amount: number;
  notes: string | null;
}

interface DrugRow {
  id: number;
  name: string;
  current_price: number;
  is_active: 0 | 1;
}

function domainError(message: string, code: string): Error {
  const error = new Error(message);
  (error as { code?: string }).code = code;
  return error;
}

/** Fetches a visit regardless of state; throws NOT_FOUND when it does not exist. */
function getVisitRow(visitId: number): VisitRow {
  const db = getDb();
  const visit = db
    .prepare('SELECT id, discharge_date FROM visits WHERE id = ?')
    .get(visitId) as VisitRow | undefined;
  if (!visit) throw domainError('الإقامة غير موجودة', 'NOT_FOUND');
  return visit;
}

/**
 * WF-011 guard: on an open visit the reason is ignored and the mutation proceeds; on a
 * closed visit a non-empty reason is mandatory and must be logged by the caller.
 */
function requireCorrectionReason(
  visit: VisitRow,
  correctionReason: string | null | undefined
): string | null {
  const reason = typeof correctionReason === 'string' ? correctionReason.trim() : '';
  if (visit.discharge_date === null) return null;

  if (reason.length === 0) {
    throw domainError('يجب تقديم سبب التصحيح للإقامة المغلقة', 'CORRECTION_REASON_REQUIRED');
  }
  return reason;
}

/** WF-007 step 1: prescriptions may only be touched while the visit is still open. */
function getActiveVisit(visitId: number): VisitRow {
  const db = getDb();
  const visit = db
    .prepare('SELECT id, discharge_date FROM visits WHERE id = ?')
    .get(visitId) as VisitRow | undefined;
  if (!visit) throw domainError('الإقامة غير موجودة', 'NOT_FOUND');
  if (visit.discharge_date !== null) throw domainError('الإقامة مغلقة', 'VISIT_CLOSED');
  return visit;
}

/**
 * Recomputes `prescriptions.total_amount` from its items (WF-007 step 7), then bubbles the
 * change up to the visit totals so the header stays in sync with the line items.
 *
 * Must be called inside an open transaction.
 */
function recalcPrescriptionAndVisit(prescription: PrescriptionRow, now: string): void {
  const db = getDb();

  const sum = db
    .prepare('SELECT COALESCE(SUM(row_total), 0) AS total FROM prescription_items WHERE prescription_id = ?')
    .get(prescription.id) as { total: number };

  db.prepare('UPDATE prescriptions SET total_amount = @total, updated_at = @updated_at WHERE id = @id').run({
    id: prescription.id,
    total: sum.total,
    updated_at: now
  });

  recalculateVisitTotals(prescription.visit_id);
}

function getPrescription(id: number): PrescriptionRow {
  const db = getDb();
  const row = db.prepare('SELECT * FROM prescriptions WHERE id = ?').get(id) as
    | PrescriptionRow
    | undefined;
  if (!row) throw domainError('الروشتة غير موجودة', 'NOT_FOUND');
  return row;
}

/** WF-007 steps 1–2: open a new prescription for an active visit. */
export function createPrescription(input: CreatePrescriptionInput) {
  const db = getDb();

  const run = db.transaction(() => {
    getActiveVisit(input.visit_id);

    const now = new Date().toISOString();
    const result = db
      .prepare(
        `INSERT INTO prescriptions (visit_id, prescription_date, total_amount, notes, created_at, updated_at)
         VALUES (@visit_id, @prescription_date, 0, @notes, @created_at, @updated_at)`
      )
      .run({
        visit_id: input.visit_id,
        prescription_date: input.prescription_date,
        notes: input.notes || null,
        created_at: now,
        updated_at: now
      });

    return db.prepare('SELECT * FROM prescriptions WHERE id = ?').get(result.lastInsertRowid);
  });

  return run();
}

/**
 * WF-007 steps 3–7: add one drug to a prescription.
 *
 * - `unit_price_snapshot` = the override when supplied, otherwise the current catalog price.
 * - An override writes back to `drugs.current_price` (the "last pricing" rule), but only
 *   when it actually differs, so a plain add does not churn the catalog row.
 * - The visit must still be open, and the drug must exist and be active (WF-007 edge cases).
 */
export function addPrescriptionItem(input: AddPrescriptionItemInput) {
  const db = getDb();

  const run = db.transaction(() => {
    const prescription = getPrescription(input.prescription_id);
    // WF-007 step 1 normally requires an open visit; WF-011 extends this to a closed visit
    // when an administrative correction reason is supplied.
    const correctionReason = requireCorrectionReason(
      getVisitRow(prescription.visit_id),
      input.correction_reason
    );

    const drug = db
      .prepare('SELECT id, name, current_price, is_active FROM drugs WHERE id = ?')
      .get(input.drug_id) as DrugRow | undefined;
    if (!drug || drug.is_active !== 1) {
      throw domainError('الدواء غير موجود أو معطّل', 'NOT_FOUND');
    }

    const overrideProvided = input.unit_price !== undefined;
    const unitPriceSnapshot = overrideProvided ? input.unit_price! : drug.current_price;
    const rowTotal = unitPriceSnapshot * input.quantity;

    const now = new Date().toISOString();

    // "Last pricing": a manual price becomes the new catalog price.
    if (overrideProvided && unitPriceSnapshot !== drug.current_price) {
      db.prepare('UPDATE drugs SET current_price = ?, updated_at = ? WHERE id = ?').run(
        unitPriceSnapshot,
        now,
        drug.id
      );
    }

    const result = db
      .prepare(
        `INSERT INTO prescription_items (
           prescription_id, drug_id, drug_name_snapshot, unit_price_snapshot,
           quantity, row_total, notes, created_at, updated_at
         ) VALUES (
           @prescription_id, @drug_id, @drug_name_snapshot, @unit_price_snapshot,
           @quantity, @row_total, @notes, @created_at, @updated_at
         )`
      )
      .run({
        prescription_id: prescription.id,
        drug_id: drug.id,
        drug_name_snapshot: drug.name,
        unit_price_snapshot: unitPriceSnapshot,
        quantity: input.quantity,
        row_total: rowTotal,
        notes: input.notes || null,
        created_at: now,
        updated_at: now
      });

    recalcPrescriptionAndVisit(prescription, now);

    // WF-011 step 4: the mutation and its audit record share one transaction.
    if (correctionReason !== null) {
      logCorrection({
        visit_id: prescription.visit_id,
        entity_type: 'prescription_item',
        entity_id: Number(result.lastInsertRowid),
        action_type: 'insert',
        reason: correctionReason,
        performed_by: CORRECTION_PERFORMED_BY,
        details_json: JSON.stringify({
          prescription_id: prescription.id,
          drug_id: drug.id,
          drug_name_snapshot: drug.name,
          unit_price_snapshot: unitPriceSnapshot,
          quantity: input.quantity,
          row_total: rowTotal,
          notes: input.notes || null
        })
      });
    }

    return db.prepare('SELECT * FROM prescription_items WHERE id = ?').get(result.lastInsertRowid);
  });

  return run();
}

/**
 * WF-008 (delete half): remove one drug from a prescription.
 *
 * Decision (WF-008 step 4 allows either): when the last item is removed the prescription
 * row is deleted as well, so no zero-total "empty prescription" rows accumulate and a
 * prescription always means "at least one drug". `deleted_prescription` in the result
 * reports which branch ran.
 */
export function deletePrescriptionItem(itemId: number, correctionReason?: string | null) {
  const db = getDb();

  const run = db.transaction(() => {
    const item = db.prepare('SELECT * FROM prescription_items WHERE id = ?').get(itemId) as
      | {
          id: number;
          prescription_id: number;
          drug_id: number;
          drug_name_snapshot: string;
          unit_price_snapshot: number;
          quantity: number;
          row_total: number;
          notes: string | null;
        }
      | undefined;
    if (!item) throw domainError('بند الدواء غير موجود', 'NOT_FOUND');

    const prescription = getPrescription(item.prescription_id);
    // WF-008 for an open visit; WF-011 allows a closed one with a reason.
    const reason = requireCorrectionReason(getVisitRow(prescription.visit_id), correctionReason);

    const now = new Date().toISOString();
    db.prepare('DELETE FROM prescription_items WHERE id = ?').run(itemId);

    const remaining = db
      .prepare('SELECT COUNT(*) AS c FROM prescription_items WHERE prescription_id = ?')
      .get(prescription.id) as { c: number };

    let deletedPrescription = false;
    if (remaining.c === 0) {
      // `prescriptions` is only referenced by `prescription_items` (now empty), so this
      // cannot orphan history; a discharged visit is already blocked above.
      db.prepare('DELETE FROM prescriptions WHERE id = ?').run(prescription.id);
      deletedPrescription = true;
    } else {
      recalcPrescriptionAndVisit(prescription, now);
    }

    // Either branch changes the visit's gross, so recompute it once at the end.
    recalculateVisitTotals(prescription.visit_id);

    // WF-011 step 4: the item row is gone, so the audit entry is its remaining record.
    if (reason !== null) {
      logCorrection({
        visit_id: prescription.visit_id,
        entity_type: 'prescription_item',
        entity_id: item.id,
        action_type: 'delete',
        reason,
        performed_by: CORRECTION_PERFORMED_BY,
        details_json: JSON.stringify({
          prescription_id: prescription.id,
          drug_id: item.drug_id,
          drug_name_snapshot: item.drug_name_snapshot,
          unit_price_snapshot: item.unit_price_snapshot,
          quantity: item.quantity,
          row_total: item.row_total,
          notes: item.notes,
          deleted_prescription: remaining.c === 0
        })
      });
    }

    return {
      id: itemId,
      prescription_id: prescription.id,
      visit_id: prescription.visit_id,
      deleted_prescription: deletedPrescription
    };
  });

  return run();
}

/** Prescriptions for a visit, each with its items (oldest first, items in insertion order). */
export function listPrescriptionsByVisit(visitId: number) {
  const db = getDb();

  const prescriptions = db
    .prepare('SELECT * FROM prescriptions WHERE visit_id = ? ORDER BY prescription_date ASC, id ASC')
    .all(visitId) as PrescriptionRow[];

  if (prescriptions.length === 0) return [];

  const itemStmt = db.prepare(
    'SELECT * FROM prescription_items WHERE prescription_id = ? ORDER BY id ASC'
  );

  return prescriptions.map((prescription) => ({
    ...prescription,
    items: itemStmt.all(prescription.id)
  }));
}
