import { OTP_EXPIRY_MINUTES, retryOtp, sendOtp, verifyOtp, type OtpResult } from './msg91';

/**
 * OTP delivery. With MSG91_AUTH_KEY and MSG91_OTP_TEMPLATE_ID set, codes go out by SMS through MSG91 (lib/msg91).
 * Without them the app runs in demo mode: no SMS is sent and every code is DEMO_OTP so the flow can be tried.
 */
export const DEMO_OTP = '246810';
export const OTP_TTL_MS = OTP_EXPIRY_MINUTES * 60_000;

export const isDemoOtp = () => !(process.env.MSG91_AUTH_KEY && process.env.MSG91_OTP_TEMPLATE_ID);

export async function requestOtp(mobile: string): Promise<OtpResult> {
  return isDemoOtp() ? { ok: true } : sendOtp(mobile);
}

export async function resendOtp(mobile: string, channel: 'text' | 'voice' = 'text'): Promise<OtpResult> {
  return isDemoOtp() ? { ok: true } : retryOtp(mobile, channel);
}

export async function checkOtp(mobile: string, code: string): Promise<OtpResult> {
  if (isDemoOtp()) return code === DEMO_OTP ? { ok: true } : { ok: false, reason: 'mismatch' };
  return verifyOtp(mobile, code);
}

/** User-facing text for a failed OTP step. */
export function otpErrorMessage(r: Exclude<OtpResult, { ok: true }>): string {
  switch (r.reason) {
    case 'mismatch': return 'That code is not right. Check it and try again.';
    case 'expired': return 'That code has expired. Tap "Resend code" for a new one.';
    case 'limit': return 'Too many attempts. Wait a few minutes, then request a new code.';
    default: return 'We could not reach the SMS service. Try again in a moment.';
  }
}
