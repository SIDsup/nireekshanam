/**
 * Demo OTP. A real deployment sends the code by SMS (MSG91 / Supabase Auth, SPECS §6)
 * and stores only a hash with an expiry. Here every code is DEMO_OTP so the flow can be tried.
 */
export const DEMO_OTP = '246810';
export const OTP_TTL_MS = 5 * 60_000;
