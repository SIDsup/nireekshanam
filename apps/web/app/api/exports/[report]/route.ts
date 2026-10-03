import { csvResponse, toCsv } from '@/lib/csv';
import { findReport } from '@/lib/data/exports';
import { db } from '@/lib/data/store';
import { currentUser } from '@/lib/session';

export async function GET(_req: Request, { params }: { params: Promise<{ report: string }> }) {
  // API routes are outside the proxy matcher, so check the session here.
  if (!(await currentUser())) return Response.json({ error: 'Sign in to download reports' }, { status: 401 });
  const { report } = await params;
  const def = findReport(report);
  if (!def) return Response.json({ error: `Unknown report "${report}"` }, { status: 404 });
  const { header, rows } = def.build();
  return csvResponse(`nireekshanam-${def.key}-${db().today}.csv`, toCsv(header, rows));
}
