import { ipcMain } from 'electron';
import * as auditRepo from '../../repositories/auditLog.repo';

export function registerAuditLogHandlers() {
  ipcMain.handle('audit:listByVisit', (_event, visitId) => {
    try {
      const id = Number(visitId);
      if (!Number.isInteger(id) || id <= 0) {
        return { success: false, error: { code: 'VALIDATION_ERROR', message: 'رقم الإقامة غير صالح' } };
      }
      const data = auditRepo.listCorrectionsByVisit(id);
      return { success: true, data };
    } catch (error) {
      return {
        success: false,
        error: { code: 'INTERNAL_ERROR', message: 'فشل في جلب سجل التصحيحات' }
      };
    }
  });
}
