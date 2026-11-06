import { registerPatientHandlers } from './handlers/patients';
import { registerCatalogHandlers } from './handlers/catalogs';
import { registerVisitHandlers } from './handlers/visits';
import { registerVisitProcedureHandlers } from './handlers/visitProcedures';

export function registerIpcHandlers() {
  registerPatientHandlers();
  registerCatalogHandlers();
  registerVisitHandlers();
  registerVisitProcedureHandlers();
}
