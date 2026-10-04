import { CROPS, districtSchema, hybridSchema, organiserSchema, stateSchema, talukSchema, villageSchema } from '@nk/shared';
import type { ZodError } from 'zod';

/**
 * Bulk-import column layouts for each master, shared by the template route handler (server)
 * and the dry-run validator (browser). Client-safe: no server-only imports.
 */
export type ImportEntity = 'hybrids' | 'organisers' | 'villages';

export const IMPORT_COLUMNS: Record<ImportEntity, { columns: string[]; example: string[] }> = {
  hybrids: {
    columns: ['crop_code', 'hybrid_code', 'female_code', 'male_code', 'ratio_female_male', 'expected_yield_kg_per_acre', 'active'],
    example: ['HP', '2150', 'F7K2', 'M3P1', '4:1', '115', 'true'],
  },
  organisers: {
    columns: ['code', 'name', 'mobile', 'address1', 'address2', 'village_key', 'pincode', 'email', 'active'],
    example: ['052', 'R. Lakshmaiah', '9876543210', 'H.No 4-12, Main Road', '', 'TS210401', '501111', '', 'true'],
  },
  villages: {
    columns: ['state_code', 'state_name', 'district_code', 'district_name', 'taluk_code', 'taluk_name', 'village_code', 'village_name', 'pincode'],
    example: ['TS', 'Telangana', '21', 'Vikarabad', '04', 'Nawabpet', '06', 'Gangyada', '501111'],
  },
};

export function isImportEntity(v: string): v is ImportEntity {
  return v === 'hybrids' || v === 'organisers' || v === 'villages';
}

/** What the browser needs to know about the current masters to classify rows as new or updated. */
export interface ImportContext {
  /** `HP2041` style keys of hybrids already in the master. */
  hybridKeys: string[];
  organiserCodes: string[];
  /** Full village key (state + district + taluk + village code) → village id. */
  villageKeys: Record<string, string>;
}

export interface RowIssue {
  row: number;
  field: string;
  message: string;
}

export interface DryRun {
  rows: number;
  created: number;
  updated: number;
  invalid: number;
  issues: RowIssue[];
  missingColumns: string[];
}

const toBool = (s: string | undefined) => (s === undefined || s.trim() === '' ? undefined : /^(true|yes|y|1|active)$/i.test(s.trim()));
const toNum = (s: string | undefined) => (s === undefined || s.trim() === '' ? undefined : Number(s.trim()));
const blankToUndef = (s: string | undefined) => (s === undefined || s.trim() === '' ? undefined : s.trim());

const SCHEMA_TO_COLUMN: Record<string, string> = {
  cropCode: 'crop_code', hybridCode: 'hybrid_code', femaleCode: 'female_code', maleCode: 'male_code',
  ratioFemaleMale: 'ratio_female_male', expectedYieldKgPerAcre: 'expected_yield_kg_per_acre', villageId: 'village_key',
};

/** Zod's default messages are written for developers; rephrase the common ones. */
const FORMAT_HINT: Record<string, string> = {
  crop_code: 'must be 2 capital letters, e.g. HP', state_code: 'must be 2 capital letters, e.g. TS',
  district_code: 'must be 2 digits', taluk_code: 'must be 2 or 3 digits', village_code: 'must be 2 digits',
};

export function friendly(message: string, field = ''): string {
  if (/received undefined/.test(message)) return 'is required';
  if (/^Invalid string: must match pattern/.test(message)) return FORMAT_HINT[field] ?? 'has the wrong format';
  if (/^Too small: expected number to be >0/.test(message)) return 'must be a positive number';
  if (/expected number, received NaN/.test(message)) return 'must be a number';
  return message;
}

function zodIssues(row: number, err: ZodError, prefix = ''): RowIssue[] {
  return err.issues.map((i) => {
    const key = String(i.path[0] ?? '');
    const field = prefix + (SCHEMA_TO_COLUMN[key] ?? key);
    return { row, field, message: friendly(i.message, field) };
  });
}

/**
 * Validates parsed CSV rows (header first) for one master. Row numbers match the spreadsheet,
 * so the header is row 1 and the first data row is row 2.
 */
export function dryRun(entity: ImportEntity, table: string[][], ctx: ImportContext): DryRun {
  const [headerRow = [], ...body] = table;
  const header = headerRow.map((h) => h.trim().toLowerCase());
  const required = IMPORT_COLUMNS[entity].columns.filter((c) => !['address2', 'email', 'active'].includes(c));
  const missingColumns = required.filter((c) => !header.includes(c));
  const result: DryRun = { rows: body.length, created: 0, updated: 0, invalid: 0, issues: [], missingColumns };
  if (missingColumns.length) {
    result.invalid = body.length;
    return result;
  }

  const crops = new Set(CROPS.map((c) => c.code));
  const hybridKeys = new Set(ctx.hybridKeys);
  const orgCodes = new Set(ctx.organiserCodes);
  const seen = new Set<string>();

  body.forEach((cells, i) => {
    const rowNo = i + 2;
    const get = (col: string) => cells[header.indexOf(col)];
    const issues: RowIssue[] = [];
    let key = '';
    let exists = false;

    if (entity === 'hybrids') {
      const parsed = hybridSchema.safeParse({
        cropCode: blankToUndef(get('crop_code'))?.toUpperCase(),
        hybridCode: blankToUndef(get('hybrid_code')),
        femaleCode: blankToUndef(get('female_code'))?.toUpperCase(),
        maleCode: blankToUndef(get('male_code'))?.toUpperCase(),
        ratioFemaleMale: blankToUndef(get('ratio_female_male')),
        expectedYieldKgPerAcre: toNum(get('expected_yield_kg_per_acre')),
        active: toBool(get('active')),
      });
      const cropCode = blankToUndef(get('crop_code'))?.toUpperCase();
      if (cropCode && /^[A-Z]{2}$/.test(cropCode) && !crops.has(cropCode)) issues.push({ row: rowNo, field: 'crop_code', message: `"${cropCode}" is not in the crop master` });
      if (!parsed.success) issues.push(...zodIssues(rowNo, parsed.error));
      else {
        key = parsed.data.cropCode + parsed.data.hybridCode;
        exists = hybridKeys.has(key);
      }
    } else if (entity === 'organisers') {
      const villageKey = blankToUndef(get('village_key'))?.toUpperCase();
      const villageId = villageKey ? ctx.villageKeys[villageKey] : undefined;
      const parsed = organiserSchema.safeParse({
        code: blankToUndef(get('code')),
        name: blankToUndef(get('name')),
        mobile: blankToUndef(get('mobile')),
        address1: blankToUndef(get('address1')),
        address2: blankToUndef(get('address2')),
        villageId: villageId ?? (villageKey ? '' : undefined),
        pincode: blankToUndef(get('pincode')),
        email: blankToUndef(get('email')) ?? '',
        active: toBool(get('active')),
      });
      if (!parsed.success) {
        issues.push(...zodIssues(rowNo, parsed.error).map((x) => (x.field === 'village_key' && villageKey ? { ...x, message: `"${villageKey}" is not in the location master` } : x)));
      } else {
        key = parsed.data.code;
        exists = orgCodes.has(key);
      }
    } else {
      const stateCode = blankToUndef(get('state_code'))?.toUpperCase();
      const districtCode = blankToUndef(get('district_code'));
      const talukCode = blankToUndef(get('taluk_code'));
      const checks = [
        ['', stateSchema.safeParse({ code: stateCode, name: blankToUndef(get('state_name')) })],
        ['district_', districtSchema.safeParse({ stateCode, code: districtCode, name: blankToUndef(get('district_name')) })],
        ['taluk_', talukSchema.safeParse({ districtId: `${stateCode}${districtCode}`, code: talukCode, name: blankToUndef(get('taluk_name')) })],
        ['village_', villageSchema.safeParse({ talukId: `${stateCode}${districtCode}${talukCode}`, code: blankToUndef(get('village_code')), name: blankToUndef(get('village_name')), pincode: blankToUndef(get('pincode')) })],
      ] as const;
      for (const [prefix, r] of checks) {
        if (!r.success) {
          for (const issue of zodIssues(rowNo, r.error)) {
            const field = issue.field === 'stateCode' ? 'state_code' : issue.field === 'pincode' ? 'pincode' : `${prefix || 'state_'}${issue.field}`;
            const raw = r.error.issues.find((x) => String(x.path[0]) === issue.field.replace(prefix, ''))?.message ?? issue.message;
            if (!issues.some((x) => x.field === field)) issues.push({ ...issue, field, message: friendly(raw, field) });
          }
        }
      }
      if (!issues.length) {
        key = `${stateCode}${districtCode}${talukCode}${get('village_code')!.trim()}`;
        exists = key in ctx.villageKeys;
      }
    }

    if (!issues.length && key) {
      if (seen.has(key)) issues.push({ row: rowNo, field: entity === 'hybrids' ? 'hybrid_code' : entity === 'organisers' ? 'code' : 'village_code', message: `"${key}" appears more than once in this file` });
      seen.add(key);
    }
    if (issues.length) {
      result.invalid++;
      result.issues.push(...issues);
    } else if (exists) result.updated++;
    else result.created++;
  });
  return result;
}
