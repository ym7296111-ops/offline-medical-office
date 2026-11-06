import { ipcMain } from 'electron';
import { CreatePatientInput } from '../../../shared/schemas/patient';
import * as patientRepo from '../../repositories/patients.repo';
import { ZodError } from 'zod';

export function registerPatientHandlers() {
  ipcMain.handle('patients:create', (_event, raw) => {
    try {
      const input = CreatePatientInput.parse(raw);
      const result = patientRepo.createPatient(input);
      return { success: true, data: result };
    } catch (error) {
      if (error instanceof ZodError) {
        return {
          success: false,
          error: { code: 'VALIDATION_ERROR', message: error.issues[0].message }
        };
      }

      // Handle SQLite Unique constraint violation.
      // better-sqlite3 throws an instance of its SqliteError class (name 'SqliteError')
      // carrying the SQLite extended result code, e.g. 'SQLITE_CONSTRAINT_UNIQUE'.
      if (error instanceof Error && 'code' in error && error.code === 'SQLITE_CONSTRAINT_UNIQUE') {
        return {
          success: false,
          error: { code: 'CONFLICT', message: 'رقم الملف مستخدم بالفعل' }
        };
      }

      return {
        success: false,
        error: { code: 'INTERNAL_ERROR', message: 'حدث خطأ غير متوقع' }
      };
    }
  });

  ipcMain.handle('patients:list', () => {
    try {
      const data = patientRepo.listPatients();
      return { success: true, data };
    } catch (error) {
      return {
        success: false,
        error: { code: 'INTERNAL_ERROR', message: 'فشل في جلب البيانات' }
      };
    }
  });
}
