import { z } from 'zod';

export const CreatePrescriptionInput = z.object({
  visit_id: z.number().int().positive(),
  prescription_date: z.string().min(1),
  notes: z.string().optional().nullable(),
});
export type CreatePrescriptionInput = z.infer<typeof CreatePrescriptionInput>;

export const AddPrescriptionItemInput = z.object({
  prescription_id: z.number().int().positive(),
  drug_id: z.number().int().positive(),
  quantity: z.number().int().min(1).default(1),
  unit_price: z.number().int().min(0).optional(), // override catalog price
  notes: z.string().optional().nullable(), // dosage instructions
  // WF-011: only meaningful on a discharged visit, where it is mandatory and logged.
  correction_reason: z.string().optional().nullable(),
});
export type AddPrescriptionItemInput = z.infer<typeof AddPrescriptionItemInput>;
