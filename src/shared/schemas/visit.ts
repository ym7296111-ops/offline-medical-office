import { z } from 'zod';

export const CreateVisitInput = z.object({
  patient_id: z.number().int().positive(),
  admission_status: z.enum(['stable', 'critical', 'emergency', 'under_observation']),
  contract_type: z.enum(['private', 'insurance']),
  insurance_company_id: z.number().int().positive().optional().nullable(),
  patient_copay_percentage: z.number().int().min(0).max(100).default(0),
  referred_entity_id: z.number().int().positive().optional().nullable(),
  referred_entity_name_snapshot: z.string().optional().nullable(),
  admission_date: z.string().min(1),
  notes: z.string().optional().nullable(),
}).refine((data) => {
  if (data.contract_type === 'insurance' && !data.insurance_company_id) {
    return false;
  }
  return true;
}, {
  message: 'يجب اختيار شركة التأمين عند اختيار عقد تأمين',
  path: ['insurance_company_id'],
});
export type CreateVisitInput = z.infer<typeof CreateVisitInput>;
