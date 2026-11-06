import { ipcMain } from 'electron';
import {
  AddPrescriptionItemInput,
  CreatePrescriptionInput
} from '../../../shared/schemas/prescription';
import * as prescriptionRepo from '../../repositories/prescriptions.repo';
import { ZodError } from 'zod';

const validationError = (error: ZodError) => ({
  success: false,
  error: { code: 'VALIDATION_ERROR', message: error.issues[0].message }
});

/** Turns a repo-thrown domain error (with a `code` property) into an IPC response. */
function domainError(error: unknown) {
  const code = (error as { code?: string } | null)?.code;
  const message = (error as { message?: string } | null)?.message;

  if (code === 'VISIT_CLOSED') {
    return { success: false, error: { code: 'CONFLICT', message: 'الإقامة مغلقة' } };
  }
  if (code === 'CORRECTION_REASON_REQUIRED') {
    return {
      success: false,
      error: { code: 'CONFLICT', message: 'يجب تقديم سبب التصحيح للإقامة المغلقة' }
    };
  }
  if (code === 'NOT_FOUND') {
    return { success: false, error: { code: 'NOT_FOUND', message: message ?? 'العنصر غير موجود' } };
  }
  if (code === 'SQLITE_CONSTRAINT_FOREIGNKEY') {
    return {
      success: false,
      error: { code: 'FOREIGN_KEY_ERROR', message: 'الإقامة أو الدواء المحدد غير موجود' }
    };
  }
  return { success: false, error: { code: 'INTERNAL_ERROR', message: 'حدث خطأ غير متوقع' } };
}

export function registerPrescriptionHandlers() {
  ipcMain.handle('prescriptions:create', (_event, raw) => {
    try {
      const input = CreatePrescriptionInput.parse(raw);
      const result = prescriptionRepo.createPrescription(input);
      return { success: true, data: result };
    } catch (error) {
      if (error instanceof ZodError) return validationError(error);
      return domainError(error);
    }
  });

  ipcMain.handle('prescriptions:addItem', (_event, raw) => {
    try {
      const input = AddPrescriptionItemInput.parse(raw);
      const result = prescriptionRepo.addPrescriptionItem(input);
      return { success: true, data: result };
    } catch (error) {
      if (error instanceof ZodError) return validationError(error);
      return domainError(error);
    }
  });

  ipcMain.handle('prescriptions:deleteItem', (_event, itemId, correctionReason) => {
    try {
      const id = Number(itemId);
      if (!Number.isInteger(id) || id <= 0) {
        return { success: false, error: { code: 'VALIDATION_ERROR', message: 'رقم البند غير صالح' } };
      }
      const result = prescriptionRepo.deletePrescriptionItem(
        id,
        typeof correctionReason === 'string' ? correctionReason : null
      );
      return { success: true, data: result };
    } catch (error) {
      return domainError(error);
    }
  });

  ipcMain.handle('prescriptions:listByVisit', (_event, visitId) => {
    try {
      const id = Number(visitId);
      if (!Number.isInteger(id) || id <= 0) {
        return { success: false, error: { code: 'VALIDATION_ERROR', message: 'رقم الإقامة غير صالح' } };
      }
      const data = prescriptionRepo.listPrescriptionsByVisit(id);
      return { success: true, data };
    } catch (error) {
      return domainError(error);
    }
  });
}
