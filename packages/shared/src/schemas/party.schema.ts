import { z } from 'zod';
import { mobile, pincode } from './common';

const address = {
  name: z.string().trim().min(1).max(100),
  address1: z.string().trim().min(1),
  address2: z.string().trim().optional(),
  villageId: z.string().min(1),
  pincode,
  email: z.string().email().optional().or(z.literal('')),
};

export const organiserSchema = z.object({
  code: z.string().regex(/^\d{3}$/, 'Organiser code is 3 digits'),
  mobile,
  active: z.boolean().default(true),
  ...address,
});
export type OrganiserInput = z.infer<typeof organiserSchema>;

export const farmerSchema = z.object({
  code: z.string().regex(/^[A-Z0-9]{6}$/, 'Farmer code is 6 letters or digits'),
  organiserId: z.string().min(1),
  mobile: mobile.optional(),
  active: z.boolean().default(true),
  ...address,
});
export type FarmerInput = z.infer<typeof farmerSchema>;
