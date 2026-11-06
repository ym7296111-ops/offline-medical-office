import { getDb } from '../db/connection';
import { CreatePatientInput } from '../../shared/schemas/patient';

export function createPatient(input: CreatePatientInput) {
  const db = getDb();
  const now = new Date().toISOString();
  const stmt = db.prepare(`
    INSERT INTO patients (file_number, full_name, emergency_contact_phone, companion_name, relationship, created_at, updated_at)
    VALUES (@file_number, @full_name, @emergency_contact_phone, @companion_name, @relationship, @created_at, @updated_at)
  `);
  return stmt.run({
    ...input,
    emergency_contact_phone: input.emergency_contact_phone || null,
    companion_name: input.companion_name || null,
    relationship: input.relationship || null,
    created_at: now,
    updated_at: now
  });
}

export function listPatients() {
  const db = getDb();
  return db.prepare('SELECT * FROM patients WHERE is_active = 1 ORDER BY id DESC').all();
}
