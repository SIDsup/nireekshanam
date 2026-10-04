import { mobile } from '@nk/shared';
import { z } from 'zod';
import { db } from '@/lib/data/store';
import { otpErrorMessage, resendOtp } from '@/lib/otp';

const body = z.object({ mobile });

export async function POST(req: Request) {
  const parsed = body.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return Response.json({ error: 'Enter a 10-digit Indian mobile number' }, { status: 400 });
  const user = db().users.find((u) => u.mobile === parsed.data.mobile);
  if (user) {
    const r = await resendOtp(user.mobile, 'text');
    if (!r.ok) {
      console.error('[otp] MSG91 resend failed', r.message);
      return Response.json({ error: otpErrorMessage(r) }, { status: r.reason === 'limit' ? 429 : 502 });
    }
  }
  return Response.json({ sent: true });
}
