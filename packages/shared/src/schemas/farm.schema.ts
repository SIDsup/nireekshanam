import { z } from 'zod';
import { IRRIGATION_SOURCES, SOIL_TYPES } from '../constants/enums';
import { validatePolygon } from '../geo/validate-polygon';
import { lngLat } from './common';

export const geofenceSchema = z.array(lngLat).superRefine((ring, ctx) => {
  for (const issue of validatePolygon(ring)) {
    const message = {
      TOO_FEW_VERTICES: 'A geo-fence needs at least 3 points',
      SELF_INTERSECTING: 'The boundary crosses itself',
      TOO_SMALL: 'The fenced area must be larger than 100 m²',
    }[issue];
    ctx.addIssue({ code: 'custom', message });
  }
});

export const farmSchema = z.object({
  farmerId: z.string().min(1),
  farmSeq: z.number().int().min(1).max(99),
  surveyNumber: z.string().optional(),
  declaredAreaSqm: z.number().positive(),
  soilType: z.enum(SOIL_TYPES),
  irrigationSource: z.enum(IRRIGATION_SOURCES),
  location: lngLat,
  locationAccuracyM: z.number().nonnegative(),
  geofence: geofenceSchema,
});
export type FarmInput = z.infer<typeof farmSchema>;
