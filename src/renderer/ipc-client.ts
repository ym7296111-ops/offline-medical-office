import type { CreateInsuranceCompanyInput, CreateMedicalEntityInput } from '../shared/schemas/catalog';
import type { CreatePatientInput } from '../shared/schemas/patient';
import type { CreateVisitInput } from '../shared/schemas/visit';

export interface IpcError {
  code: string;
  message: string;
}

export type IpcResponse<T> =
  | { success: true; data: T }
  | { success: false; error: IpcError };

export interface PatientRow {
  id: number;
  file_number: string;
  full_name: string;
  emergency_contact_phone: string | null;
  companion_name: string | null;
  relationship: string | null;
  is_active: 0 | 1;
  created_at: string;
  updated_at: string;
}

export interface VisitRow {
  id: number;
  patient_id: number;
  case_number: string;
  admission_date: string;
  discharge_date: string | null;
  admission_status: 'stable' | 'critical' | 'emergency' | 'under_observation';
  contract_type: 'private' | 'insurance';
  insurance_company_id: number | null;
  patient_copay_percentage: number;
  referred_entity_id: number | null;
  referred_entity_name_snapshot: string | null;
  total_days: number | null;
  total_gross_amount: number;
  patient_share_amount: number;
  insurer_share_amount: number;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface InsuranceCompanyRow {
  id: number;
  name: string;
  phone: string | null;
  notes: string | null;
  is_active: 0 | 1;
  created_at: string;
  updated_at: string;
}

export interface MedicalEntityRow {
  id: number;
  name: string;
  entity_type: string | null;
  phone: string | null;
  notes: string | null;
  is_active: 0 | 1;
  created_at: string;
  updated_at: string;
}

declare global {
  interface Window {
    api: {
      patients: {
        create: (input: CreatePatientInput) => Promise<IpcResponse<unknown>>;
        list: () => Promise<IpcResponse<PatientRow[]>>;
      };
      insurance: {
        create: (input: CreateInsuranceCompanyInput) => Promise<IpcResponse<unknown>>;
        list: () => Promise<IpcResponse<InsuranceCompanyRow[]>>;
        toggle: (id: number) => Promise<IpcResponse<unknown>>;
      };
      entities: {
        create: (input: CreateMedicalEntityInput) => Promise<IpcResponse<unknown>>;
        list: () => Promise<IpcResponse<MedicalEntityRow[]>>;
        toggle: (id: number) => Promise<IpcResponse<unknown>>;
      };
      visits: {
        create: (input: CreateVisitInput) => Promise<IpcResponse<VisitRow>>;
      };
    };
  }
}

function unwrap<T>(res: IpcResponse<T>): T {
  if (!res.success) throw new Error(res.error.message);
  return res.data;
}

export async function createPatient(input: CreatePatientInput) {
  return unwrap(await window.api.patients.create(input));
}

export async function listPatients(): Promise<PatientRow[]> {
  return unwrap(await window.api.patients.list());
}

export async function createInsuranceCompany(input: CreateInsuranceCompanyInput) {
  return unwrap(await window.api.insurance.create(input));
}

export async function listInsuranceCompanies(): Promise<InsuranceCompanyRow[]> {
  return unwrap(await window.api.insurance.list());
}

export async function toggleInsuranceCompany(id: number) {
  return unwrap(await window.api.insurance.toggle(id));
}

export async function createMedicalEntity(input: CreateMedicalEntityInput) {
  return unwrap(await window.api.entities.create(input));
}

export async function listMedicalEntities(): Promise<MedicalEntityRow[]> {
  return unwrap(await window.api.entities.list());
}

export async function toggleMedicalEntity(id: number) {
  return unwrap(await window.api.entities.toggle(id));
}

export async function createVisit(input: CreateVisitInput): Promise<VisitRow> {
  return unwrap(await window.api.visits.create(input));
}
