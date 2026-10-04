import { mobile } from '@nk/shared';
import { cookies } from 'next/headers';
import { z } from 'zod';
import { db } from '@/lib/data/store';
import { checkOtp, otpErrorMessage } from '@/lib/otp';
import { SESSION_COOKIE, signSession } from '@/lib/session';

const body = z.object({ mobile, code: z.string().regex(/^\d{6}$/) });

export async function POST(req: Request) {
  const parsed = body.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return Response.json({ error: 'Enter the 6-digit code' }, { status: 400 });
  const user = db().users.find((u) => u.mobile === parsed.data.mobile);
  if (!user) return Response.json({ error: otpErrorMessage({ ok: false, reason: 'mismatch' }) }, { status: 401 });
  const r = await checkOtp(user.mobile, parsed.data.code);
  if (!r.ok) {
    if (r.reason === 'failed') console.error('[otp] MSG91 verify failed', r.message);
    const status = r.reason === 'failed' ? 502 : r.reason === 'limit' ? 429 : 401;
    return Response.json({ error: otpErrorMessage(r) }, { status });
  }
  (await cookies()).set(SESSION_COOKIE, await signSession(user.id), {
    httpOnly: true, sameSite: 'lax', secure: process.env.NODE_ENV === 'production', path: '/', maxAge: 30 * 24 * 3600,
  });
  return Response.json({ redirect: user.role === 'FIELD_ASSISTANT' ? '/field' : '/' });
}
