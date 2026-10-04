import { buildFieldBundle, resolveFieldAssistant } from '@/lib/field/bundle';
import { currentUser } from '@/lib/session';

export const dynamic = 'force-dynamic';

/** Offline bundle for the signed-in field assistant (or the demo FA for other roles). */
export async function GET() {
  const { fa } = resolveFieldAssistant(await currentUser());
  return Response.json(buildFieldBundle(fa), { headers: { 'Cache-Control': 'no-store' } });
}
