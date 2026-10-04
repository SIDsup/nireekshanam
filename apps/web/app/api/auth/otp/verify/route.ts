import { mobile } from '@nk/shared';
import { cookies } from 'next/headers';
import { z } from 'zod';
import { db } from '@/lib/data/store';
import { DEMO_OTP } from '@/lib/otp';
import { SESSION_COOKIE, signSession } from '@/lib/session';

const body = z.object({ mobile, code: z.string().regex(/^\d{6}$/) });

export async function POST(req: Request) {
  const parsed = body.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return Response.json({ error: 'Enter the 6-digit code' }, { status: 400 });
  const user = db().users.find((u) => u.mobile === parsed.data.mobile);
  if (!user || parsed.data.code !== DEMO_OTP) return Response.json({ error: 'That code is not right. Check it and try again.' }, { status: 401 });
  (await cookies()).set(SESSION_COOKIE, await signSession(user.id), {
    httpOnly: true, sameSite: 'lax', secure: process.env.NODE_ENV === 'production', path: '/', maxAge: 30 * 24 * 3600,
  });
  return Response.json({ redirect: user.role === 'FIELD_ASSISTANT' ? '/field' : '/' });
}
