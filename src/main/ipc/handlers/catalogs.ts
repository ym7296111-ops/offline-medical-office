import { ipcMain } from 'electron';
import { CreateInsuranceCompanyInput, CreateMedicalEntityInput } from '../../../shared/schemas/catalog';
import * as catalogRepo from '../../repositories/catalogs.repo';
import { ZodError } from 'zod';

const isUniqueViolation = (error: unknown): boolean =>
  error instanceof Error && 'code' in error && error.code === 'SQLITE_CONSTRAINT_UNIQUE';

const validationError = (error: ZodError) => ({
  success: false,
  error: { code: 'VALIDATION_ERROR', message: error.issues[0].message }
});

const genericError = (message: string) => ({
  success: false,
  error: { code: 'INTERNAL_ERROR', message }
});

export function registerCatalogHandlers() {
  ipcMain.handle('insurance:create', (_event, raw) => {
    try {
      const input = CreateInsuranceCompanyInput.parse(raw);
      const result = catalogRepo.createInsuranceCompany(input);
      return { success: true, data: result };
    } catch (error) {
      if (error instanceof ZodError) return validationError(error);

      if (isUniqueViolation(error)) {
        return {
          success: false,
          error: { code: 'CONFLICT', message: 'اسم الشركة مستخدم بالفعل' }
        };
      }

      return genericError('حدث خطأ غير متوقع');
    }
  });

  ipcMain.handle('insurance:list', () => {
    try {
      const data = catalogRepo.listInsuranceCompanies();
      return { success: true, data };
    } catch (error) {
      return genericError('فشل في جلب البيانات');
    }
  });

  ipcMain.handle('insurance:toggle', (_event, id) => {
    try {
      const result = catalogRepo.toggleInsuranceCompany(id);
      if (result.changes === 0) {
        return { success: false, error: { code: 'NOT_FOUND', message: 'الشركة غير موجودة' } };
      }
      return { success: true, data: result };
    } catch (error) {
      return genericError('فشل في تغيير الحالة');
    }
  });

  ipcMain.handle('entities:create', (_event, raw) => {
    try {
      const input = CreateMedicalEntityInput.parse(raw);
      const result = catalogRepo.createMedicalEntity(input);
      return { success: true, data: result };
    } catch (error) {
      if (error instanceof ZodError) return validationError(error);

      if (isUniqueViolation(error)) {
        return {
          success: false,
          error: { code: 'CONFLICT', message: 'اسم الجهة مستخدم بالفعل' }
        };
      }

      return genericError('حدث خطأ غير متوقع');
    }
  });

  ipcMain.handle('entities:list', () => {
    try {
      const data = catalogRepo.listMedicalEntities();
      return { success: true, data };
    } catch (error) {
      return genericError('فشل في جلب البيانات');
    }
  });

  ipcMain.handle('entities:toggle', (_event, id) => {
    try {
      const result = catalogRepo.toggleMedicalEntity(id);
      if (result.changes === 0) {
        return { success: false, error: { code: 'NOT_FOUND', message: 'الجهة غير موجودة' } };
      }
      return { success: true, data: result };
    } catch (error) {
      return genericError('فشل في تغيير الحالة');
    }
  });
}
