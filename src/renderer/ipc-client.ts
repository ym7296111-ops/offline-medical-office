import type { CreateInsuranceCompanyInput, CreateMedicalEntityInput } from '../shared/schemas/catalog';
import type { CreatePatientInput } from '../shared/schemas/patient';
import type { CreateVisitInput } from '../shared/schemas/visit';
import type { AddVisitProcedureInput } from '../shared/schemas/visitProcedure';
import type { CreateProcedureInput } from '../shared/schemas/procedure';

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

export interface VisitWithPatientRow extends VisitRow {
  patient_name: string;
  patient_file_number: string;
}

export interface ActiveVisitRow {
  visit_id: number;
  case_number: string;
  admission_date: string;
  admission_status: 'stable' | 'critical' | 'emergency' | 'under_observation';
  patient_name: string;
  file_number: string;
}

export interface VisitReport {
  visit: VisitWithPatientRow;
  procedures: VisitProcedureRow[];
}

export interface ProcedureRow {
  id: number;
  name: string;
  category: 'radiology' | 'lab' | 'ambulance';
  current_price: number;
  is_active: 0 | 1;
  created_at: string;
  updated_at: string;
}

export interface VisitProcedureRow {
  id: number;
  visit_id: number;
  procedure_id: number;
  procedure_name_snapshot: string;
  procedure_category_snapshot: 'radiology' | 'lab' | 'ambulance';
  unit_price_snapshot: number;
  quantity: number;
  row_total: number;
  procedure_date: string;
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
        get: (id: number) => Promise<IpcResponse<VisitWithPatientRow>>;
        listActive: (searchTerm?: string) => Promise<IpcResponse<ActiveVisitRow[]>>;
        discharge: (visitId: number, dischargeDate: string) => Promise<IpcResponse<VisitWithPatientRow>>;
        getReport: (visitId: number) => Promise<IpcResponse<VisitReport>>;
      };
      procedures: {
        list: () => Promise<IpcResponse<ProcedureRow[]>>;
        listAll: () => Promise<IpcResponse<ProcedureRow[]>>;
        create: (input: CreateProcedureInput) => Promise<IpcResponse<unknown>>;
        toggle: (id: number) => Promise<IpcResponse<unknown>>;
      };
      visitProcedures: {
        add: (input: AddVisitProcedureInput) => Promise<IpcResponse<VisitProcedureRow>>;
        listByVisit: (visitId: number) => Promise<IpcResponse<VisitProcedureRow[]>>;
        delete: (id: number) => Promise<IpcResponse<unknown>>;
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

export async function getVisit(id: number): Promise<VisitWithPatientRow> {
  return unwrap(await window.api.visits.get(id));
}

export async function listProcedures(): Promise<ProcedureRow[]> {
  return unwrap(await window.api.procedures.list());
}

export async function addVisitProcedure(input: AddVisitProcedureInput): Promise<VisitProcedureRow> {
  return unwrap(await window.api.visitProcedures.add(input));
}

export async function listVisitProcedures(visitId: number): Promise<VisitProcedureRow[]> {
  return unwrap(await window.api.visitProcedures.listByVisit(visitId));
}

export async function deleteVisitProcedure(id: number) {
  return unwrap(await window.api.visitProcedures.delete(id));
}

export async function listAllProcedures(): Promise<ProcedureRow[]> {
  return unwrap(await window.api.procedures.listAll());
}

export async function createProcedure(input: CreateProcedureInput) {
  return unwrap(await window.api.procedures.create(input));
}

export async function toggleProcedure(id: number) {
  return unwrap(await window.api.procedures.toggle(id));
}

export async function dischargeVisit(
  visitId: number,
  dischargeDate: string
): Promise<VisitWithPatientRow> {
  return unwrap(await window.api.visits.discharge(visitId, dischargeDate));
}

export async function getVisitReport(visitId: number): Promise<VisitReport> {
  return unwrap(await window.api.visits.getReport(visitId));
}

export async function listActiveVisits(searchTerm?: string): Promise<ActiveVisitRow[]> {
  return unwrap(await window.api.visits.listActive(searchTerm));
}
