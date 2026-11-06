import { getDb } from '../db/connection';
import { CreateVisitInput } from '../../shared/schemas/visit';
import { recalculateVisitTotals } from './visitProcedures.repo';
import { listPrescriptionsByVisit } from './prescriptions.repo';

/** Extracts a YYYY year from an ISO date string, falling back to the current year. */
function resolveYear(admissionDate: string): number {
  const match = /^(\d{4})-\d{2}-\d{2}/.exec(admissionDate);
  if (match) return Number(match[1]);
  return new Date().getFullYear();
}

function nextCaseNumber(year: number): string {
  const db = getDb();
  const prefix = `CASE-${year}-`;
  // COUNT(*)+1 is the documented scheme. Use the highest existing sequence as a floor
  // so the number can never collide if rows are ever removed out-of-band.
  const counted = db
    .prepare('SELECT COUNT(*) AS c FROM visits WHERE case_number LIKE ?')
    .get(`${prefix}%`) as { c: number };
  const maxRow = db
    .prepare('SELECT MAX(CAST(substr(case_number, ?) AS INTEGER)) AS m FROM visits WHERE case_number LIKE ?')
    .get(prefix.length + 1, `${prefix}%`) as { m: number | null };
  const sequence = Math.max(counted.c, maxRow.m ?? 0) + 1;
  return `${prefix}${String(sequence).padStart(4, '0')}`;
}

export function createVisit(input: CreateVisitInput) {
  const db = getDb();
  const now = new Date().toISOString();

  // D-002: a private contract carries no insurance company and the patient bears 100%.
  const isPrivate = input.contract_type === 'private';
  const copay = isPrivate ? 100 : input.patient_copay_percentage;
  const insuranceCompanyId = isPrivate ? null : (input.insurance_company_id ?? null);

  // WF-001 step 5: persist the referred entity name as a snapshot at admission time.
  let referredSnapshot = input.referred_entity_name_snapshot ?? null;
  if (input.referred_entity_id && !referredSnapshot) {
    const entity = db
      .prepare('SELECT name FROM medical_entities WHERE id = ?')
      .get(input.referred_entity_id) as { name: string } | undefined;
    referredSnapshot = entity?.name ?? null;
  }

  const year = resolveYear(input.admission_date);

  const insert = db.prepare(`
    INSERT INTO visits (
      patient_id, case_number, admission_date, admission_status, contract_type,
      insurance_company_id, patient_copay_percentage, referred_entity_id,
      referred_entity_name_snapshot, notes, created_at, updated_at
    ) VALUES (
      @patient_id, @case_number, @admission_date, @admission_status, @contract_type,
      @insurance_company_id, @patient_copay_percentage, @referred_entity_id,
      @referred_entity_name_snapshot, @notes, @created_at, @updated_at
    )
  `);

  const runInTransaction = db.transaction(() => {
    // Retry on the (astronomically unlikely) case_number collision.
    for (let attempt = 0; attempt < 5; attempt += 1) {
      const caseNumber = nextCaseNumber(year);
      try {
        const result = insert.run({
          patient_id: input.patient_id,
          case_number: caseNumber,
          admission_date: input.admission_date,
          admission_status: input.admission_status,
          contract_type: input.contract_type,
          insurance_company_id: insuranceCompanyId,
          patient_copay_percentage: copay,
          referred_entity_id: input.referred_entity_id ?? null,
          referred_entity_name_snapshot: referredSnapshot,
          notes: input.notes || null,
          created_at: now,
          updated_at: now
        });
        return db.prepare('SELECT * FROM visits WHERE id = ?').get(result.lastInsertRowid);
      } catch (error) {
        const code = (error as { code?: string }).code;
        if (code === 'SQLITE_CONSTRAINT_UNIQUE' && attempt < 4) continue;
        throw error;
      }
    }
    throw new Error('تعذر توليد رقم حالة فريد');
  });

  return runInTransaction();
}

export function getVisit(id: number) {
  const db = getDb();
  return db
    .prepare(
      `SELECT v.*, p.full_name AS patient_name, p.file_number AS patient_file_number
         FROM visits v
         JOIN patients p ON p.id = v.patient_id
        WHERE v.id = ?`
    )
    .get(id);
}

/** Whole calendar days between two YYYY-MM-DD dates, inclusive of both endpoints. */
function calendarDaysInclusive(admissionDate: string, dischargeDate: string): number {
  const dayMs = 24 * 60 * 60 * 1000;
  const start = Date.parse(`${admissionDate.slice(0, 10)}T00:00:00Z`);
  const end = Date.parse(`${dischargeDate.slice(0, 10)}T00:00:00Z`);
  if (Number.isNaN(start) || Number.isNaN(end)) return 1;
  const diff = Math.round((end - start) / dayMs) + 1;
  return Math.max(1, diff);
}

export function dischargeVisit(visitId: number, dischargeDate: string) {
  const db = getDb();

  const run = db.transaction(() => {
    const visit = db
      .prepare(
        'SELECT id, admission_date, discharge_date, patient_copay_percentage, total_gross_amount FROM visits WHERE id = ?'
      )
      .get(visitId) as
      | {
          id: number;
          admission_date: string;
          discharge_date: string | null;
          patient_copay_percentage: number;
          total_gross_amount: number;
        }
      | undefined;

    if (!visit) {
      const error = new Error('الإقامة غير موجودة');
      (error as { code?: string }).code = 'NOT_FOUND';
      throw error;
    }
    if (visit.discharge_date !== null) {
      const error = new Error('الإقامة مغلقة مسبقًا');
      (error as { code?: string }).code = 'ALREADY_DISCHARGED';
      throw error;
    }

    const admissionDay = visit.admission_date.slice(0, 10);
    const dischargeDay = dischargeDate.slice(0, 10);
    if (dischargeDay < admissionDay) {
      const error = new Error('تاريخ الخروج قبل تاريخ الدخول');
      (error as { code?: string }).code = 'INVALID_DISCHARGE_DATE';
      throw error;
    }

    const totalDays = calendarDaysInclusive(admissionDay, dischargeDay);

    // WF-009 step 4. Recompute from the line items so a stale running total can never be
    // frozen into a closed visit. The gross must cover visit_procedures *and*
    // prescriptions, so it is delegated to the one helper that owns that rule rather than
    // being re-derived here (a second copy of the formula is exactly how C10.2 silently
    // dropped treatment charges from the final total).
    recalculateVisitTotals(visitId);

    db.prepare(
      `UPDATE visits
          SET discharge_date = @discharge_date,
              total_days = @total_days,
              updated_at = @updated_at
        WHERE id = @id`
    ).run({
      id: visitId,
      discharge_date: dischargeDay,
      total_days: totalDays,
      updated_at: new Date().toISOString()
    });

    return db
      .prepare(
        `SELECT v.*, p.full_name AS patient_name, p.file_number AS patient_file_number
           FROM visits v
           JOIN patients p ON p.id = v.patient_id
          WHERE v.id = ?`
      )
      .get(visitId);
  });

  return run();
}

export function getVisitReport(visitId: number) {
  const db = getDb();
  const visit = db
    .prepare(
      `SELECT v.*, p.full_name AS patient_name, p.file_number AS patient_file_number
         FROM visits v
         JOIN patients p ON p.id = v.patient_id
        WHERE v.id = ?`
    )
    .get(visitId);

  if (!visit) {
    const error = new Error('الإقامة غير موجودة');
    (error as { code?: string }).code = 'NOT_FOUND';
    throw error;
  }

  const procedures = db
    .prepare(
      'SELECT * FROM visit_procedures WHERE visit_id = ? ORDER BY procedure_date ASC, id ASC'
    )
    .all(visitId);

  // WF-010 step 2: the report must show the prescriptions and every drug inside them, so
  // the printed gross (procedures + treatments) is visually justifiable line by line.
  // Reuses the prescriptions repo query rather than duplicating its join, so the report can
  // never drift from what the visit-details screen shows.
  const prescriptions = listPrescriptionsByVisit(visitId);

  return { visit, procedures, prescriptions };
}

/**
 * Active visits (WF-002 follow-up): every admission that has not been discharged yet.
 *
 * The search term is matched against the patient's name, the patient's file number and
 * the case number. `searchTerm` is passed to SQLite as a *bound parameter* and only the
 * surrounding wildcards are concatenated in SQL, so a term containing `%`, `_` or quotes
 * can never break out of the comparison.
 */
export function listActiveVisits(searchTerm?: string) {
  const db = getDb();

  const term = typeof searchTerm === 'string' ? searchTerm.trim() : '';
  const hasTerm = term.length > 0;

  // The escape character is a backslash, so a search term may itself contain one;
  // % and _ keep their user-typed wildcard meaning.
  const where = [
    'v.discharge_date IS NULL',
    ...(hasTerm
      ? [
          `(
             p.full_name LIKE ? ESCAPE '\\'
             OR p.file_number LIKE ? ESCAPE '\\'
             OR v.case_number LIKE ? ESCAPE '\\'
           )`
        ]
      : [])
  ].join(' AND ');

  const sql = `
    SELECT v.id            AS visit_id,
           v.case_number   AS case_number,
           v.admission_date AS admission_date,
           v.admission_status AS admission_status,
           p.full_name     AS patient_name,
           p.file_number   AS file_number
      FROM visits v
      JOIN patients p ON p.id = v.patient_id
     WHERE ${where}
     ORDER BY v.admission_date DESC, v.id DESC`;

  const params = hasTerm ? [`%${term}%`, `%${term}%`, `%${term}%`] : [];
  return db.prepare(sql).all(...params);
}
