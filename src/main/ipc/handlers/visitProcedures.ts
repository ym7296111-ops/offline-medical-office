import { ipcMain } from 'electron';
import { AddVisitProcedureInput } from '../../../shared/schemas/visitProcedure';
import * as visitProcedureRepo from '../../repositories/visitProcedures.repo';
import * as procedureRepo from '../../repositories/procedures.repo';
import { ZodError } from 'zod';

/** Turns a repo-thrown domain error (with a `code` property) into an IPC response. */
function domainError(error: unknown) {
  const code = (error as { code?: string } | null)?.code;
  const message = (error as { message?: string } | null)?.message;

  if (code === 'VISIT_CLOSED') {
    return { success: false, error: { code: 'CONFLICT', message: 'الإقامة مغلقة' } };
  }
  if (code === 'NOT_FOUND') {
    return { success: false, error: { code: 'NOT_FOUND', message: message ?? 'العنصر غير موجود' } };
  }
  if (code === 'SQLITE_CONSTRAINT_FOREIGNKEY') {
    return {
      success: false,
      error: { code: 'FOREIGN_KEY_ERROR', message: 'الإقامة أو الإجراء المحدد غير موجود' }
    };
  }
  return { success: false, error: { code: 'INTERNAL_ERROR', message: 'حدث خطأ غير متوقع' } };
}

export function registerVisitProcedureHandlers() {
  ipcMain.handle('visit_procedures:add', (_event, raw) => {
    try {
      const input = AddVisitProcedureInput.parse(raw);
      const result = visitProcedureRepo.addProcedure(input);
      return { success: true, data: result };
    } catch (error) {
      if (error instanceof ZodError) {
        return {
          success: false,
          error: { code: 'VALIDATION_ERROR', message: error.issues[0].message }
        };
      }
      return domainError(error);
    }
  });

  ipcMain.handle('visit_procedures:listByVisit', (_event, visitId) => {
    try {
      const data = visitProcedureRepo.listByVisit(Number(visitId));
      return { success: true, data };
    } catch (error) {
      return domainError(error);
    }
  });

  ipcMain.handle('visit_procedures:delete', (_event, id) => {
    try {
      const data = visitProcedureRepo.deleteProcedure(Number(id));
      return { success: true, data };
    } catch (error) {
      return domainError(error);
    }
  });

  ipcMain.handle('procedures:list', () => {
    try {
      const data = procedureRepo.listProcedures();
      return { success: true, data };
    } catch (error) {
      return { success: false, error: { code: 'INTERNAL_ERROR', message: 'فشل في جلب البيانات' } };
    }
  });
}
