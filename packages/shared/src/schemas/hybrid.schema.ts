import { z } from 'zod';

export const parentCode = z.string().regex(/^[A-Z0-9]{4}$/, 'Parent line code is 4 letters or digits');

export const hybridSchema = z.object({
  cropCode: z.string().regex(/^[A-Z]{2}$/),
  hybridCode: z.string().regex(/^\d{4}$/, 'Hybrid code is 4 digits'),
  femaleCode: parentCode,
  maleCode: parentCode,
  ratioFemaleMale: z.string().regex(/^\d+(\.\d+)?\s*:\s*\d+(\.\d+)?$/, 'Use a ratio like 4:1'),
  expectedYieldKgPerAcre: z.number().positive(),
  active: z.boolean().default(true),
});
export type HybridInput = z.infer<typeof hybridSchema>;
