import { LOT_ID_REGEX, PART_RULES } from './validate';

export interface LotIdParts {
  seasonCode: string;
  year: string;
  cropCode: string;
  hybridCode: string;
  organiserCode: string;
  farmerCode: string;
  farmSeq: string;
}

export type ParseResult = { ok: true; parts: LotIdParts } | { ok: false; error: string };

export function parseLotId(value: string): ParseResult {
  const id = value.trim().toUpperCase();
  if (id.length !== 21) return { ok: false, error: `Lot ID must be 21 characters, got ${id.length}` };
  const m = LOT_ID_REGEX.exec(id);
  if (!m) return { ok: false, error: 'Lot ID does not match the expected format' };
  const parts: LotIdParts = {
    seasonCode: m[1]!, year: m[2]!, cropCode: m[3]!, hybridCode: m[4]!,
    organiserCode: m[5]!, farmerCode: m[6]!, farmSeq: m[7]!,
  };
  if (!PART_RULES.seasonCode.test(parts.seasonCode)) return { ok: false, error: `Unknown season code ${parts.seasonCode}` };
  if (parts.farmSeq === '00') return { ok: false, error: 'Farm sequence starts at 01' };
  return { ok: true, parts };
}

/** Labelled segments for display, e.g. on the lot detail header. */
export function lotIdSegments(parts: LotIdParts): { value: string; label: string }[] {
  return [
    { value: parts.seasonCode, label: 'Season' },
    { value: parts.year, label: 'Year' },
    { value: parts.cropCode, label: 'Crop' },
    { value: parts.hybridCode, label: 'Hybrid' },
    { value: parts.organiserCode, label: 'Organiser' },
    { value: parts.farmerCode, label: 'Farmer' },
    { value: parts.farmSeq, label: 'Farm' },
  ];
}
