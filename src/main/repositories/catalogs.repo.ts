import { getDb } from '../db/connection';
import {
  CreateInsuranceCompanyInput,
  CreateMedicalEntityInput
} from '../../shared/schemas/catalog';

export function createInsuranceCompany(input: CreateInsuranceCompanyInput) {
  const db = getDb();
  const now = new Date().toISOString();
  const stmt = db.prepare(`
    INSERT INTO insurance_companies (name, phone, notes, created_at, updated_at)
    VALUES (@name, @phone, @notes, @created_at, @updated_at)
  `);
  return stmt.run({
    ...input,
    phone: input.phone || null,
    notes: input.notes || null,
    created_at: now,
    updated_at: now
  });
}

export function listInsuranceCompanies() {
  const db = getDb();
  return db.prepare('SELECT * FROM insurance_companies ORDER BY is_active DESC, name ASC').all();
}

export function toggleInsuranceCompany(id: number) {
  const db = getDb();
  const now = new Date().toISOString();
  return db
    .prepare(
      'UPDATE insurance_companies SET is_active = CASE WHEN is_active = 1 THEN 0 ELSE 1 END, updated_at = @updated_at WHERE id = @id'
    )
    .run({ id, updated_at: now });
}

export function createMedicalEntity(input: CreateMedicalEntityInput) {
  const db = getDb();
  const now = new Date().toISOString();
  const stmt = db.prepare(`
    INSERT INTO medical_entities (name, entity_type, phone, notes, created_at, updated_at)
    VALUES (@name, @entity_type, @phone, @notes, @created_at, @updated_at)
  `);
  return stmt.run({
    ...input,
    entity_type: input.entity_type || null,
    phone: input.phone || null,
    notes: input.notes || null,
    created_at: now,
    updated_at: now
  });
}

export function listMedicalEntities() {
  const db = getDb();
  return db.prepare('SELECT * FROM medical_entities ORDER BY is_active DESC, name ASC').all();
}

export function toggleMedicalEntity(id: number) {
  const db = getDb();
  const now = new Date().toISOString();
  return db
    .prepare(
      'UPDATE medical_entities SET is_active = CASE WHEN is_active = 1 THEN 0 ELSE 1 END, updated_at = @updated_at WHERE id = @id'
    )
    .run({ id, updated_at: now });
}
