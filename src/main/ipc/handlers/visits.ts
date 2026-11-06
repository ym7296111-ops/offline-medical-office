import { ipcMain } from 'electron';
import { CreateVisitInput } from '../../../shared/schemas/visit';
import * as visitRepo from '../../repositories/visits.repo';
import { ZodError } from 'zod';

const isConstraint = (error: unknown, code: string): boolean =>
  error instanceof Error && 'code' in error && error.code === code;

/** Maps a repo-thrown domain error (carrying a `code`) to a documented IPC error. */
function domainError(error: unknown) {
  const code = (error as { code?: string } | null)?.code;
  const message = (error as { message?: string } | null)?.message;

  if (code === 'NOT_FOUND') {
    return { success: false, error: { code: 'NOT_FOUND', message: message ?? 'الإقامة غير موجودة' } };
  }
  if (code === 'ALREADY_DISCHARGED') {
    return { success: false, error: { code: 'CONFLICT', message: 'الإقامة مغلقة مسبقًا' } };
  }
  if (code === 'INVALID_DISCHARGE_DATE') {
    return {
      success: false,
      error: { code: 'VALIDATION_ERROR', message: 'تاريخ الخروج يجب أن يكون بعد تاريخ الدخول' }
    };
  }
  return { success: false, error: { code: 'INTERNAL_ERROR', message: 'حدث خطأ غير متوقع' } };
}

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

  ipcMain.handle('visits:listActive', (_event, searchTerm) => {
    try {
      // A missing/blank term means "no filter"; anything else is trimmed in the repo.
      const term = typeof searchTerm === 'string' ? searchTerm : null;
      const data = visitRepo.listActiveVisits(term ?? undefined);
      return { success: true, data };
    } catch (error) {
      return {
        success: false,
        error: { code: 'INTERNAL_ERROR', message: 'فشل في جلب الإقامات النشطة' }
      };
    }
  });

  ipcMain.handle('visits:discharge', (_event, visitId, dischargeDate) => {
    try {
      const id = Number(visitId);
      const date = typeof dischargeDate === 'string' ? dischargeDate.trim() : '';

      if (!Number.isInteger(id) || id <= 0) {
        return { success: false, error: { code: 'VALIDATION_ERROR', message: 'رقم الإقامة غير صالح' } };
      }
      if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
        return {
          success: false,
          error: { code: 'VALIDATION_ERROR', message: 'تاريخ الخروج غير صالح' }
        };
      }

      const result = visitRepo.dischargeVisit(id, date);
      return { success: true, data: result };
    } catch (error) {
      return domainError(error);
    }
  });

  ipcMain.handle('visits:getReport', (_event, visitId) => {
    try {
      const id = Number(visitId);
      if (!Number.isInteger(id) || id <= 0) {
        return { success: false, error: { code: 'VALIDATION_ERROR', message: 'رقم الإقامة غير صالح' } };
      }
      const data = visitRepo.getVisitReport(id);
      return { success: true, data };
    } catch (error) {
      return domainError(error);
    }
  });
}
