import { z } from 'zod';

export const CreateInsuranceCompanyInput = z.object({
  name: z.string().min(1, 'اسم الشركة مطلوب'),
  phone: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
});
export type CreateInsuranceCompanyInput = z.infer<typeof CreateInsuranceCompanyInput>;

export const CreateMedicalEntityInput = z.object({
  name: z.string().min(1, 'اسم الجهة مطلوب'),
  entity_type: z.string().optional().nullable(),
  phone: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
});
export type CreateMedicalEntityInput = z.infer<typeof CreateMedicalEntityInput>;
