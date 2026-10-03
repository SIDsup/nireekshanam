'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect } from 'react';
import { warmFieldPages } from '@/components/pwa/sw-registrar';
import { Icon, type IconName } from '@/components/ui/icon';
import { cx } from '@/components/ui/primitives';
import { startAutoSync } from '@/lib/field/sync';
import { clearToast, useQueueStats, useToast } from '@/lib/field/use-field';

const TABS: { href: string; label: string; icon: IconName; match: (p: string) => boolean }[] = [
  { href: '/field', label: 'Today', icon: 'calendar', match: (p) => p === '/field' },
  { href: '/field/lots', label: 'Lots', icon: 'layers', match: (p) => p.startsWith('/field/lots') },
  { href: '/field/scan', label: 'Scan QR', icon: 'scan', match: (p) => p.startsWith('/field/scan') },
  { href: '/field/sync', label: 'Sync', icon: 'sync', match: (p) => p.startsWith('/field/sync') },
];

export function FieldShell({ demoName, children }: { demoName: string | null; children: React.ReactNode }) {
  const pathname = usePathname() ?? '/field';
  const stats = useQueueStats();
  const waiting = (stats?.pending ?? 0) + (stats?.rejected ?? 0);
  const onForm = /^\/field\/lots\/[^/]+\/stage\//.test(pathname);

  useEffect(() => startAutoSync(), []);
  // The field shell only renders with a session, so the worker can now cache the field pages for offline use.
  useEffect(() => warmFieldPages(), []);

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-[480px] flex-col bg-ground sm:border-x sm:border-line">
      {demoName && (
        <p className="bg-sky-tint px-4 py-1.5 text-center text-[12px] font-medium text-sky-text">
          Viewing as {demoName} (demo)
        </p>
      )}
      <div className="flex flex-1 flex-col">{children}</div>
      {!onForm && (
        <nav aria-label="Field app" className="sticky bottom-0 z-20 grid grid-cols-4 border-t border-line bg-surface px-1.5 pt-2 pb-[max(14px,env(safe-area-inset-bottom))]">
          {TABS.map((t) => {
            const active = t.match(pathname);
            return (
              <Link
                key={t.href}
                href={t.href}
                aria-current={active ? 'page' : undefined}
                className={cx('relative flex min-h-12 flex-col items-center justify-center gap-1 text-[11.5px]', active ? 'font-semibold text-brand' : 'text-muted')}
              >
                <Icon name={t.icon} size={22} strokeWidth={1.9} />
                {t.label}
                {t.href === '/field/sync' && waiting > 0 && (
                  <span className={cx('absolute top-0.5 right-[24%] flex h-[18px] min-w-[18px] items-center justify-center rounded-full px-1 text-[10.5px] font-bold text-white', (stats?.rejected ?? 0) > 0 ? 'bg-signal' : 'bg-signal-mid')}>
                    {waiting}
                  </span>
                )}
              </Link>
            );
          })}
        </nav>
      )}
      <Toast />
    </div>
  );
}

function Toast() {
  const toast = useToast();
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(clearToast, 4500);
    return () => clearTimeout(t);
  }, [toast]);
  if (!toast) return null;
  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-24 z-50 flex justify-center px-4">
      <div role="status" className="pointer-events-auto flex max-w-[440px] items-center gap-3 rounded-2xl bg-forest px-4 py-3 text-[14px] text-white shadow-[0_10px_30px_rgba(13,28,21,0.35)]">
        <span className={cx('flex size-7 flex-none items-center justify-center rounded-full', toast.tone === 'ok' ? 'bg-forest-3 text-leaf' : 'bg-[#3a2a12] text-signal-soft')}>
          <Icon name={toast.tone === 'ok' ? 'check' : 'alert'} size={16} strokeWidth={2.4} />
        </span>
        <span className="flex-1">{toast.text}</span>
        <button type="button" onClick={clearToast} aria-label="Dismiss" className="-mr-2 flex size-11 items-center justify-center text-forest-muted">
          <Icon name="x" size={16} />
        </button>
      </div>
    </div>
  );
}
