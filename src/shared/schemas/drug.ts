import { z } from 'zod';

export const CreateDrugInput = z.object({
  name: z.string().min(1, 'اسم الدواء مطلوب'),
  current_price: z.number().int().min(0).default(0),
});
export type CreateDrugInput = z.infer<typeof CreateDrugInput>;
