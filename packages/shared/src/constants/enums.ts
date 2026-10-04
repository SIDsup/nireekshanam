export const SOIL_TYPES = ['RED', 'BLACK', 'ALLUVIAL', 'LATERITE', 'SANDY', 'LOAMY', 'OTHER'] as const;
export type SoilType = (typeof SOIL_TYPES)[number];

export const IRRIGATION_SOURCES = ['BOREWELL', 'OPEN_WELL', 'CANAL', 'TANK', 'RIVER', 'RAINFED', 'DRIP', 'SPRINKLER', 'OTHER'] as const;
export type IrrigationSource = (typeof IRRIGATION_SOURCES)[number];

export const LOT_STATUSES = ['PLANNED', 'ACTIVE', 'HARVESTED', 'CLOSED', 'REJECTED', 'ABANDONED'] as const;
export type LotStatus = (typeof LOT_STATUSES)[number];

export const ROLES = ['FIELD_ASSISTANT', 'ORGANISER', 'SUPERVISOR', 'PRODUCTION_MANAGER', 'ADMIN', 'VIEWER'] as const;
export type Role = (typeof ROLES)[number];

export const ROLE_LABELS: Record<Role, string> = {
  FIELD_ASSISTANT: 'Field Assistant',
  ORGANISER: 'Organiser',
  SUPERVISOR: 'Supervisor',
  PRODUCTION_MANAGER: 'Production Manager',
  ADMIN: 'Admin',
  VIEWER: 'Viewer',
};

export const REVIEW_STATUSES = ['NONE', 'PENDING', 'APPROVED', 'REJECTED'] as const;
export type ReviewStatus = (typeof REVIEW_STATUSES)[number];

export const PARENTS = ['MALE', 'FEMALE', 'BOTH', 'NA'] as const;
export type Parent = (typeof PARENTS)[number];
