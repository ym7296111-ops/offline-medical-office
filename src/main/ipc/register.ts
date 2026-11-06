import { registerPatientHandlers } from './handlers/patients';

export function registerIpcHandlers() {
  registerPatientHandlers();
}
