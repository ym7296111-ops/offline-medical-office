import { registerPatientHandlers } from './handlers/patients';
import { registerCatalogHandlers } from './handlers/catalogs';
import { registerVisitHandlers } from './handlers/visits';
import { registerVisitProcedureHandlers } from './handlers/visitProcedures';
import { registerPrescriptionHandlers } from './handlers/prescriptions';
import { registerAuditLogHandlers } from './handlers/auditLog';

export function registerIpcHandlers() {
  registerPatientHandlers();
  registerCatalogHandlers();
  registerVisitHandlers();
  registerVisitProcedureHandlers();
  registerPrescriptionHandlers();
  registerAuditLogHandlers();
}
