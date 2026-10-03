export const LOT_ID_REGEX = /^(\d{2})(\d{2})([A-Z]{2})(\d{4})(\d{3})([A-Z0-9]{6})(\d{2})$/;

export const PART_RULES = {
  seasonCode: /^(01|02|03)$/,
  year: /^\d{2}$/,
  cropCode: /^[A-Z]{2}$/,
  hybridCode: /^\d{4}$/,
  organiserCode: /^\d{3}$/,
  farmerCode: /^[A-Z0-9]{6}$/,
  farmSeq: /^\d{2}$/,
} as const;

export function isValidLotId(value: string): boolean {
  const m = LOT_ID_REGEX.exec(value);
  return !!m && PART_RULES.seasonCode.test(m[1]!) && m[7] !== '00';
}
