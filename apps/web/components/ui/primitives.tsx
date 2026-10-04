import Link from 'next/link';
import type { ComponentProps, ReactNode } from 'react';
import { Icon, type IconName } from './icon';

export function cx(...parts: (string | false | null | undefined)[]): string {
  return parts.filter(Boolean).join(' ');
}

export function Card({ className, children, ...rest }: ComponentProps<'section'>) {
  return (
    <section className={cx('rounded-[20px] border border-line bg-surface', className)} {...rest}>
      {children}
    </section>
  );
}

export function CardHeader({ title, subtitle, actions, className }: { title: ReactNode; subtitle?: ReactNode; actions?: ReactNode; className?: string }) {
  return (
    <div className={cx('flex flex-wrap items-center justify-between gap-3', className)}>
      <div className="min-w-0">
        <h2 className="text-[17px] font-semibold tracking-[-0.01em]">{title}</h2>
        {subtitle && <p className="mt-1 text-[13px] text-muted">{subtitle}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2.5">{actions}</div>}
    </div>
  );
}

export function PageHeader({ eyebrow, title, actions }: { eyebrow?: ReactNode; title: ReactNode; actions?: ReactNode }) {
  return (
    <header className="flex flex-wrap items-end gap-4">
      <div className="min-w-0 flex-[1_1_320px]">
        {eyebrow && <p className="text-[13px] text-muted">{eyebrow}</p>}
        <h1 className="mt-1.5 text-[32px] leading-[1.1] font-semibold tracking-[-0.025em]">{title}</h1>
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2.5">{actions}</div>}
    </header>
  );
}

export type Tone = 'brand' | 'signal' | 'signalStrong' | 'signalMid' | 'sky' | 'neutral' | 'dark' | 'rose' | 'danger';

const TONES: Record<Tone, string> = {
  brand: 'bg-brand-tint text-brand-text',
  signal: 'bg-signal-tint text-signal-text',
  signalMid: 'bg-[#f8ddb5] text-signal-text',
  signalStrong: 'bg-signal text-white',
  sky: 'bg-sky-tint text-sky-text',
  neutral: 'bg-ground-2 text-subtle',
  dark: 'bg-ink text-white',
  rose: 'bg-rose-tint text-rose-text',
  danger: 'bg-danger-tint text-danger-text',
};

export function Badge({ tone = 'neutral', className, children }: { tone?: Tone; className?: string; children: ReactNode }) {
  return <span className={cx('inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-[3px] text-xs font-medium', TONES[tone], className)}>{children}</span>;
}

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger';

const VARIANTS: Record<Variant, string> = {
  primary: 'bg-brand text-white hover:bg-brand-strong border border-brand',
  secondary: 'bg-surface border border-line-strong hover:bg-ground-3',
  ghost: 'bg-transparent border border-transparent hover:bg-ground-2',
  danger: 'bg-surface border-[1.5px] border-signal text-signal-text hover:bg-signal-tint',
};

export function buttonClass(variant: Variant = 'secondary', size: 'md' | 'sm' = 'md') {
  return cx(
    'inline-flex items-center justify-center gap-2 rounded-xl font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed',
    size === 'md' ? 'h-11 px-4 text-sm' : 'h-9 px-3 text-[13px]',
    VARIANTS[variant],
  );
}

export function Button({ variant = 'secondary', size = 'md', icon, className, children, type = 'button', ...rest }: ComponentProps<'button'> & { variant?: Variant; size?: 'md' | 'sm'; icon?: IconName }) {
  return (
    <button type={type} className={cx(buttonClass(variant, size), className)} {...rest}>
      {icon && <Icon name={icon} size={16} />}
      {children}
    </button>
  );
}

export function ButtonLink({ variant = 'secondary', size = 'md', icon, className, children, ...rest }: ComponentProps<typeof Link> & { variant?: Variant; size?: 'md' | 'sm'; icon?: IconName }) {
  return (
    <Link className={cx(buttonClass(variant, size), className)} {...rest}>
      {icon && <Icon name={icon} size={16} />}
      {children}
    </Link>
  );
}

export function Pill({ active, className, children, ...rest }: ComponentProps<typeof Link> & { active?: boolean }) {
  return (
    <Link
      aria-current={active ? 'true' : undefined}
      className={cx(
        'inline-flex h-[38px] flex-none items-center gap-[7px] whitespace-nowrap rounded-full border px-3 text-[13px]',
        active ? 'border-ink bg-ink font-medium text-white' : 'border-line-strong bg-surface hover:bg-ground-3',
        className,
      )}
      {...rest}
    >
      {children}
    </Link>
  );
}

export function Swatch({ color, className }: { color: string; className?: string }) {
  return <span className={cx('inline-block size-2.5 flex-none rounded-[3px]', className)} style={{ background: color }} />;
}

export function Avatar({ initials, size = 36, tone = 'brand' }: { initials: string; size?: number; tone?: Tone }) {
  return (
    <span aria-hidden="true" className={cx('flex flex-none items-center justify-center rounded-full font-semibold', TONES[tone])} style={{ width: size, height: size, fontSize: size > 44 ? 16 : 12 }}>
      {initials}
    </span>
  );
}

export function Stat({ label, value, sub, tone }: { label: string; value: ReactNode; sub?: ReactNode; tone?: 'signal' }) {
  return (
    <div className={cx('rounded-xl p-2.5 text-center', tone === 'signal' ? 'bg-signal-tint text-signal-text' : 'bg-ground')}>
      <div className="tabular text-xl font-semibold">{value}</div>
      <div className={cx('text-[11.5px]', tone === 'signal' ? 'text-signal-text' : 'text-subtle')}>{label}</div>
      {sub && <div className="text-[11px] text-muted">{sub}</div>}
    </div>
  );
}

export function LotIdText({ lotId, href, className }: { lotId: string; href?: string; className?: string }) {
  const cls = cx('font-mono text-[12.5px] font-medium text-ink', className);
  return href ? (
    <Link href={href} className={cx(cls, 'underline decoration-[#c9d1c8] underline-offset-[3px] hover:decoration-ink')}>
      {lotId}
    </Link>
  ) : (
    <span className={cls}>{lotId}</span>
  );
}

export function ProgressBar({ value, color = '#2f7d4e', marker, className }: { value: number; color?: string; marker?: number; className?: string }) {
  return (
    <div className={cx('relative h-1.5 rounded-full bg-line-soft', className)}>
      <div className="h-1.5 rounded-full" style={{ width: `${Math.max(0, Math.min(1, value)) * 100}%`, background: color }} />
      {marker !== undefined && <div className="absolute -top-[3px] h-3 w-0.5 rounded bg-ink" style={{ left: `${marker * 100}%` }} />}
    </div>
  );
}

export const thClass = 'border-b border-line-soft px-2 py-2.5 text-left font-medium text-muted';
export const tdClass = 'border-b border-row px-2 py-3';
