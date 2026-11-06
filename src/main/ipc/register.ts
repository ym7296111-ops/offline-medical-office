import { registerPatientHandlers } from './handlers/patients';
import { registerCatalogHandlers } from './handlers/catalogs';
import { registerVisitHandlers } from './handlers/visits';

export function registerIpcHandlers() {
  registerPatientHandlers();
  registerCatalogHandlers();
  registerVisitHandlers();
}
