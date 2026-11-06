import { z } from 'zod';

export const CorrectionInput = z.object({
  visit_id: z.number().int().positive(),
  entity_type: z.enum(['visit', 'visit_procedure', 'prescription', 'prescription_item']),
  entity_id: z.number().int().positive(), // The ID of the row being corrected
  action_type: z.enum(['insert', 'update', 'delete']),
  reason: z.string().min(1, 'سبب التصحيح مطلوب'),
  performed_by: z.string().min(1, 'اسم المستخدم مطلوب'), // Hardcoded to 'admin' for now
  details_json: z.string().optional().nullable(),
  // For insert/update, we may need the actual payload, but to keep it simple:
  // We will just log the audit record here, and the actual mutation will be done via the existing handlers.
});
export type CorrectionInput = z.infer<typeof CorrectionInput>;
