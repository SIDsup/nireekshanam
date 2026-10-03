import { z } from 'zod';
import { pincode } from './common';

export const stateSchema = z.object({ code: z.string().regex(/^[A-Z]{2}$/), name: z.string().min(1) });
export const districtSchema = z.object({ stateCode: z.string().regex(/^[A-Z]{2}$/), code: z.string().regex(/^\d{2}$/), name: z.string().min(1) });
// Taluk length is an open question (SPECS §9, Q3); 2–3 digits proposed.
export const talukSchema = z.object({ districtId: z.string(), code: z.string().regex(/^\d{2,3}$/), name: z.string().min(1) });
export const villageSchema = z.object({ talukId: z.string(), code: z.string().regex(/^\d{2}$/), name: z.string().min(1), pincode });
