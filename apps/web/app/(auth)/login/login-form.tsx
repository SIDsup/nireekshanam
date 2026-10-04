'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { Icon } from '@/components/ui/icon';

const DEMO_ACCOUNTS = [
  { label: 'Production Manager', mobile: '9848022901' },
  { label: 'Supervisor', mobile: '9963100302' },
  { label: 'Field Assistant', mobile: '9848022211' },
];

const RESEND_AFTER_S = 30;

export function LoginForm({ next, demo }: { next?: string; demo: boolean }) {
  const router = useRouter();
  const [step, setStep] = useState<'phone' | 'otp'>('phone');
  const [mobile, setMobile] = useState('');
  const [digits, setDigits] = useState(['', '', '', '', '', '']);
  const [error, setError] = useState<string | null>(null);
  const [hint, setHint] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [resendIn, setResendIn] = useState(0);
  const inputs = useRef<(HTMLInputElement | null)[]>([]);
  const clean = mobile.replace(/\D/g, '');

  useEffect(() => {
    if (resendIn <= 0) return;
    const t = setTimeout(() => setResendIn((s) => s - 1), 1000);
    return () => clearTimeout(t);
  }, [resendIn]);

  async function send(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const res = await fetch('/api/auth/otp/request', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ mobile: clean }) });
    const data = await res.json();
    setBusy(false);
    if (!res.ok) return setError(data.error);
    setHint(data.demoHint ?? null);
    setStep('otp');
    setResendIn(RESEND_AFTER_S);
    setTimeout(() => inputs.current[0]?.focus(), 0);
  }

  async function resend() {
    setBusy(true);
    setError(null);
    const res = await fetch('/api/auth/otp/resend', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ mobile: clean }) });
    const data = await res.json();
    setBusy(false);
    if (!res.ok) return setError(data.error);
    setDigits(['', '', '', '', '', '']);
    setResendIn(RESEND_AFTER_S);
    inputs.current[0]?.focus();
  }

  async function verify(code: string) {
    setBusy(true);
    setError(null);
    const res = await fetch('/api/auth/otp/verify', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ mobile: clean, code }) });
    const data = await res.json();
    setBusy(false);
    if (!res.ok) return setError(data.error);
    router.replace(next && next.startsWith('/') ? next : data.redirect);
    router.refresh();
  }

  function setDigit(i: number, value: string) {
    const chars = value.replace(/\D/g, '').split('');
    if (chars.length === 0) {
      setDigits((d) => d.map((x, j) => (j === i ? '' : x)));
      return;
    }
    const nextDigits = [...digits];
    chars.slice(0, 6 - i).forEach((c, k) => { nextDigits[i + k] = c; });
    setDigits(nextDigits);
    const focus = Math.min(5, i + chars.length);
    inputs.current[focus]?.focus();
    if (nextDigits.every(Boolean)) void verify(nextDigits.join(''));
  }

  return (
    <div className="flex w-full max-w-[400px] flex-col gap-7">
      {step === 'phone' ? (
        <>
          <div className="flex flex-col gap-2">
            <h2 className="text-[28px] font-semibold tracking-[-0.025em]">Sign in</h2>
            <p className="text-[15px] leading-relaxed text-muted">Use the mobile number registered with your organisation. We will send a one-time code.</p>
          </div>
          <form onSubmit={send} className="flex flex-col gap-[18px]">
            <div className="flex flex-col gap-2">
              <label htmlFor="mobile" className="text-[13px] font-medium">Mobile number</label>
              <div className="flex h-[52px] items-center overflow-hidden rounded-[14px] border-[1.5px] border-line-strong bg-surface focus-within:border-brand focus-within:shadow-[0_0_0_4px_#ddefe3]">
                <span className="tabular flex h-full items-center border-r border-line px-4 text-base text-muted">+91</span>
                <input id="mobile" type="tel" inputMode="numeric" autoComplete="tel-national" required value={mobile} onChange={(e) => setMobile(e.target.value)} placeholder="98480 22145" className="tabular min-w-0 flex-1 bg-transparent px-3.5 text-[17px] tracking-[0.04em] outline-none" />
              </div>
            </div>
            {error && <p role="alert" className="text-[13px] font-medium text-danger-text">{error}</p>}
            <button type="submit" disabled={busy || clean.length !== 10} className="flex h-[52px] items-center justify-center gap-2 rounded-[14px] bg-brand text-[15px] font-semibold text-white hover:bg-brand-strong disabled:opacity-50">
              Send code <Icon name="arrowRight" size={16} strokeWidth={2} />
            </button>
          </form>
          {demo && <div className="flex flex-col gap-2">
            <p className="text-xs font-medium uppercase tracking-[0.08em] text-muted">Demo accounts</p>
            <div className="flex flex-wrap gap-2">
              {DEMO_ACCOUNTS.map((a) => (
                <button key={a.mobile} type="button" onClick={() => setMobile(a.mobile)} className="h-9 rounded-full border border-line-strong bg-surface px-3 text-[13px] hover:bg-ground-3">{a.label}</button>
              ))}
            </div>
          </div>}
        </>
      ) : (
        <>
          <div className="flex flex-col gap-2">
            <button type="button" onClick={() => { setStep('phone'); setDigits(['', '', '', '', '', '']); setError(null); }} className="flex min-h-9 items-center gap-1.5 self-start text-[13px] text-muted hover:text-ink">
              <Icon name="arrowLeft" size={14} strokeWidth={2} /> Change number
            </button>
            <h2 className="text-[28px] font-semibold tracking-[-0.025em]">Enter the code</h2>
            <p className="text-[15px] leading-relaxed text-muted">Sent to <b className="tabular font-semibold text-ink">+91 {clean.slice(0, 5)} {clean.slice(5)}</b>. It expires in 5 minutes.</p>
          </div>
          <fieldset className="flex flex-col gap-2.5">
            <legend className="mb-2.5 text-[13px] font-medium">6-digit code</legend>
            <div className="grid grid-cols-6 gap-2">
              {digits.map((d, i) => (
                <input
                  key={i}
                  ref={(el) => { inputs.current[i] = el; }}
                  aria-label={`Digit ${i + 1}`}
                  inputMode="numeric"
                  autoComplete={i === 0 ? 'one-time-code' : 'off'}
                  value={d}
                  onChange={(e) => setDigit(i, e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Backspace' && !d && i > 0) inputs.current[i - 1]?.focus(); }}
                  className="h-[58px] w-full rounded-xl border-[1.5px] border-[#c9d1c8] bg-surface text-center text-2xl font-semibold outline-none focus:border-brand focus:shadow-[0_0_0_4px_#ddefe3]"
                />
              ))}
            </div>
            {hint && <p className="text-[13px] text-sky-text">{hint}</p>}
          </fieldset>
          <p className="text-[13px] text-muted">
            Didn&apos;t get it?{' '}
            {resendIn > 0 ? (
              <span className="tabular">Resend in {resendIn}s</span>
            ) : (
              <button type="button" disabled={busy} onClick={resend} className="min-h-9 font-medium text-brand hover:text-brand-strong disabled:opacity-50">Resend code</button>
            )}
          </p>
          {error && <p role="alert" className="text-[13px] font-medium text-danger-text">{error}</p>}
          <button type="button" disabled={busy || !digits.every(Boolean)} onClick={() => verify(digits.join(''))} className="flex h-[52px] items-center justify-center rounded-[14px] bg-brand text-[15px] font-semibold text-white hover:bg-brand-strong disabled:opacity-50">
            {busy ? 'Checking…' : 'Verify and continue'}
          </button>
        </>
      )}
      <div className="flex items-start gap-3 rounded-[14px] border border-line bg-surface px-4 py-3.5">
        <Icon name="lock" className="mt-px flex-none text-brand" />
        <p className="text-[12.5px] leading-normal text-muted">Access is limited to the regions and lots assigned to your role. Personal data is handled under India&apos;s DPDP Act, 2023.</p>
      </div>
    </div>
  );
}
