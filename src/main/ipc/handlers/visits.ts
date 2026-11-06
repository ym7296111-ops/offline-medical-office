import { ipcMain } from 'electron';
import { CreateVisitInput } from '../../../shared/schemas/visit';
import * as visitRepo from '../../repositories/visits.repo';
import { ZodError } from 'zod';

const isConstraint = (error: unknown, code: string): boolean =>
  error instanceof Error && 'code' in error && error.code === code;

export function registerVisitHandlers() {
  ipcMain.handle('visits:create', (_event, raw) => {
    try {
      const input = CreateVisitInput.parse(raw);
      const result = visitRepo.createVisit(input);
      return { success: true, data: result };
    } catch (error) {
      if (error instanceof ZodError) {
        return {
          success: false,
          error: { code: 'VALIDATION_ERROR', message: error.issues[0].message }
        };
      }

      if (isConstraint(error, 'SQLITE_CONSTRAINT_UNIQUE')) {
        return {
          success: false,
          error: { code: 'CONFLICT', message: 'رقم الحالة مستخدم بالفعل، حاول مرة أخرى' }
        };
      }

      // FK RESTRICT / missing parent row.
      if (isConstraint(error, 'SQLITE_CONSTRAINT_FOREIGNKEY')) {
        return {
          success: false,
          error: { code: 'FOREIGN_KEY_ERROR', message: 'المريض أو الجهة المحددة غير موجودة' }
        };
      }

      return {
        success: false,
        error: { code: 'INTERNAL_ERROR', message: 'حدث خطأ غير متوقع' }
      };
    }
  });

  ipcMain.handle('visits:get', (_event, id) => {
    try {
      const data = visitRepo.getVisit(Number(id));
      if (!data) {
        return { success: false, error: { code: 'NOT_FOUND', message: 'الإقامة غير موجودة' } };
      }
      return { success: true, data };
    } catch (error) {
      return {
        success: false,
        error: { code: 'INTERNAL_ERROR', message: 'فشل في جلب البيانات' }
      };
    }
  });
}
