import { z } from 'zod';

export const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Use YYYY-MM-DD');
export const uuid = z.string().uuid();
export const mobile = z.string().regex(/^[6-9]\d{9}$/, 'Enter a 10-digit Indian mobile number');
export const pincode = z.string().regex(/^[1-9]\d{5}$/, 'Enter a 6-digit pincode');
export const lngLat = z.object({ lng: z.number().min(-180).max(180), lat: z.number().min(-90).max(90) });
export const notInFuture = (today: string) => isoDate.refine((d) => d <= today, 'Date cannot be in the future');
