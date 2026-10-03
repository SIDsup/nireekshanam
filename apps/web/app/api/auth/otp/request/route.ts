import { mobile } from '@nk/shared';
import { z } from 'zod';
import { db } from '@/lib/data/store';

const body = z.object({ mobile });

export async function POST(req: Request) {
  const parsed = body.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return Response.json({ error: 'Enter a 10-digit Indian mobile number' }, { status: 400 });
  const user = db().users.find((u) => u.mobile === parsed.data.mobile);
  // Same response for unknown numbers, so the endpoint does not reveal who is registered.
  return Response.json({ sent: true, demoHint: user ? 'Demo: use code 246810' : 'Demo: this number is not registered' });
}
