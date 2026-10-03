import { resolveFieldAssistant } from '@/lib/field/bundle';
import { applyPush, PushEnvelopeError } from '@/lib/field/push';
import { db } from '@/lib/data/store';
import { currentUser } from '@/lib/session';

/** Sync push (SPECS §6.1): validate, re-check the geo-fence, store by record UUID. */
export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  if (body === null) return Response.json({ error: 'Body must be JSON' }, { status: 400 });
  const { fa } = resolveFieldAssistant(await currentUser());
  try {
    const result = applyPush(db(), body, { faId: fa.id });
    return Response.json(result, { headers: { 'Cache-Control': 'no-store' } });
  } catch (err) {
    if (err instanceof PushEnvelopeError) return Response.json({ error: err.message }, { status: 400 });
    throw err;
  }
}
