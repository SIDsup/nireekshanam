import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { retryOtp, sendOtp, verifyOtp } from '../lib/msg91';
import { checkOtp, DEMO_OTP, isDemoOtp } from '../lib/otp';

const reply = (body: unknown, status = 200) => vi.fn(async () => new Response(JSON.stringify(body), { status }));

describe('MSG91 OTP client', () => {
  beforeEach(() => {
    vi.stubEnv('MSG91_AUTH_KEY', 'test-key');
    vi.stubEnv('MSG91_OTP_TEMPLATE_ID', 'tmpl-1');
  });
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it('sends with template, +91 number, length and expiry, and the authkey header', async () => {
    const fetch = reply({ type: 'success', request_id: 'r1' });
    vi.stubGlobal('fetch', fetch);
    expect(await sendOtp('9848022901')).toEqual({ ok: true });
    const [url, init] = fetch.mock.calls[0] as unknown as [string, RequestInit];
    const u = new URL(url);
    expect(u.origin + u.pathname).toBe('https://control.msg91.com/api/v5/otp');
    expect(Object.fromEntries(u.searchParams)).toEqual({ template_id: 'tmpl-1', mobile: '919848022901', otp_length: '6', otp_expiry: '5' });
    expect(init.method).toBe('POST');
    expect((init.headers as Record<string, string>).authkey).toBe('test-key');
  });

  it('treats an HTTP 200 with type=error as a failure', async () => {
    vi.stubGlobal('fetch', reply({ type: 'error', message: 'OTP not match' }));
    expect(await verifyOtp('9848022901', '123456')).toMatchObject({ ok: false, reason: 'mismatch' });
  });

  it('maps expiry and attempt-limit errors', async () => {
    vi.stubGlobal('fetch', reply({ type: 'error', message: 'OTP expired' }));
    expect(await verifyOtp('9848022901', '123456')).toMatchObject({ reason: 'expired' });
    vi.stubGlobal('fetch', reply({ type: 'error', message: 'Max limit reached for this otp verification' }));
    expect(await verifyOtp('9848022901', '123456')).toMatchObject({ reason: 'limit' });
  });

  it('reports network errors and non-JSON responses as failed', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => { throw new Error('ECONNRESET'); }));
    expect(await retryOtp('9848022901')).toMatchObject({ ok: false, reason: 'failed' });
    vi.stubGlobal('fetch', vi.fn(async () => new Response('<html>', { status: 500 })));
    expect(await sendOtp('9848022901')).toMatchObject({ ok: false, reason: 'failed' });
  });

  it('retries by text with the right params', async () => {
    const fetch = reply({ type: 'success' });
    vi.stubGlobal('fetch', fetch);
    await retryOtp('9848022901', 'text');
    const u = new URL((fetch.mock.calls[0] as unknown as [string])[0]);
    expect(u.pathname).toBe('/api/v5/otp/retry');
    expect(Object.fromEntries(u.searchParams)).toEqual({ mobile: '919848022901', retrytype: 'text' });
  });
});

describe('demo mode', () => {
  afterEach(() => vi.unstubAllEnvs());

  it('is on when MSG91 is not configured, and accepts only the demo code', async () => {
    vi.stubEnv('MSG91_AUTH_KEY', '');
    expect(isDemoOtp()).toBe(true);
    expect(await checkOtp('9848022901', DEMO_OTP)).toEqual({ ok: true });
    expect(await checkOtp('9848022901', '000000')).toMatchObject({ ok: false, reason: 'mismatch' });
  });
});
