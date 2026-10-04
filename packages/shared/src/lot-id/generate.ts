import { PART_RULES } from './validate';

export interface LotIdInput {
  seasonCode: string;
  /** Full (2026) or two-digit (26) year. */
  year: number | string;
  cropCode: string;
  hybridCode: string;
  organiserCode: string;
  farmerCode: string;
  /** 1–99. Zero-padded to 2 digits (ADR-003). */
  farmSeq: number;
}

export class LotIdError extends Error {}

export function generateLotId(input: LotIdInput): string {
  const year = String(input.year).slice(-2).padStart(2, '0');
  if (!Number.isInteger(input.farmSeq) || input.farmSeq < 1 || input.farmSeq > 99) {
    throw new LotIdError(`Farm sequence must be 1–99, got ${input.farmSeq}`);
  }
  const parts = {
    seasonCode: input.seasonCode,
    year,
    cropCode: input.cropCode.toUpperCase(),
    hybridCode: input.hybridCode,
    organiserCode: input.organiserCode,
    farmerCode: input.farmerCode.toUpperCase(),
    farmSeq: String(input.farmSeq).padStart(2, '0'),
  };
  for (const [key, rule] of Object.entries(PART_RULES)) {
    const v = parts[key as keyof typeof parts];
    if (!rule.test(v)) throw new LotIdError(`Invalid ${key}: "${v}"`);
  }
  return parts.seasonCode + parts.year + parts.cropCode + parts.hybridCode + parts.organiserCode + parts.farmerCode + parts.farmSeq;
}
