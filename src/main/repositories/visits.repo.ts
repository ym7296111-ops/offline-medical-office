import { getDb } from '../db/connection';
import { CreateVisitInput } from '../../shared/schemas/visit';

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
