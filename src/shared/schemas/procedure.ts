import { z } from 'zod';

export const CreateProcedureInput = z.object({
  name: z.string().min(1, 'اسم الإجراء مطلوب'),
  category: z.enum(['radiology', 'lab', 'ambulance']),
  current_price: z.number().int().min(0).default(0),
});
export type CreateProcedureInput = z.infer<typeof CreateProcedureInput>;
