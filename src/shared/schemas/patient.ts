import { z } from 'zod';

export const CreatePatientInput = z.object({
  file_number: z.string().min(1, 'رقم الملف مطلوب'),
  full_name: z.string().min(1, 'الاسم مطلوب'),
  emergency_contact_phone: z.string().optional().nullable(),
  companion_name: z.string().optional().nullable(),
  relationship: z.string().optional().nullable(),
});
export type CreatePatientInput = z.infer<typeof CreatePatientInput>;
