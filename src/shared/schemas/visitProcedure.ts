import { z } from 'zod';

export const AddVisitProcedureInput = z.object({
  visit_id: z.number().int().positive(),
  procedure_id: z.number().int().positive(),
  quantity: z.number().int().min(1).default(1),
  unit_price: z.number().int().min(0).optional(), // can override catalog price
  procedure_date: z.string().min(1),
  notes: z.string().optional().nullable(),
});
export type AddVisitProcedureInput = z.infer<typeof AddVisitProcedureInput>;
