import { registerPatientHandlers } from './handlers/patients';
import { registerCatalogHandlers } from './handlers/catalogs';

export function registerIpcHandlers() {
  registerPatientHandlers();
  registerCatalogHandlers();
}
