import { z } from 'zod';
import { LOT_STATUSES } from '../constants/enums';
import { isValidLotId } from '../lot-id/validate';

export const lotIdSchema = z.string().refine(isValidLotId, 'Not a valid 21-character lot ID');

export const lotSchema = z.object({
  id: z.string().uuid(),
  lotId: lotIdSchema,
  seasonCode: z.enum(['01', '02', '03']),
  year: z.number().int().min(2000).max(2099),
  hybridId: z.string(),
  organiserId: z.string(),
  farmerId: z.string(),
  farmId: z.string(),
  fieldAssistantId: z.string().optional(),
  contractedAreaSqm: z.number().positive(),
  targetYieldKg: z.number().nonnegative(),
  status: z.enum(LOT_STATUSES),
});
export type LotInput = z.infer<typeof lotSchema>;
