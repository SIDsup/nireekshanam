import { csvResponse, toCsv } from '@/lib/csv';
import { IMPORT_COLUMNS, isImportEntity } from '@/lib/import-spec';

/** Blank import template for a master: header row plus one example row. */
export async function GET(_req: Request, { params }: { params: Promise<{ entity: string }> }) {
  const { entity } = await params;
  if (!isImportEntity(entity)) return Response.json({ error: `No template for "${entity}"` }, { status: 404 });
  const { columns, example } = IMPORT_COLUMNS[entity];
  return csvResponse(`nireekshanam-${entity}-template.csv`, toCsv(columns, [example]));
}
