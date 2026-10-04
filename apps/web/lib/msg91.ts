/**
 * MSG91 OTP API (v5). MSG91 generates, sends and checks the code, so nothing is stored here.
 * Note: MSG91 reports failures as `{ type: 'error', message }`, often with HTTP 200, so always check `type`.
 */
const BASE = 'https://control.msg91.com/api/v5/otp';

export const OTP_LENGTH = 6;
export const OTP_EXPIRY_MINUTES = 5;

type Msg91Response = { type: 'success' | 'error'; message?: string; request_id?: string };
export type OtpResult = { ok: true } | { ok: false; reason: 'mismatch' | 'expired' | 'limit' | 'failed'; message?: string };

function config() {
  const authKey = process.env.MSG91_AUTH_KEY;
  const templateId = process.env.MSG91_OTP_TEMPLATE_ID;
  if (!authKey || !templateId) throw new Error('MSG91_AUTH_KEY and MSG91_OTP_TEMPLATE_ID must be set');
  return { authKey, templateId };
}

/** 10-digit Indian mobile → MSG91's country-code format. */
const intl = (mobile: string) => `91${mobile}`;

async function call(path: string, method: 'GET' | 'POST', params: Record<string, string>): Promise<Msg91Response> {
  const { authKey } = config();
  const url = `${BASE}${path}?${new URLSearchParams(params)}`;
  try {
    const res = await fetch(url, {
      method,
      headers: { authkey: authKey, Accept: 'application/json', 'Content-Type': 'application/json' },
      body: method === 'POST' ? '{}' : undefined,
      signal: AbortSignal.timeout(10_000),
      cache: 'no-store',
    });
    const data = (await res.json().catch(() => null)) as Msg91Response | null;
    if (!res.ok || !data) return { type: 'error', message: data?.message ?? `HTTP ${res.status}` };
    return data;
  } catch (err) {
    return { type: 'error', message: err instanceof Error ? err.message : String(err) };
  }
}

function toResult(r: Msg91Response): OtpResult {
  if (r.type === 'success') return { ok: true };
  const m = (r.message ?? '').toLowerCase();
  if (m.includes('expire')) return { ok: false, reason: 'expired', message: r.message };
  if (m.includes('max') || m.includes('limit')) return { ok: false, reason: 'limit', message: r.message };
  if (m.includes('not match') || m.includes('invalid otp')) return { ok: false, reason: 'mismatch', message: r.message };
  return { ok: false, reason: 'failed', message: r.message };
}

export async function sendOtp(mobile: string): Promise<OtpResult> {
  return toResult(await call('', 'POST', {
    template_id: config().templateId,
    mobile: intl(mobile),
    otp_length: String(OTP_LENGTH),
    otp_expiry: String(OTP_EXPIRY_MINUTES),
  }));
}

export async function verifyOtp(mobile: string, otp: string): Promise<OtpResult> {
  return toResult(await call('/verify', 'GET', { mobile: intl(mobile), otp }));
}

/** Re-sends the current code. `voice` reads it out in a call, a fallback when SMS does not arrive. */
export async function retryOtp(mobile: string, channel: 'text' | 'voice' = 'text'): Promise<OtpResult> {
  return toResult(await call('/retry', 'GET', { mobile: intl(mobile), retrytype: channel }));
}
